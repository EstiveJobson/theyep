"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formatRelativePt } from "@/lib/relative-time";
import type { FeedPost } from "@/server/posts";
import { deletePost } from "@/server/posts";

function initialOf(name: string): string {
  return (name.trim().charAt(0) || "Y").toUpperCase();
}

export function PostCard({
  post,
  own,
  onDeleted,
}: {
  post: FeedPost;
  own: boolean;
  onDeleted: (id: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const time = formatRelativePt(post.createdAt);
  const meta = [post.schoolShortName, time].filter(Boolean).join(" · ");

  useEffect(() => {
    if (!menu) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenu(false);
        setConfirming(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (!photoOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPhotoOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [photoOpen]);

  async function remove() {
    setPending(true);
    setError("");
    const result = await deletePost(post.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDeleted(post.id);
  }

  return (
    <article className={`card relative p-4 ${menu ? "z-10" : ""}`}>
      <div className="flex items-start gap-2">
        <Link href={`/perfil/${post.author.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          {post.author.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt=""
              className="size-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-yellow text-sm font-extrabold text-on-accent">
              {initialOf(post.author.name)}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-extrabold">{post.author.name}</span>
            {meta ? <span className="block truncate text-sm text-muted">{meta}</span> : null}
          </span>
        </Link>
        {own ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Mais opções"
              aria-expanded={menu}
              onClick={() => {
                setMenu((open) => !open);
                setConfirming(false);
                setError("");
              }}
              className="grid size-11 place-items-center rounded-full text-muted hover:bg-line"
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
            {menu ? (
              <div className="absolute right-0 z-20 w-64 rounded-lg border border-line bg-card p-2 shadow-md">
                {confirming ? (
                  <div role="alertdialog" aria-labelledby={titleId}>
                    <p id={titleId} className="px-2 py-1 text-sm font-semibold">
                      Apagar este post? Isso não pode ser desfeito.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void remove()}
                        disabled={pending}
                        className="h-11 flex-1 rounded-lg bg-pink text-sm font-extrabold text-on-accent disabled:opacity-60"
                      >
                        {pending ? "Apagando…" : "Apagar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        disabled={pending}
                        className="h-11 flex-1 rounded-lg border border-line text-sm font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="min-h-11 w-full rounded-lg px-2 text-left text-sm font-bold hover:bg-line"
                  >
                    Apagar post
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {post.text ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-snug">{post.text}</p>
      ) : null}
      {post.photoUrl ? (
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          className="mt-3 block w-full overflow-hidden rounded-lg"
          aria-label="Ver foto"
        >
          <img
            src={post.photoUrl}
            alt="Foto do post"
            loading="lazy"
            decoding="async"
            className="max-h-96 w-full bg-line object-contain"
          />
        </button>
      ) : null}
      {post.photoMissing ? (
        <p className="mt-3 text-sm text-muted">Não foi possível carregar a foto.</p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-3 min-h-8" aria-hidden="true" />
      {photoOpen && post.photoUrl ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Foto do post"
          onClick={() => setPhotoOpen(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 h-11 rounded-lg bg-card px-4 text-sm font-bold"
            onClick={() => setPhotoOpen(false)}
          >
            Fechar
          </button>
          <img
            src={post.photoUrl}
            alt="Foto do post"
            className="max-h-[100dvh] max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </article>
  );
}
