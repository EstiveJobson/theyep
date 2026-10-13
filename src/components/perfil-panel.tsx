"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AvatarImage } from "@/components/avatar-image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ownedStoragePath } from "@/lib/avatar-path";
import { signAvatarDisplayUrl } from "@/lib/avatar-url";
import { AVATAR_EDGE, compressPhoto, photoRejection, PHOTO_REJECTED } from "@/lib/compress-photo";
import { applyPendingSchool } from "@/lib/pending-school";
import { INACTIVE_SCHOOL_NOTICE } from "@/lib/pending-school-plan";
import { ProfileSocial } from "@/components/profile-social";
import type { FollowStats } from "@/lib/follows";
import { firstRelation } from "@/lib/relation";
import { listActiveSchools, type SchoolOption } from "@/lib/schools";
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { joinedLabel } from "@/lib/relative-time";

type Profile = {
  id: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  created_at: string;
  school_id: string | null;
  schools: SchoolOption | SchoolOption[] | null;
};

type Mode = "entrar" | "criar";

const fieldClass =
  "mt-1 h-11 w-full rounded-lg border border-line bg-bg px-3 font-normal text-fg outline-none focus-visible:border-blue-ink";

function authErrorMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "Esse e-mail já tem conta.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirme o e-mail que enviamos antes de entrar.";
  }
  if (text.includes("password")) {
    return "A senha não foi aceita. Use pelo menos 6 caracteres.";
  }
  if (text.includes("fetch") || text.includes("network") || text.includes("failed")) {
    return "Sem conexão. Tente de novo.";
  }
  return "Não foi possível concluir. Tente de novo.";
}

function initialOf(name: string, email: string): string {
  const source = name.trim() || email.trim();
  return (source.charAt(0) || "Y").toUpperCase();
}

function schoolLabel(profile: Profile | null): string {
  return firstRelation(profile?.schools)?.short_name?.trim() ?? "";
}

export function PerfilPanel({ followStats = null }: { followStats?: FollowStats | null }) {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signupSchool, setSignupSchool] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsLoaded, setSchoolsLoaded] = useState(false);
  const [schoolsError, setSchoolsError] = useState("");
  const [pickingSchool, setPickingSchool] = useState(false);
  const [schoolChoice, setSchoolChoice] = useState("");
  const [savingSchool, setSavingSchool] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!configured) return;
    const supabase = getBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let alive = true;

    async function load(nextUser: User | null) {
      if (!alive || !supabase) return;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setPickingSchool(false);
        setLoading(false);
        return;
      }
      const pendingResult = await applyPendingSchool(supabase, nextUser);
      if (!alive) return;
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, bio, avatar_url, created_at, school_id, schools(id, name, short_name)")
        .eq("id", nextUser.id)
        .maybeSingle();
      if (!alive) return;
      if (profileError) {
        setProfile(null);
        setError("Não foi possível carregar o perfil.");
      } else {
        const row = (data as Profile | null) ?? null;
        const avatarUrl = row ? await signAvatarDisplayUrl(supabase, row.id, row.avatar_url) : null;
        if (!alive) return;
        setProfile(row ? { ...row, avatar_url: avatarUrl } : null);
        setError(pendingResult === "inactive" ? INACTIVE_SCHOOL_NOTICE : "");
      }
      setLoading(false);
      if (pendingResult === "applied") router.refresh();
    }

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) {
        setError("Não foi possível conectar ao login.");
        setLoading(false);
        return;
      }
      void load(data.session?.user ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void load(session?.user ?? null);
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, [configured, router]);

  useEffect(() => {
    if (!configured) return;
    const showSignupList = mode === "criar" && !user;
    if (!showSignupList && !pickingSchool) return;
    const supabase = getBrowserClient();
    if (!supabase) return;

    let alive = true;
    setSchoolsLoading(true);
    setSchoolsLoaded(false);
    setSchoolsError("");
    void listActiveSchools(supabase).then((result) => {
      if (!alive) return;
      setSchools(result.schools);
      setSchoolsError(result.error ?? "");
      setSchoolsLoading(false);
      setSchoolsLoaded(true);
    });

    return () => {
      alive = false;
    };
  }, [configured, mode, user, pickingSchool]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Informe seu e-mail.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Esse e-mail não parece válido.");
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (mode === "criar" && password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    if (!configured) {
      setError("O login por e-mail ainda não está ligado. Falta configurar o Supabase.");
      return;
    }

    const supabase = getBrowserClient();
    if (!supabase) {
      setError("O login por e-mail ainda não está ligado. Falta configurar o Supabase.");
      return;
    }

    setPending(true);
    if (mode === "criar") {
      const selected = schools.find((school) => school.id === signupSchool) ?? null;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmed,
        password,
        options: selected ? { data: { pending_school_id: selected.id } } : undefined,
      });
      setPending(false);
      if (signUpError) {
        setError(authErrorMessage(signUpError.message));
        return;
      }
      if (data.session) {
        const result = await applyPendingSchool(supabase, data.session.user);
        if (result === "inactive") setError(INACTIVE_SCHOOL_NOTICE);
        if (result === "applied") router.refresh();
        return;
      }
      setNotice(
        "Conta criada. Se a confirmação por e-mail estiver ligada, abra a mensagem que enviamos.",
      );
      setMode("entrar");
      setPassword("");
      setConfirm("");
      setSignupSchool("");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setPending(false);
    if (signInError) setError(authErrorMessage(signInError.message));
  }

  async function onAvatar(file: File | undefined) {
    setError("");
    if (!file || !user) return;
    const rejected = photoRejection(file);
    if (rejected) {
      setError(rejected === PHOTO_REJECTED ? "Por enquanto só dá para usar fotos." : rejected);
      if (avatarRef.current) avatarRef.current.value = "";
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Não foi possível enviar a foto. Tente de novo.");
      return;
    }
    const previous = ownedStoragePath(user.id, profile?.avatar_url);
    setAvatarBusy(true);
    try {
      const image = await compressPhoto(file, AVATAR_EDGE);
      const path = `${user.id}/${crypto.randomUUID()}.${image.extension}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, image.blob, {
          contentType: image.contentType,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) {
        setError("Não foi possível enviar a foto. Tente de novo.");
        return;
      }
      const { error: saveError } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      if (saveError) {
        await supabase.storage.from("avatars").remove([path]);
        setError("Não foi possível enviar a foto. Tente de novo.");
        return;
      }
      if (previous && previous !== path) {
        const { error: removeError } = await supabase.storage.from("avatars").remove([previous]);
        if (removeError) console.error("avatar delete failed", removeError.message);
      }
      const signed = await signAvatarDisplayUrl(supabase, user.id, path);
      setProfile((current) => (current ? { ...current, avatar_url: signed } : current));
      router.refresh();
    } catch {
      setError("Não foi possível preparar essa foto. Use JPEG, PNG ou WebP.");
    } finally {
      setAvatarBusy(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  }

  async function removeAvatar() {
    if (!user || !profile?.avatar_url || avatarBusy) return;
    const path = ownedStoragePath(user.id, profile.avatar_url);
    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Não foi possível remover a foto. Tente de novo.");
      return;
    }
    setAvatarBusy(true);
    setError("");
    try {
      const { error: saveError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (saveError) {
        setError("Não foi possível remover a foto. Tente de novo.");
        return;
      }
      if (path) {
        const { error: removeError } = await supabase.storage.from("avatars").remove([path]);
        if (removeError) console.error("avatar delete failed", removeError.message);
      }
      setProfile((current) => (current ? { ...current, avatar_url: null } : current));
      router.refresh();
    } finally {
      setAvatarBusy(false);
    }
  }

  async function signOut() {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setPending(true);
    setError("");
    const { error: signOutError } = await supabase.auth.signOut();
    setPending(false);
    if (signOutError) setError("Não foi possível sair. Tente de novo.");
  }

  async function onChooseSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const school = schools.find((item) => item.id === schoolChoice);
    if (!school) return;

    const supabase = getBrowserClient();
    if (!supabase || !user) {
      setError("Não foi possível salvar sua escola. Tente de novo.");
      return;
    }

    setSavingSchool(true);
    const { error: rpcError } = await supabase.rpc("set_my_school", { p_school: school.id });
    if (rpcError) {
      const inactive = `${rpcError.message} ${rpcError.details ?? ""} ${rpcError.hint ?? ""}`
        .toLowerCase()
        .includes("inactive");
      const { data } = await supabase
        .from("profiles")
        .select("id, name, bio, avatar_url, created_at, school_id, schools(id, name, short_name)")
        .eq("id", user.id)
        .maybeSingle();
      const loaded = (data as Profile | null) ?? null;
      const next = loaded
        ? {
            ...loaded,
            avatar_url: await signAvatarDisplayUrl(supabase, loaded.id, loaded.avatar_url),
          }
        : null;
      if (next?.school_id) {
        setProfile(next);
        setPickingSchool(false);
        setSavingSchool(false);
        router.refresh();
        return;
      }
      setSavingSchool(false);
      setError(
        inactive ? INACTIVE_SCHOOL_NOTICE : "Não foi possível salvar sua escola. Tente de novo.",
      );
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            school_id: school.id,
            schools: school,
          }
        : current,
    );
    setPickingSchool(false);
    setSavingSchool(false);
    router.refresh();
  }

  if (loading) {
    return (
      <section className="card animate-pulse p-4" aria-busy="true" aria-label="Carregando perfil">
        <div className="size-16 rounded-full bg-line" />
        <div className="mt-4 h-4 w-40 rounded bg-line" />
        <div className="mt-2 h-3 w-56 rounded bg-line" />
      </section>
    );
  }

  if (user) {
    const name = profile?.name?.trim() ?? "";
    const bio = profile?.bio?.trim() ?? "";
    const when = profile?.created_at ? joinedLabel(profile.created_at) : "";
    const campus = schoolLabel(profile);
    const canChooseSchool = Boolean(profile && !profile.school_id);
    const chosen = schools.find((school) => school.id === schoolChoice) ?? null;
    return (
      <section className="card p-4">
        <div className="flex items-center gap-3">
          <AvatarImage
            profileId={user.id}
            src={profile?.avatar_url ?? null}
            alt={name ? `Foto de ${name}` : "Foto do perfil"}
            className="size-16 rounded-full object-cover"
            fallback={
              <span className="grid size-16 place-items-center rounded-full bg-yellow text-xl font-extrabold text-on-accent">
                {initialOf(name, user.email ?? "")}
              </span>
            }
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold">{name || "Sem nome"}</h1>
            <p className="truncate text-sm text-muted">{user.email}</p>
            {campus ? <p className="truncate text-sm text-muted">{campus}</p> : null}
          </div>
        </div>
        <div className="mt-3">
          <input
            ref={avatarRef}
            id="profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="sr-only"
            disabled={avatarBusy}
            onChange={(event) => void onAvatar(event.target.files?.[0])}
          />
          <label
            htmlFor="profile-photo"
            className={
              "inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-bold text-blue-ink " +
              (avatarBusy ? "pointer-events-none opacity-60" : "")
            }
          >
            {avatarBusy ? "Enviando foto…" : "Escolher foto"}
          </label>
          {profile?.avatar_url ? (
            <button
              type="button"
              onClick={() => void removeAvatar()}
              disabled={avatarBusy}
              className="ml-2 inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-bold text-blue-ink disabled:opacity-60"
            >
              Remover foto
            </button>
          ) : null}
        </div>
        <ProfileSocial profileId={user.id} viewerId={user.id} initial={followStats} />
        <p className="mt-4 text-sm">{bio || "Sem bio ainda."}</p>
        {when ? <p className="mt-2 text-sm text-muted">{when}</p> : null}
        {canChooseSchool && !pickingSchool ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setSchoolChoice("");
              setPickingSchool(true);
            }}
            className="mt-4 h-11 rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
          >
            Escolher minha escola
          </button>
        ) : null}
        {canChooseSchool && pickingSchool ? (
          <form className="mt-4 space-y-3" onSubmit={onChooseSchool}>
            <label className="block text-sm font-semibold" htmlFor="profile-school">
              Sua escola
              <select
                id="profile-school"
                name="school"
                value={schoolChoice}
                onChange={(event) => setSchoolChoice(event.target.value)}
                disabled={schoolsLoading || savingSchool}
                className={fieldClass}
              >
                <option value="">Selecione sua escola</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
            {schoolsLoading ? <p className="text-sm text-muted">Carregando escolas…</p> : null}
            {schoolsError ? (
              <p role="alert" className="text-sm font-semibold text-blue-ink">
                {schoolsError}
              </p>
            ) : null}
            {chosen ? (
              <p className="text-sm text-muted">
                Você vai entrar no campus {chosen.short_name} ({chosen.name}). Depois de escolher,
                não dá para trocar.
              </p>
            ) : null}
            {schoolsLoaded && !schoolsLoading && !schoolsError && schools.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma escola disponível no momento.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!chosen || savingSchool || schoolsLoading}
                className="h-11 rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent disabled:opacity-60"
              >
                {savingSchool ? "Salvando…" : "Confirmar"}
              </button>
              <button
                type="button"
                disabled={savingSchool}
                onClick={() => {
                  setPickingSchool(false);
                  setSchoolChoice("");
                }}
                className="h-11 rounded-lg border border-line px-4 text-sm font-bold text-blue-ink disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent"
          >
            {error}
          </p>
        ) : null}
        <Link
          href="/configuracoes"
          className="mt-4 inline-flex h-11 items-center text-sm font-bold text-blue-ink"
        >
          Configurações
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={pending || savingSchool}
          className="mt-4 h-11 rounded-lg border border-line px-4 text-sm font-bold text-blue-ink disabled:opacity-60"
        >
          {pending ? "Saindo…" : "Sair"}
        </button>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <div className="mb-3 flex justify-center">
        <img
          src="/logo-burst-soft.svg"
          alt="TheYep"
          width={970}
          height={836}
          className="w-28 dark:hidden"
        />
        <img
          src="/logo-dark-burst-soft.svg"
          alt="TheYep"
          width={970}
          height={836}
          className="hidden w-28 dark:block"
        />
      </div>
      <h1 className="text-lg font-extrabold">{mode === "entrar" ? "Entrar" : "Criar conta"}</h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "entrar" ? "Entre com seu e-mail e senha." : "Crie sua conta com e-mail e senha."}
      </p>
      {!configured ? (
        <p className="mt-3 rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent">
          O login por e-mail ainda não está ligado. Falta configurar o Supabase.
        </p>
      ) : null}
      <form className="mt-4 space-y-3" onSubmit={onSubmit} noValidate>
        <label className="block text-sm font-semibold" htmlFor="email">
          E-mail
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm font-semibold" htmlFor="password">
          Senha
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "criar" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
          />
        </label>
        {mode === "criar" ? (
          <label className="block text-sm font-semibold" htmlFor="confirm">
            Confirmar senha
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className={fieldClass}
            />
          </label>
        ) : null}
        {mode === "criar" ? (
          <div>
            <label className="block text-sm font-semibold" htmlFor="signup-school">
              Sua escola
              <select
                id="signup-school"
                name="school"
                value={signupSchool}
                onChange={(event) => setSignupSchool(event.target.value)}
                aria-describedby="signup-school-help"
                className={fieldClass}
              >
                <option value="">Pular – nenhuma dessas</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
            <p id="signup-school-help" className="mt-1 text-sm text-muted">
              Escolhendo uma escola, você também vê o feed do seu campus. Depois de escolher, não dá
              para trocar.
            </p>
            {schoolsLoading ? <p className="mt-1 text-sm text-muted">Carregando escolas…</p> : null}
            {schoolsError ? (
              <p role="alert" className="mt-1 text-sm font-semibold text-blue-ink">
                {schoolsError} Você ainda pode pular e escolher depois.
              </p>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="rounded-lg bg-blue px-3 py-2 text-sm font-semibold text-on-accent"
          >
            {notice}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-lg bg-pink text-sm font-extrabold text-on-accent disabled:opacity-60"
        >
          {pending ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar conta"}
        </button>
      </form>
      <button
        type="button"
        className="mt-3 min-h-11 text-sm font-bold text-blue-ink"
        onClick={() => {
          setMode(mode === "entrar" ? "criar" : "entrar");
          setError("");
          setNotice("");
          setConfirm("");
          setSignupSchool("");
        }}
      >
        {mode === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
      </button>
    </section>
  );
}
