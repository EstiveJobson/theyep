import Link from "next/link";

export default function NotFound() {
  return (
    <section className="card px-6 py-10 text-center">
      <h1 className="text-lg font-extrabold">Página não encontrada</h1>
      <p className="mt-2 text-muted">Esse endereço não existe no TheYep.</p>
      <Link href="/" className="mt-4 inline-flex h-11 items-center font-bold text-blue-ink">
        Voltar ao início
      </Link>
    </section>
  );
}
