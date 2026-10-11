"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { followerLabel, followingLabel, type FollowStats } from "@/lib/follows";
import { getFollowStats, setFollow } from "@/server/follows";

export function ProfileSocial({
  profileId,
  viewerId,
  initial,
}: {
  profileId: string;
  viewerId: string;
  initial: FollowStats | null;
}) {
  const router = useRouter();
  const [stats, setStats] = useState<FollowStats | null>(initial);
  const [loading, setLoading] = useState(initial === null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const own = viewerId === profileId;

  useEffect(() => {
    if (lock.current) return;
    setStats(initial);
    if (initial) setLoading(false);
  }, [initial]);

  useEffect(() => {
    if (initial) return;
    let alive = true;
    setLoading(true);
    setError("");
    void getFollowStats(profileId).then((result) => {
      if (!alive) return;
      setLoading(false);
      if (!result.ok) {
        setError("Não foi possível carregar os seguidores.");
        return;
      }
      if (!lock.current) setStats(result.stats);
    });
    return () => {
      alive = false;
    };
  }, [initial, profileId]);

  async function onToggle() {
    if (!stats || own || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    const next = !stats.viewerFollows;
    const prev = stats;
    setStats({
      ...stats,
      viewerFollows: next,
      followers: Math.max(0, stats.followers + (next ? 1 : -1)),
    });
    const message = next
      ? "Não foi possível seguir este perfil."
      : "Não foi possível deixar de seguir. Tente de novo.";
    try {
      const result = await setFollow(profileId, next);
      if (!result.ok) {
        setStats(prev);
        setError(message);
      } else {
        router.refresh();
      }
    } catch {
      setStats(prev);
      setError(message);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  if (loading && !stats) {
    return (
      <div
        className="mt-4 h-11 animate-pulse rounded-lg bg-line"
        aria-busy="true"
        aria-hidden="true"
      />
    );
  }

  if (!stats) {
    return error ? (
      <p role="alert" className="mt-4 text-sm font-semibold text-blue-ink">
        {error}
      </p>
    ) : null;
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/perfil/${profileId}/seguidores`}
          className="inline-flex h-11 items-center text-sm font-extrabold"
        >
          {followerLabel(stats.followers)}
        </Link>
        <Link
          href={`/perfil/${profileId}/seguindo`}
          className="inline-flex h-11 items-center text-sm font-extrabold"
        >
          {followingLabel(stats.following)}
        </Link>
        {own ? null : (
          <button
            type="button"
            aria-pressed={stats.viewerFollows}
            disabled={pending}
            onClick={() => void onToggle()}
            className={
              "ml-auto h-11 rounded-lg px-4 text-sm font-extrabold disabled:opacity-60 " +
              (stats.viewerFollows ? "border border-pink text-pink" : "bg-pink text-on-accent")
            }
          >
            {stats.viewerFollows ? "Seguindo" : "Seguir"}
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-blue-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
