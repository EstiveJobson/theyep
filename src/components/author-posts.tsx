"use client";

import { useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post-card";
import type { FeedCursor } from "@/lib/feed-cursor";
import { loadAuthorPosts } from "@/server/engagement";
import type { FeedPost } from "@/server/posts";

export function AuthorPosts({ authorId, viewerId }: { authorId: string; viewerId: string }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");
  const [reload, setReload] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    const id = ++request.current;
    setLoading(true);
    setError("");
    setMoreError("");
    setPosts([]);
    setCursor(null);
    void loadAuthorPosts({ authorId, cursor: null }).then((result) => {
      if (id !== request.current) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPosts(result.posts);
      setCursor(result.nextCursor);
    });
  }, [authorId, reload]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError("");
    const result = await loadAuthorPosts({ authorId, cursor });
    setLoadingMore(false);
    if (!result.ok) {
      setMoreError(result.error);
      return;
    }
    setPosts((current) => [...current, ...result.posts]);
    setCursor(result.nextCursor);
  }

  return (
    <section className="space-y-3" aria-label="Posts">
      <h2 className="text-base font-extrabold">Posts</h2>
      {loading ? (
        <div className="card animate-pulse p-4" aria-busy="true" aria-label="Carregando posts">
          <div className="h-4 w-40 rounded bg-line" />
          <div className="mt-3 h-4 w-full rounded bg-line" />
        </div>
      ) : null}
      {!loading && error ? (
        <div className="card px-4 py-6 text-center">
          <p role="alert" className="font-semibold">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="mt-3 h-11 rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
          >
            Tentar de novo
          </button>
        </div>
      ) : null}
      {!loading && !error && posts.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">Nenhum post ainda.</p>
      ) : null}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          own={post.author.id === viewerId}
          onDeleted={(id) => setPosts((current) => current.filter((item) => item.id !== id))}
        />
      ))}
      {moreError ? (
        <p role="alert" className="rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent">
          {moreError}
        </p>
      ) : null}
      {cursor && !loading ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="h-11 w-full rounded-lg border border-line text-sm font-bold text-blue-ink disabled:opacity-60"
        >
          {loadingMore ? "Carregando…" : "Carregar mais"}
        </button>
      ) : null}
    </section>
  );
}
