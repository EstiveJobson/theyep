"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { readFeedTab, rememberFeedTab, type FeedTab } from "@/lib/feed-tab";
import type { FeedCursor, FeedPost } from "@/server/posts";
import { loadFeed } from "@/server/posts";
import { PostCard } from "@/components/post-card";

const NOBODY_FOLLOWS =
  "Você ainda não segue ninguém. Toque no nome de alguém num post do Geral para ver o perfil e seguir.";

export function Feed({ viewerId, campusLabel }: { viewerId: string; campusLabel: string | null }) {
  const [tab, setTab] = useState<FeedTab | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");
  const [reload, setReload] = useState(0);
  const [followsNobody, setFollowsNobody] = useState(false);
  const request = useRef(0);
  const loadingMoreRef = useRef(false);
  const sentinel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTab(readFeedTab(Boolean(campusLabel)));
  }, [campusLabel]);

  useEffect(() => {
    if (!tab) return;
    const id = ++request.current;
    loadingMoreRef.current = false;
    setLoading(true);
    setLoadingMore(false);
    setError("");
    setMoreError("");
    setPosts([]);
    setCursor(null);
    setFollowsNobody(false);
    void loadFeed({ tab, cursor: null }).then((result) => {
      if (id !== request.current) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPosts(result.posts);
      setCursor(result.nextCursor);
      setFollowsNobody(result.followsNobody);
    });
  }, [tab, reload]);

  async function loadMore() {
    if (!tab || !cursor || loadingMoreRef.current) return;
    const id = request.current;
    const pageCursor = cursor;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreError("");
    const result = await loadFeed({ tab, cursor: pageCursor });
    loadingMoreRef.current = false;
    if (id !== request.current) return;
    setLoadingMore(false);
    if (!result.ok) {
      setMoreError(result.error);
      return;
    }
    setPosts((current) => [...current, ...result.posts]);
    setCursor(result.nextCursor);
  }

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // loadMore closes over the latest cursor; the sentinel effect re-binds when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, tab, loadingMore]);

  function choose(next: FeedTab) {
    if (next === tab) return;
    rememberFeedTab(next);
    setPosts([]);
    setCursor(null);
    setLoading(true);
    setError("");
    setTab(next);
  }

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Início</h1>
      {campusLabel ? (
        <div
          role="tablist"
          aria-label="Feeds"
          className="grid grid-cols-3 gap-1 rounded-lg bg-line p-1"
        >
          <TabButton selected={tab === "geral"} onClick={() => choose("geral")}>
            Geral
          </TabButton>
          <TabButton selected={tab === "campus"} onClick={() => choose("campus")}>
            {campusLabel}
          </TabButton>
          <TabButton selected={tab === "seguindo"} onClick={() => choose("seguindo")}>
            Seguindo
          </TabButton>
        </div>
      ) : (
        <div
          role="tablist"
          aria-label="Feeds"
          className="grid grid-cols-2 gap-1 rounded-lg bg-line p-1"
        >
          <TabButton selected={tab === "geral"} onClick={() => choose("geral")}>
            Geral
          </TabButton>
          <TabButton selected={tab === "seguindo"} onClick={() => choose("seguindo")}>
            Seguindo
          </TabButton>
        </div>
      )}
      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando posts">
          <Skeleton />
          <Skeleton />
        </div>
      ) : null}
      {!loading && error ? (
        <section className="card px-6 py-10 text-center">
          <p role="alert" className="font-semibold">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="mt-4 h-11 rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
          >
            Tentar de novo
          </button>
        </section>
      ) : null}
      {!loading && !error && posts.length === 0 ? (
        <section className="card px-6 py-10 text-center">
          {tab === "seguindo" && followsNobody ? (
            <h2 className="text-lg font-extrabold">{NOBODY_FOLLOWS}</h2>
          ) : tab === "seguindo" ? (
            <h2 className="text-lg font-extrabold">Ainda não tem nada aqui.</h2>
          ) : (
            <h2 className="text-lg font-extrabold">
              Ainda não tem nada aqui. Que tal fazer o{" "}
              <Link href="/postar" className="text-blue-ink">
                primeiro post
              </Link>
              ?
            </h2>
          )}
        </section>
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
        <p
          role="alert"
          className="rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent"
        >
          {moreError}
        </p>
      ) : null}
      {cursor && !loading ? (
        <button
          ref={sentinel}
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="h-11 w-full rounded-lg border border-line text-sm font-bold text-blue-ink disabled:opacity-60"
        >
          {loadingMore ? "Carregando…" : "Carregar mais"}
        </button>
      ) : null}
    </div>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={
        "min-h-11 min-w-0 truncate rounded-md px-2 text-sm font-extrabold " +
        (selected ? "bg-card text-fg shadow-sm" : "text-muted")
      }
    >
      {children}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="card animate-pulse p-4" aria-hidden="true">
      <div className="flex gap-3">
        <div className="size-10 rounded-full bg-line" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-32 rounded bg-line" />
          <div className="h-3 w-20 rounded bg-line" />
        </div>
      </div>
      <div className="mt-4 h-4 w-full rounded bg-line" />
      <div className="mt-2 h-4 w-2/3 rounded bg-line" />
    </div>
  );
}
