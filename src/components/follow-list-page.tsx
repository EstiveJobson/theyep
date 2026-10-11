import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowList } from "@/components/follow-list";
import type { FollowDirection } from "@/lib/follows";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { loadFollowList } from "@/server/follows";

const TITLES: Record<FollowDirection, string> = {
  seguidores: "Seguidores",
  seguindo: "Seguindo",
};

export async function FollowListPage({
  params,
  direction,
}: {
  params: Promise<{ id: string }>;
  direction: FollowDirection;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  if (!supabase) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Lista ainda não ligada</h1>
        <p className="mt-2 text-muted">Falta configurar o Supabase.</p>
      </section>
    );
  }

  const { data, error } = await supabase.from("profiles").select("id").eq("id", id).maybeSingle();
  if (error) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Não foi possível carregar a lista</h1>
      </section>
    );
  }
  if (!data) notFound();

  const { user } = await getViewer();
  if (!user) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Entre para ver essa lista</h1>
        <p className="mt-2 text-muted">Os seguidores aparecem depois do login.</p>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
        >
          Entrar
        </Link>
      </section>
    );
  }

  const result = await loadFollowList({ profileId: id, direction, cursor: null });
  const title = TITLES[direction];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-extrabold">{title}</h1>
        <Link href={`/perfil/${id}`} className="text-sm font-bold text-blue-ink">
          Voltar ao perfil
        </Link>
      </div>
      <FollowList
        profileId={id}
        direction={direction}
        initialPeople={result.ok ? result.people : []}
        initialCursor={result.ok ? result.nextCursor : null}
        initialError={result.ok ? "" : result.error}
      />
    </div>
  );
}
