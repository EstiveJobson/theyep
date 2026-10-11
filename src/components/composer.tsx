"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { compressPhoto, photoRejection } from "@/lib/compress-photo";
import { rememberFeedTab } from "@/lib/feed-tab";
import { getBrowserClient } from "@/lib/supabase/client";
import { createPost } from "@/server/posts";

const MAX = 500;

function charCount(value: string): number {
  return [...value].length;
}

function uploadMessage(message: string): string {
  const text = message.toLowerCase();
  if (
    text.includes("size") ||
    text.includes("exceeded") ||
    text.includes("large") ||
    text.includes("payload")
  ) {
    return "Essa foto ficou grande demais. Tente outra.";
  }
  if (text.includes("mime") || text.includes("content type") || text.includes("invalid")) {
    return "Por enquanto só dá para postar fotos.";
  }
  if (text.includes("fetch") || text.includes("network") || text.includes("failed")) {
    return "Sem conexão. Tente de novo.";
  }
  return "Não foi possível enviar a foto. Tente de novo.";
}

export function Composer({ schoolName }: { schoolName: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [toGeneral, setToGeneral] = useState(true);
  const [toCampus, setToCampus] = useState(Boolean(schoolName));
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const count = charCount(text);

  function replacePhoto(next: { blob: Blob; url: string } | null) {
    setPhoto((current) => {
      if (current && current !== next) URL.revokeObjectURL(current.url);
      return next;
    });
    if (!next && fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    setError("");
    if (!file) return;
    const rejected = photoRejection(file);
    if (rejected) {
      setError(rejected);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setPreparing(true);
    try {
      const blob = await compressPhoto(file);
      replacePhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("Não foi possível preparar essa foto. Use JPEG, PNG ou WebP.");
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onText(value: string) {
    const chars = [...value];
    setText(chars.length > MAX ? chars.slice(0, MAX).join("") : value);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (preparing || pending) return;

    const body = text.trim();
    const campus = Boolean(schoolName) && toCampus;
    const general = schoolName ? toGeneral : true;
    if (!body && !photo) {
      setError("Escreva algo ou escolha uma foto.");
      return;
    }
    if (!general && !campus) {
      setError("Escolha onde publicar.");
      return;
    }

    const supabase = getBrowserClient();
    if (!supabase) {
      setError("O login ainda não está ligado. Falta configurar o Supabase.");
      return;
    }

    setPending(true);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setPending(false);
      setError("Entre para publicar.");
      return;
    }

    let photoPath: string | null = null;
    if (photo) {
      photoPath = `${auth.user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("post-photos")
        .upload(photoPath, photo.blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) {
        setPending(false);
        setError(uploadMessage(uploadError.message));
        return;
      }
    }

    const result = await createPost({
      text: body,
      photoPath,
      toGeneral: general,
      toCampus: campus,
    });

    if (!result.ok) {
      if (photoPath) await supabase.storage.from("post-photos").remove([photoPath]);
      setPending(false);
      setError(result.error);
      return;
    }

    rememberFeedTab(general ? "geral" : "campus");
    router.push("/");
    router.refresh();
  }

  return (
    <form className="card space-y-3 p-4" onSubmit={onSubmit} noValidate>
      <h1 className="text-lg font-extrabold">Novo post</h1>
      <label className="block text-sm font-semibold" htmlFor="post-text">
        Texto
        <textarea
          id="post-text"
          name="text"
          rows={4}
          value={text}
          onChange={(event) => onText(event.target.value)}
          placeholder="No que você está pensando?"
          className="mt-1 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 font-normal text-fg outline-none focus-visible:border-blue-ink"
        />
      </label>
      <p id="post-count" className="text-right text-sm text-muted" aria-live="polite">
        {count}/500
      </p>
      {photo ? (
        <div className="overflow-hidden rounded-lg border border-line">
          <img src={photo.url} alt="Prévia da foto" className="max-h-80 w-full object-contain" />
          <button
            type="button"
            onClick={() => replacePhoto(null)}
            disabled={pending}
            className="min-h-11 w-full border-t border-line text-sm font-bold text-blue-ink disabled:opacity-60"
          >
            Remover
          </button>
        </div>
      ) : null}
      {photo ? null : (
        <div>
          <input
            ref={fileRef}
            id="post-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="sr-only"
            disabled={preparing || pending}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <label
            htmlFor="post-photo"
            className={
              "inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-bold text-blue-ink " +
              (preparing || pending ? "pointer-events-none opacity-60" : "")
            }
          >
            {preparing ? "Preparando foto…" : "Adicionar foto"}
          </label>
        </div>
      )}
      <fieldset>
        <legend className="text-sm font-extrabold">Publicar em</legend>
        <div className="mt-2 space-y-1">
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={schoolName ? toGeneral : true}
              disabled={!schoolName}
              onChange={(event) => setToGeneral(event.target.checked)}
              className="size-5 accent-pink disabled:opacity-60"
            />
            Geral
          </label>
          {schoolName ? (
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={toCampus}
                onChange={(event) => setToCampus(event.target.checked)}
                className="size-5 accent-pink"
              />
              Campus – {schoolName}
            </label>
          ) : null}
        </div>
      </fieldset>
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || preparing}
        className="h-11 w-full rounded-lg bg-pink text-sm font-extrabold text-on-accent disabled:opacity-60"
      >
        {pending ? "Publicando…" : "Publicar"}
      </button>
    </form>
  );
}
