import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicProfile } from "@/components/public-profile";
import type { FollowStats } from "@/lib/follows";
import { isUuid } from "@/lib/ids";
import { joinedLabel } from "@/lib/relative-time";
import { signAvatarDisplayUrl } from "@/lib/avatar-url";
import { firstRelation } from "@/lib/relation";
import { getViewer } from "@/lib/viewer";
import { getFollowStats } from "@/server/follows";

type ProfileRow = {
  id: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  created_at: string;
  schools: { short_name: string } | { short_name: string }[] | null;
};

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { supabase, user } = await getViewer();
  if (!supabase) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Perfil ainda não ligado</h1>
        <p className="mt-2 text-muted">Falta configurar o Supabase.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Entre para ver o perfil</h1>
        <p className="mt-2 text-muted">O perfil aparece depois do login.</p>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
        >
          Entrar
        </Link>
      </section>
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, bio, avatar_url, created_at, schools(short_name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Não foi possível carregar o perfil</h1>
      </section>
    );
  }

  const profile = data as ProfileRow | null;
  if (!profile) notFound();

  let blockedByMe = false;
  if (user && user.id !== profile.id) {
    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", profile.id)
      .maybeSingle();
    if (blockError) {
      return (
        <section className="card px-6 py-10 text-center">
          <h1 className="text-lg font-extrabold">Não foi possível carregar o perfil</h1>
        </section>
      );
    }
    blockedByMe = Boolean(block);
  }

  const name = profile.name.trim() || "Sem nome";
  const avatarUrl = await signAvatarDisplayUrl(supabase, profile.avatar_url);
  if (blockedByMe) {
    return (
      <PublicProfile
        profile={{
          id: profile.id,
          name,
          avatarUrl,
        }}
        viewerId={user?.id ?? null}
        blockedByMe
        followStats={null}
      />
    );
  }

  const school = firstRelation(profile.schools)?.short_name?.trim() || "";
  const when = profile.created_at ? joinedLabel(profile.created_at) : "";
  let followStats: FollowStats | null = null;
  if (user) {
    const stats = await getFollowStats(profile.id);
    if (stats.ok) followStats = stats.stats;
  }

  return (
    <PublicProfile
      profile={{
        id: profile.id,
        name,
        avatarUrl,
        bio: profile.bio,
        school,
        joined: when,
      }}
      viewerId={user?.id ?? null}
      blockedByMe={false}
      followStats={followStats}
    />
  );
}
