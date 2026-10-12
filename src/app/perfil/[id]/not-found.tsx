import Link from "next/link";

export default function ProfileUnavailable() {
  return (
    <section className="card px-6 py-10 text-center">
      <h1 className="text-lg font-extrabold">Perfil indisponível</h1>
      <Link href="/" className="mt-4 inline-flex h-11 items-center font-bold text-blue-ink">
        Voltar ao início
      </Link>
    </section>
  );
}
