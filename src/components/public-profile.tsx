"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthorPosts } from "@/components/author-posts";
import { AvatarImage } from "@/components/avatar-image";
import { ProfileSocial } from "@/components/profile-social";
import type { FollowStats } from "@/lib/follows";
import { setBlock } from "@/server/blocks";

const BLOCK_ERROR = "Não foi possível bloquear. Tente de novo.";
const UNBLOCK_ERROR = "Não foi possível desbloquear. Tente de novo.";

type ProfileView = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio?: string;
  school?: string;
  joined?: string;
};

export function PublicProfile({
  profile,
  viewerId,
  blockedByMe,
  followStats,
}: {
  profile: ProfileView;
  viewerId: string | null;
  blockedByMe: boolean;
  followStats: FollowStats | null;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(blockedByMe);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const titleId = useId();
  const own = viewerId === profile.id;
  const details = "bio" in profile ? profile : null;

  useEffect(() => {
    if (lock.current) return;
    setBlocked(blockedByMe);
  }, [blockedByMe]);

  async function changeBlock(next: boolean) {
    if (!viewerId || own || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    const prev = blocked;
    setBlocked(next);
    setMenu(false);
    setConfirming(false);
    const message = next ? BLOCK_ERROR : UNBLOCK_ERROR;
    try {
      const result = await setBlock(profile.id, next);
      if (!result.ok) {
        setBlocked(prev);
        setError(message);
      } else {
        router.refresh();
      }
    } catch {
      setBlocked(prev);
      setError(message);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  const photo = (
    <AvatarImage
      profileId={profile.id}
      src={profile.avatarUrl}
      alt={profile.name === "Sem nome" ? "Foto do perfil" : `Foto de ${profile.name}`}
      className="size-16 rounded-full object-cover"
      fallback={
        <span className="grid size-16 place-items-center rounded-full bg-yellow text-xl font-extrabold text-on-accent">
          {(profile.name.charAt(0) || "Y").toUpperCase()}
        </span>
      }
    />
  );

  if (blocked) {
    return (
      <section className="card p-4">
        <div className="flex items-center gap-3">
          {photo}
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">{profile.name}</h1>
          <button
            type="button"
            onClick={() => void changeBlock(false)}
            disabled={pending}
            className="h-11 shrink-0 rounded-lg border border-line px-4 text-sm font-bold text-blue-ink disabled:opacity-60"
          >
            {pending ? "Aguarde…" : "Desbloquear"}
          </button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-blue-ink">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <section className="card p-4">
        <div className="flex items-start gap-3">
          {photo}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold">{profile.name}</h1>
            {details?.school ? (
              <p className="truncate text-sm text-muted">{details.school}</p>
            ) : null}
          </div>
          {viewerId && !own ? (
            <div className="relative">
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
            </div>
          ) : null}
        </div>
        {menu && viewerId && !own ? (
          <div className="mt-3 rounded-lg border border-line p-3">
            {confirming ? (
              <div role="alertdialog" aria-labelledby={titleId}>
                <p id={titleId} className="text-sm font-semibold">
                  Bloquear {profile.name}? Vocês deixam de se seguir e não vão mais ver os posts um
                  do outro. A pessoa não é avisada.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void changeBlock(true)}
                    disabled={pending}
                    className="h-11 flex-1 rounded-lg bg-pink text-sm font-extrabold text-on-accent disabled:opacity-60"
                  >
                    {pending ? "Aguarde…" : "Bloquear"}
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
                Bloquear
              </button>
            )}
          </div>
        ) : null}
        {viewerId ? (
          <ProfileSocial profileId={profile.id} viewerId={viewerId} initial={followStats} />
        ) : null}
        {details?.bio !== undefined ? (
          <p className="mt-4 whitespace-pre-wrap break-words text-sm">
            {details.bio.trim() || "Sem bio ainda."}
          </p>
        ) : null}
        {details?.joined ? <p className="mt-2 text-sm text-muted">{details.joined}</p> : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-blue-ink">
            {error}
          </p>
        ) : null}
      </section>
      {viewerId ? <AuthorPosts authorId={profile.id} viewerId={viewerId} /> : null}
    </div>
  );
}
