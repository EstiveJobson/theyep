"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="card px-6 py-10 text-center">
      <h1 className="text-lg font-extrabold">Algo deu errado</h1>
      <p className="mt-2 break-words text-sm text-muted">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 h-11 rounded-lg bg-pink px-4 text-sm font-extrabold text-on-accent"
      >
        Tentar de novo
      </button>
    </section>
  );
}
