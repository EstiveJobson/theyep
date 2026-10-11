import { notFound } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { joinedLabel } from "@/lib/relative-time";
import { firstRelation } from "@/lib/relation";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  created_at: string;
  schools: { short_name: string } | { short_name: string }[] | null;
};

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  if (!supabase) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Perfil ainda não ligado</h1>
        <p className="mt-2 text-muted">Falta configurar o Supabase.</p>
      </section>
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, bio, avatar_url, created_at, schools(short_name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <section className="card px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold">Não foi possível carregar o perfil</h1>
      </section>
    );
  }

  const profile = data as ProfileRow | null;
  if (!profile) notFound();

  const name = profile.name.trim() || "Sem nome";
  const school = firstRelation(profile.schools)?.short_name?.trim() || "";
  const when = profile.created_at ? joinedLabel(profile.created_at) : "";

  return (
    <section className="card p-4">
      <div className="flex items-center gap-3">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={name === "Sem nome" ? "Foto do perfil" : `Foto de ${name}`}
            className="size-16 rounded-full object-cover"
          />
        ) : (
          <span className="grid size-16 place-items-center rounded-full bg-yellow text-xl font-extrabold text-on-accent">
            {(name.charAt(0) || "Y").toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold">{name}</h1>
          {school ? <p className="truncate text-sm text-muted">{school}</p> : null}
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm">
        {profile.bio.trim() || "Sem bio ainda."}
      </p>
      {when ? <p className="mt-2 text-sm text-muted">{when}</p> : null}
    </section>
  );
}
