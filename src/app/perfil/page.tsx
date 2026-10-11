import { AuthorPosts } from "@/components/author-posts";
import { PerfilPanel } from "@/components/perfil-panel";
import { getViewer } from "@/lib/viewer";

export default async function PerfilPage() {
  const { user } = await getViewer();
  return (
    <div className="space-y-3">
      <PerfilPanel />
      {user ? <AuthorPosts authorId={user.id} viewerId={user.id} /> : null}
    </div>
  );
}
