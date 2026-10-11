import Link from "next/link";
import { Feed } from "@/components/feed";
import { getViewer } from "@/lib/viewer";

export default async function HomePage() {
  const { supabase, user, school } = await getViewer();

  if (!supabase) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Feed ainda não ligado</h1>
        <p className="mt-2 text-muted">Falta configurar o Supabase.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Entre para ver os posts</h1>
        <p className="mt-2 text-muted">O feed da escola aparece depois do login.</p>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
        >
          Entrar
        </Link>
      </section>
    );
  }

  return <Feed viewerId={user.id} campusLabel={school ? `Campus – ${school.shortName}` : null} />;
}
