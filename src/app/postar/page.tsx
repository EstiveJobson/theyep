import Link from "next/link";
import { Composer } from "@/components/composer";
import { campusLabel } from "@/lib/campus-label";
import { getViewer } from "@/lib/viewer";

export default async function PostarPage() {
  const { supabase, user, school } = await getViewer();

  if (!supabase) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Publicar ainda não está ligado</h1>
        <p className="mt-2 text-muted">Falta configurar o Supabase.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Entre para publicar</h1>
        <p className="mt-2 text-muted">Texto e foto ficam disponíveis depois do login.</p>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
        >
          Entrar
        </Link>
      </section>
    );
  }

  return <Composer campusLabel={school ? campusLabel(school.shortName) : null} />;
}
