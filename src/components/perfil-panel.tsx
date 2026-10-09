"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { joinedLabel } from "@/lib/relative-time";

type Profile = {
  id: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  created_at: string;
};

type Mode = "entrar" | "criar";

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

export function PerfilPanel() {
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!configured) return;
    const supabase = getBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let alive = true;

    async function load(nextUser: User | null) {
      if (!alive) return;
      setUser(nextUser);
      if (!nextUser || !supabase) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, bio, avatar_url, created_at")
        .eq("id", nextUser.id)
        .maybeSingle();
      if (!alive) return;
      if (profileError) {
        setProfile(null);
        setError("Não foi possível carregar o perfil.");
      } else {
        setProfile((data as Profile | null) ?? null);
        setError("");
      }
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
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
  }, [configured]);

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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmed,
        password,
      });
      setPending(false);
      if (signUpError) {
        setError(authErrorMessage(signUpError.message));
        return;
      }
      if (!data.session) {
        setNotice(
          "Conta criada. Se a confirmação por e-mail estiver ligada, abra a mensagem que enviamos.",
        );
        setMode("entrar");
        setPassword("");
        setConfirm("");
      }
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setPending(false);
    if (signInError) setError(authErrorMessage(signInError.message));
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
    return (
      <section className="card p-4">
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={name ? `Foto de ${name}` : "Foto do perfil"}
              className="size-16 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-16 place-items-center rounded-full bg-yellow text-xl font-extrabold text-on-accent">
              {initialOf(name, user.email ?? "")}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold">{name || "Sem nome"}</h1>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
        </div>
        <p className="mt-4 text-sm">{bio || "Sem bio ainda."}</p>
        {when ? <p className="mt-2 text-sm text-muted">{when}</p> : null}
        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={pending}
          className="mt-4 h-11 rounded-lg border border-line px-4 text-sm font-bold text-blue-ink disabled:opacity-60"
        >
          {pending ? "Saindo…" : "Sair"}
        </button>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <h1 className="text-lg font-extrabold">{mode === "entrar" ? "Entrar" : "Criar conta"}</h1>
      <p className="mt-1 text-sm text-muted">Entre com seu e-mail e senha.</p>
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
            className="mt-1 h-11 w-full rounded-lg border border-line bg-bg px-3 font-normal text-fg outline-none focus-visible:border-blue-ink"
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
            className="mt-1 h-11 w-full rounded-lg border border-line bg-bg px-3 font-normal text-fg outline-none focus-visible:border-blue-ink"
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
              className="mt-1 h-11 w-full rounded-lg border border-line bg-bg px-3 font-normal text-fg outline-none focus-visible:border-blue-ink"
            />
          </label>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-lg bg-blue px-3 py-2 text-sm font-semibold text-on-accent">
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
        }}
      >
        {mode === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
      </button>
    </section>
  );
}
