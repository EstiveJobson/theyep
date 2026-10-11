import Link from "next/link";
import { notFound } from "next/navigation";
import { PostThread } from "@/components/post-thread";
import { isUuid } from "@/lib/ids";
import { loadPostPage } from "@/server/engagement";
import { getViewer } from "@/lib/viewer";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getViewer();

  if (!supabase) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Post ainda não ligado</h1>
        <p className="mt-2 text-muted">Falta configurar o Supabase.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Entre para ver o post</h1>
        <p className="mt-2 text-muted">Curtidas e comentários aparecem depois do login.</p>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
        >
          Entrar
        </Link>
      </section>
    );
  }

  if (!isUuid(id)) notFound();

  const result = await loadPostPage(id);
  if (!result.ok) {
    if (result.notFound) notFound();
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Não foi possível carregar o post</h1>
        <p className="mt-2 text-muted">{result.error}</p>
      </section>
    );
  }

  return (
    <PostThread
      viewerId={user.id}
      post={result.post}
      initialComments={result.comments}
      initialCursor={result.nextCursor}
    />
  );
}
