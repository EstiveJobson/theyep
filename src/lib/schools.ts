import type { SupabaseClient } from "@supabase/supabase-js";

export type SchoolOption = {
  id: string;
  name: string;
  short_name: string;
};

export async function listActiveSchools(
  supabase: SupabaseClient,
): Promise<{ schools: SchoolOption[]; error: string | null }> {
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, short_name")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) return { schools: [], error: "Não foi possível carregar as escolas." };

  const schools = ((data ?? []) as SchoolOption[]).flatMap((school) => {
    const name = school.name?.trim() ?? "";
    if (!school.id || !name) return [];
    return [
      {
        id: school.id,
        name,
        short_name: school.short_name?.trim() || name,
      },
    ];
  });

  return { schools, error: null };
}
