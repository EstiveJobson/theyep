"use client";

import { Heart, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AvatarImage } from "@/components/avatar-image";
import { subscribeSignedMedia } from "@/components/signed-media-refresh";
import { postPhotoPath } from "@/lib/avatar-path";
import { commentLabel, nextLikeCount } from "@/lib/engagement-rules";
import {
  imageAlreadyFailed,
  imageRetryOnError,
  imageRetryReset,
  type ImageRetryState,
} from "@/lib/image-retry";
import { formatRelativePt } from "@/lib/relative-time";
import type { FeedPost } from "@/server/posts";
import { deletePost, refreshPostPhoto } from "@/server/posts";
import { toggleLike } from "@/server/engagement";

function initialOf(name: string): string {
  return (name.trim().charAt(0) || "Y").toUpperCase();
}

export function PostCard({
  post,
  own,
  onDeleted,
  linkComments = true,
}: {
  post: FeedPost;
  own: boolean;
  onDeleted: (id: string) => void;
  linkComments?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const photoPath = postPhotoPath(post.photoUrl);
  const photoUrlProp = useRef(post.photoUrl);
  photoUrlProp.current = post.photoUrl;
  const [photoUrl, setPhotoUrl] = useState(post.photoUrl);
  const [photoBroken, setPhotoBroken] = useState(false);
  const retryState = useRef<ImageRetryState>(imageRetryReset());
  const photoRef = useRef<HTMLImageElement>(null);
  const openPhotoRef = useRef<HTMLImageElement>(null);
  const onPhotoErrorRef = useRef<() => void>(() => {});
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [likePending, setLikePending] = useState(false);
  const likeLock = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const time = formatRelativePt(post.createdAt);
  const meta = [post.schoolShortName, time].filter(Boolean).join(" · ");
  const commentsLabel = commentLabel(commentCount);

  useEffect(() => {
    setCommentCount(post.commentCount);
  }, [post.commentCount]);

  useEffect(() => {
    setPhotoUrl(photoUrlProp.current);
    setPhotoBroken(false);
    retryState.current = imageRetryReset();
  }, [post.id, photoPath]);

  useEffect(() => {
    const thumb = photoRef.current;
    if (imageAlreadyFailed(thumb)) onPhotoErrorRef.current();
  }, [photoUrl, photoPath]);

  useEffect(() => {
    if (!photoOpen) return;
    const open = openPhotoRef.current;
    if (imageAlreadyFailed(open)) onPhotoErrorRef.current();
  }, [photoOpen, photoUrl]);

  useEffect(() => {
    if (!photoPath) return;
    return subscribeSignedMedia("post", post.id, (next) => {
      retryState.current = imageRetryReset();
      if (next) {
        setPhotoUrl(next);
        setPhotoBroken(false);
      }
    });
  }, [post.id, photoPath]);

  useEffect(() => {
    setLiked(post.likedByMe);
    setLikeCount(post.likeCount);
  }, [post.id, post.likedByMe, post.likeCount]);

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

  onPhotoErrorRef.current = () => {
    const decision = imageRetryOnError(retryState.current);
    retryState.current = decision.state;
    if (decision.action === "fallback") {
      setPhotoBroken(true);
      return;
    }
    void refreshPostPhoto(post.id).then((result) => {
      if (!retryState.current.retried) return;
      if (result.ok) {
        setPhotoUrl(result.url);
        setPhotoBroken(false);
        return;
      }
      setPhotoBroken(true);
    });
  };

  function onPhotoError() {
    onPhotoErrorRef.current();
  }

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

  async function onLike() {
    if (likeLock.current) return;
    likeLock.current = true;
    setLikePending(true);
    setError("");
    const next = !liked;
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(next);
    setLikeCount(nextLikeCount(prevCount, next));
    const likeError = next
      ? "Não foi possível curtir. Tente de novo."
      : "Não foi possível desfazer a curtida. Tente de novo.";
    try {
      const result = await toggleLike(post.id, next);
      if (!result.ok) {
        setLiked(prevLiked);
        setLikeCount(prevCount);
        setError(likeError);
      }
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      setError(likeError);
    } finally {
      likeLock.current = false;
      setLikePending(false);
    }
  }

  return (
    <article className={`card relative p-4 ${menu ? "z-10" : ""}`}>
      <div className="flex items-start gap-2">
        <Link href={`/perfil/${post.author.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <AvatarImage
            profileId={post.author.id}
            src={post.author.avatarUrl}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover"
            fallback={
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-yellow text-sm font-extrabold text-on-accent">
                {initialOf(post.author.name)}
              </span>
            }
          />
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
      {photoUrl && !photoBroken ? (
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          className="mt-3 block w-full overflow-hidden rounded-lg"
          aria-label="Ver foto"
        >
          <img
            ref={photoRef}
            src={photoUrl}
            alt="Foto do post"
            loading="lazy"
            decoding="async"
            className="max-h-96 w-full bg-line object-contain"
            onError={onPhotoError}
          />
        </button>
      ) : null}
      {photoBroken || (post.photoMissing && !photoUrl) ? (
        <p className="mt-3 text-sm text-muted">Não foi possível carregar a foto.</p>
      ) : null}
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => void onLike()}
          disabled={likePending}
          aria-pressed={liked}
          aria-label={liked ? "Descurtir" : "Curtir"}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold disabled:opacity-60"
        >
          <Heart
            className={liked ? "size-5 fill-pink text-pink" : "size-5 fill-none text-fg"}
            aria-hidden
          />
          <span>{likeCount}</span>
        </button>
        {linkComments ? (
          <Link
            href={`/post/${post.id}`}
            className="inline-flex h-11 items-center rounded-lg px-2 text-sm font-bold text-muted"
          >
            {commentsLabel}
          </Link>
        ) : (
          <span className="inline-flex h-11 items-center px-2 text-sm font-bold text-muted">
            {commentsLabel}
          </span>
        )}
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent"
        >
          {error}
        </p>
      ) : null}
      {photoOpen && photoUrl && !photoBroken ? (
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
            ref={openPhotoRef}
            src={photoUrl}
            alt="Foto do post"
            className="max-h-[100dvh] max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
            onError={onPhotoError}
          />
        </div>
      ) : null}
    </article>
  );
}
