import type { SupabaseClient, User } from "@supabase/supabase-js";
import { firstRelation } from "@/lib/relation";
import { createClient } from "@/lib/supabase/server";

export type ViewerSchool = {
  id: string;
  name: string;
  shortName: string;
};

export type Viewer = {
  supabase: SupabaseClient | null;
  user: User | null;
  school: ViewerSchool | null;
  avatarUrl: string | null;
};

type ProfileRow = {
  school_id: string | null;
  avatar_url: string | null;
  schools:
    | { id: string; name: string; short_name: string }
    | { id: string; name: string; short_name: string }[]
    | null;
};

export async function getViewer(): Promise<Viewer> {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null, school: null, avatarUrl: null };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null, school: null, avatarUrl: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, avatar_url, schools(id, name, short_name)")
    .eq("id", data.user.id)
    .maybeSingle();

  const row = profile as ProfileRow | null;
  return {
    supabase,
    user: data.user,
    school: schoolFrom(row),
    avatarUrl: row?.avatar_url ?? null,
  };
}

function schoolFrom(profile: ProfileRow | null): ViewerSchool | null {
  if (!profile?.school_id) return null;
  const row = firstRelation(profile.schools);
  return {
    id: profile.school_id,
    name: row?.name?.trim() || "sua escola",
    shortName: row?.short_name?.trim() || "sua escola",
  };
}
