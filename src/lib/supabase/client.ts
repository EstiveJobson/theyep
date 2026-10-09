"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return supabasePublicEnv().configured;
}

export function getBrowserClient(): SupabaseClient | null {
  const { url, anonKey, configured } = supabasePublicEnv();
  if (!configured) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}
