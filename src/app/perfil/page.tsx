import { AuthorPosts } from "@/components/author-posts";
import { PerfilPanel } from "@/components/perfil-panel";
import type { FollowStats } from "@/lib/follows";
import { getViewer } from "@/lib/viewer";
import { getFollowStats } from "@/server/follows";

export default async function PerfilPage() {
  const { user } = await getViewer();
  let followStats: FollowStats | null = null;
  if (user) {
    const stats = await getFollowStats(user.id);
    if (stats.ok) followStats = stats.stats;
  }
  return (
    <div className="space-y-3">
      <PerfilPanel followStats={followStats} />
      {user ? <AuthorPosts authorId={user.id} viewerId={user.id} /> : null}
    </div>
  );
}
