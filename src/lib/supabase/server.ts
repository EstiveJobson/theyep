import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "@/lib/supabase/env";

export async function createClient(): Promise<SupabaseClient | null> {
  const { url, anonKey, configured } = supabasePublicEnv();
  if (!configured) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Em Server Component o middleware é quem renova a sessão.
        }
      },
    },
  });
}
