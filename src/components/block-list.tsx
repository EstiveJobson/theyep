"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AvatarImage } from "@/components/avatar-image";
import type { BlockedPerson } from "@/lib/blocks";
import type { FeedCursor } from "@/lib/feed-cursor";
import { loadBlocks, setBlock } from "@/server/blocks";

const LIST_ERROR = "Não foi possível carregar a lista. Tente de novo.";
const UNBLOCK_ERROR = "Não foi possível desbloquear. Tente de novo.";

function initialOf(name: string): string {
  return (name.trim().charAt(0) || "Y").toUpperCase();
}

export function BlockList({
  initialPeople,
  initialCursor,
  initialError,
}: {
  initialPeople: BlockedPerson[];
  initialCursor: FeedCursor | null;
  initialError: string;
}) {
  const [people, setPeople] = useState(initialPeople);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");
  const lock = useRef(false);

  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setLoading(true);
    setError("");
    setMoreError("");
    try {
      const result = await loadBlocks({ cursor: null });
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
      const result = await loadBlocks({ cursor });
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

  async function unblock(person: BlockedPerson) {
    if (lock.current) return;
    lock.current = true;
    setPendingId(person.id);
    setRowError("");
    const prev = people;
    setPeople((current) => current.filter((item) => item.id !== person.id));
    try {
      const result = await setBlock(person.id, false);
      if (!result.ok) {
        setPeople(prev);
        setRowError(UNBLOCK_ERROR);
      }
    } catch {
      setPeople(prev);
      setRowError(UNBLOCK_ERROR);
    } finally {
      lock.current = false;
      setPendingId(null);
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
    return (
      <p className="card px-4 py-6 text-center text-sm text-muted">Você não bloqueou ninguém.</p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="card divide-y divide-line">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/perfil/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <AvatarImage
                profileId={person.id}
                src={person.avatarUrl}
                alt=""
                className="size-10 shrink-0 rounded-full object-cover"
                fallback={
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-yellow text-sm font-extrabold text-on-accent">
                    {initialOf(person.name)}
                  </span>
                }
              />
              <span className="truncate font-extrabold">{person.name}</span>
            </Link>
            <button
              type="button"
              onClick={() => void unblock(person)}
              disabled={pendingId === person.id}
              className="h-11 shrink-0 rounded-lg border border-line px-3 text-sm font-bold text-blue-ink disabled:opacity-60"
            >
              {pendingId === person.id ? "Aguarde…" : "Desbloquear"}
            </button>
          </li>
        ))}
      </ul>
      {rowError ? (
        <p role="alert" className="text-sm font-semibold text-blue-ink">
          {rowError}
        </p>
      ) : null}
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
