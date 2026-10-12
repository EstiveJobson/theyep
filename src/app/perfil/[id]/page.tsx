import { notFound } from "next/navigation";
import { PublicProfile } from "@/components/public-profile";
import type { FollowStats } from "@/lib/follows";
import { isUuid } from "@/lib/ids";
import { joinedLabel } from "@/lib/relative-time";
import { firstRelation } from "@/lib/relation";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  if (!supabase) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Perfil ainda não ligado</h1>
        <p className="mt-2 text-muted">Falta configurar o Supabase.</p>
      </section>
    );
  }

  const { user } = await getViewer();
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
  if (blockedByMe) {
    return (
      <PublicProfile
        profile={{
          id: profile.id,
          name,
          avatarUrl: profile.avatar_url,
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
        avatarUrl: profile.avatar_url,
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
