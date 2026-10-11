import Link from "next/link";
import { BlockList } from "@/components/block-list";
import { getViewer } from "@/lib/viewer";
import { loadBlocks } from "@/server/blocks";

export default async function ConfiguracoesPage() {
  const { supabase, user } = await getViewer();

  if (!supabase) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Configurações ainda não ligadas</h1>
        <p className="mt-2 text-muted">Falta configurar o Supabase.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Entre para ver as contas bloqueadas</h1>
        <Link
          href="/perfil"
          className="mt-4 inline-flex h-11 items-center rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
        >
          Entrar
        </Link>
      </section>
    );
  }

  const result = await loadBlocks({ cursor: null });

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-extrabold">Configurações</h1>
      <section className="space-y-3" aria-labelledby="contas-bloqueadas">
        <h2 id="contas-bloqueadas" className="text-base font-extrabold">
          Contas bloqueadas
        </h2>
        <BlockList
          initialPeople={result.ok ? result.people : []}
          initialCursor={result.ok ? result.nextCursor : null}
          initialError={result.ok ? "" : result.error}
        />
      </section>
    </div>
  );
}
