"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { FeedCursor } from "@/lib/feed-cursor";
import { LIST_ERROR, type FollowDirection, type FollowPerson } from "@/lib/follows";
import { AvatarImage } from "@/components/avatar-image";
import { loadFollowList } from "@/server/follows";

function initialOf(name: string): string {
  return (name.trim().charAt(0) || "Y").toUpperCase();
}

export function FollowList({
  profileId,
  direction,
  initialPeople,
  initialCursor,
  initialError,
}: {
  profileId: string;
  direction: FollowDirection;
  initialPeople: FollowPerson[];
  initialCursor: FeedCursor | null;
  initialError: string;
}) {
  const [people, setPeople] = useState(initialPeople);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState(initialError);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);

  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setLoading(true);
    setError("");
    setMoreError("");
    try {
      const result = await loadFollowList({ profileId, direction, cursor: null });
      if (!result.ok) {
        setError(LIST_ERROR);
        return;
      }
      setPeople(result.people);
      setCursor(result.nextCursor);
    } catch {
      setError(LIST_ERROR);
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor || lock.current) return;
    lock.current = true;
    setLoadingMore(true);
    setMoreError("");
    try {
      const result = await loadFollowList({ profileId, direction, cursor });
      if (!result.ok) {
        setMoreError(LIST_ERROR);
        return;
      }
      setPeople((current) => [...current, ...result.people]);
      setCursor(result.nextCursor);
    } catch {
      setMoreError(LIST_ERROR);
    } finally {
      lock.current = false;
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="card animate-pulse p-4" aria-busy="true" aria-label="Carregando lista">
        <div className="h-4 w-40 rounded bg-line" />
      </div>
    );
  }

  if (error) {
    return (
      <section className="card px-6 py-10 text-center">
        <p role="alert" className="font-semibold">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-4 h-11 rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
        >
          Tentar de novo
        </button>
      </section>
    );
  }

  if (people.length === 0) {
    return <p className="card px-4 py-6 text-center text-sm text-muted">Ninguém por aqui ainda.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="card divide-y divide-line">
        {people.map((person) => (
          <li key={person.id}>
            <Link href={`/perfil/${person.id}`} className="flex items-center gap-3 px-4 py-3">
              {person.avatarUrl ? (
                <AvatarImage
                  profileId={person.id}
                  src={person.avatarUrl}
                  alt=""
                  className="size-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-yellow text-sm font-extrabold text-on-accent">
                  {initialOf(person.name)}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-extrabold">{person.name}</span>
                {person.schoolShortName ? (
                  <span className="block truncate text-sm text-muted">
                    {person.schoolShortName}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {moreError ? (
        <div className="space-y-2">
          <p
            role="alert"
            className="rounded-lg bg-yellow px-3 py-2 text-sm font-semibold text-on-accent"
          >
            {moreError}
          </p>
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="h-11 w-full rounded-lg border border-line text-sm font-bold text-blue-ink disabled:opacity-60"
          >
            {loadingMore ? "Carregando…" : "Tentar de novo"}
          </button>
        </div>
      ) : null}
      {cursor && !moreError ? (
        <button
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
