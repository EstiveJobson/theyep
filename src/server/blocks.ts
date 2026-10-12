"use server";

import { revalidatePath } from "next/cache";
import { isDuplicateBlock, type BlockedPerson } from "@/lib/blocks";
import { cleanCursor, type FeedCursor } from "@/lib/feed-cursor";
import { isUuid } from "@/lib/ids";
import { getViewer } from "@/lib/viewer";

const PAGE = 20;
const BLOCK_ERROR = "Não foi possível bloquear. Tente de novo.";
const UNBLOCK_ERROR = "Não foi possível desbloquear. Tente de novo.";

type BlockRow = {
  profile_id: string;
  name: string | null;
  avatar_url: string | null;
  blocked_at: string;
};

function refreshBlock(viewerId: string, profileId: string) {
  revalidatePath("/");
  revalidatePath("/configuracoes");
  revalidatePath("/perfil");
  revalidatePath(`/perfil/${viewerId}`);
  revalidatePath(`/perfil/${viewerId}/seguidores`);
  revalidatePath(`/perfil/${viewerId}/seguindo`);
  revalidatePath(`/perfil/${profileId}`);
  revalidatePath(`/perfil/${profileId}/seguidores`);
  revalidatePath(`/perfil/${profileId}/seguindo`);
}

export async function setBlock(
  profileId: string,
  block: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fail = block ? BLOCK_ERROR : UNBLOCK_ERROR;
  const { supabase, user } = await getViewer();
  if (!supabase || !user) return { ok: false, error: fail };
  if (!isUuid(profileId) || profileId === user.id) return { ok: false, error: fail };

  if (block) {
    const { error } = await supabase.from("blocks").insert({ blocked_id: profileId });
    if (error && !isDuplicateBlock(error)) return { ok: false, error: fail };
  } else {
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocked_id", profileId)
      .eq("blocker_id", user.id);
    if (error) return { ok: false, error: fail };
  }

  refreshBlock(user.id, profileId);
  return { ok: true };
}

export async function loadBlocks(input: {
  cursor?: FeedCursor | null;
}): Promise<
  | { ok: true; people: BlockedPerson[]; nextCursor: FeedCursor | null }
  | { ok: false; error: string }
> {
  const { supabase, user } = await getViewer();
  if (!supabase || !user) return { ok: false, error: "Entre para ver as contas bloqueadas." };
  if (input.cursor && !cleanCursor(input.cursor)) {
    return { ok: false, error: "Não foi possível carregar a lista. Tente de novo." };
  }
  const cursor = cleanCursor(input.cursor);

  const { data, error } = await supabase.rpc("list_blocks", {
    p_cursor_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: PAGE + 1,
  });
  if (error) return { ok: false, error: "Não foi possível carregar a lista. Tente de novo." };

  const rows = ((data ?? []) as BlockRow[]).slice(0, PAGE + 1);
  const page = rows.slice(0, PAGE);
  const people = page.map((row) => ({
    id: row.profile_id,
    name: row.name?.trim() || "Sem nome",
    avatarUrl: row.avatar_url,
    blockedAt: row.blocked_at,
  }));
  const last = people.length === PAGE ? page[PAGE - 1] : null;
  const nextCursor =
    rows.length > PAGE && last ? { createdAt: last.blocked_at, id: last.profile_id } : null;

  return { ok: true, people, nextCursor };
}
