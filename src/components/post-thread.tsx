"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { PostCard } from "@/components/post-card";
import { COMMENT_MAX, canDeleteComment, charCount, commentError, normalizeComment } from "@/lib/engagement-rules";
import { formatRelativePt } from "@/lib/relative-time";
import { createComment, deleteComment, loadMoreComments, type CommentItem } from "@/server/engagement";
import type { FeedCursor } from "@/lib/feed-cursor";
import type { FeedPost } from "@/server/posts";

function initialOf(name: string): string {
  return (name.trim().charAt(0) || "Y").toUpperCase();
}

function byTime(a: CommentItem, b: CommentItem): number {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function PostThread({
  viewerId,
  post: initialPost,
  initialComments,
  initialCursor,
}: {
  viewerId: string;
  post: FeedPost;
  initialComments: CommentItem[];
  initialCursor: FeedCursor | null;
}) {
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState(initialComments);
  const [extra, setExtra] = useState<CommentItem[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const extraRef = useRef(extra);
  extraRef.current = extra;
  const count = charCount(text);

  function bump(delta: number) {
    setPost((current) => ({
      ...current,
      commentCount: Math.max(0, current.commentCount + delta),
    }));
  }

  function remember(comment: CommentItem) {
    bump(1);
    if (!cursor) {
      setComments((current) =>
        current.some((item) => item.id === comment.id) ? current : [...current, comment].sort(byTime),
      );
      return;
    }
    setExtra((current) =>
      current.some((item) => item.id === comment.id) ? current : [...current, comment],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    const body = normalizeComment(text);
    const invalid = commentError(body);
    if (invalid) {
      setError(invalid);
      return;
    }
    setPending(true);
    const result = await createComment(post.id, body);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setText("");
    remember(result.comment);
  }

  async function onMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError("");
    const result = await loadMoreComments({ postId: post.id, cursor });
    setLoadingMore(false);
    if (!result.ok) {
      setMoreError(result.error);
      return;
    }
    const arrived = new Set(result.comments.map((item) => item.id));
    const stillExtra = extraRef.current.filter((item) => !arrived.has(item.id));
    setComments((current) => {
      const ids = new Set(current.map((item) => item.id));
      const added = result.comments.filter((item) => !ids.has(item.id));
      const tail = result.nextCursor ? [] : stillExtra.filter((item) => !ids.has(item.id));
      return [...current, ...added, ...tail].sort(byTime);
    });
    setExtra(result.nextCursor ? stillExtra : []);
    setCursor(result.nextCursor);
  }

  function onDeleted(id: string) {
    setComments((current) => current.filter((item) => item.id !== id));
    setExtra((current) => current.filter((item) => item.id !== id));
    bump(-1);
  }

  const shown = comments.length + extra.length;

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Post</h1>
      <PostCard
        post={post}
        own={post.author.id === viewerId}
        linkComments={false}
        onDeleted={() => {
          router.push("/");
          router.refresh();
        }}
      />
      <section className="card p-4" aria-label="Comentários">
        {shown === 0 ? <p className="text-sm text-muted">Nenhum comentário ainda.</p> : null}
        <ul className="space-y-4">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              canDelete={canDeleteComment(viewerId, comment.author.id, post.author.id)}
              onDeleted={onDeleted}
            />
          ))}
        </ul>
        {moreError ? (
          <p role="alert" className="mt-3 rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent">
            {moreError}
          </p>
        ) : null}
        {cursor ? (
          <button
            type="button"
            onClick={() => void onMore()}
            disabled={loadingMore}
            className="mt-3 h-11 w-full rounded-lg border border-line text-sm font-bold text-blue-ink disabled:opacity-60"
          >
            {loadingMore ? "Carregando…" : "Ver mais"}
          </button>
        ) : null}
        {extra.length > 0 ? (
          <ul className={cursor ? "mt-4 space-y-4" : "space-y-4"}>
            {extra.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                canDelete={canDeleteComment(viewerId, comment.author.id, post.author.id)}
                onDeleted={onDeleted}
              />
            ))}
          </ul>
        ) : null}
        <form className="mt-4 space-y-2" onSubmit={onSubmit} noValidate>
          <label className="block text-sm font-semibold" htmlFor="comment-text">
            Comentário
            <textarea
              id="comment-text"
              name="comment"
              rows={3}
              value={text}
              onChange={(event) => {
                const chars = [...event.target.value];
                setText(chars.length > COMMENT_MAX ? chars.slice(0, COMMENT_MAX).join("") : event.target.value);
              }}
              placeholder="Escreva um comentário…"
              className="mt-1 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 font-normal text-fg outline-none focus-visible:border-blue-ink"
            />
          </label>
          <p className="text-right text-sm text-muted" aria-live="polite">
            {count}/300
          </p>
          {error ? (
            <p role="alert" className="rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-lg bg-pink text-sm font-extrabold text-on-accent disabled:opacity-60"
          >
            {pending ? "Enviando…" : "Comentar"}
          </button>
        </form>
      </section>
    </div>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDeleted,
}: {
  comment: CommentItem;
  canDelete: boolean;
  onDeleted: (id: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const time = formatRelativePt(comment.createdAt);

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

  async function remove() {
    setPending(true);
    setError("");
    const result = await deleteComment(comment.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDeleted(comment.id);
  }

  return (
    <li className="flex items-start gap-2">
      <Link href={`/perfil/${comment.author.id}`} className="shrink-0">
        {comment.author.avatarUrl ? (
          <img src={comment.author.avatarUrl} alt="" className="size-9 rounded-full object-cover" />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-yellow text-sm font-extrabold text-on-accent">
            {initialOf(comment.author.name)}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1">
            <Link href={`/perfil/${comment.author.id}`} className="font-extrabold">
              {comment.author.name}
            </Link>
            {time ? <span className="ml-2 text-sm text-muted">{time}</span> : null}
          </p>
          {canDelete ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label="Mais opções do comentário"
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
                        Apagar este comentário?
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
                      Apagar comentário
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{comment.text}</p>
        {error ? (
          <p role="alert" className="mt-2 rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}
