"use client";

import { SIGNED_URL_REFRESH_MS } from "@/lib/signed-url";
import { refreshSignedMedia } from "@/server/refresh-media";

type Kind = "post" | "avatar";
type Listener = (url: string | null) => void;

type Slot = {
  kind: Kind;
  id: string;
  listener: Listener;
};

const slots = new Map<number, Slot>();
let nextToken = 1;
let timer: number | null = null;
let ticking = false;

async function runTick() {
  if (ticking || slots.size === 0) return;
  ticking = true;
  const snapshot = [...slots.values()];
  try {
    const postIds = snapshot.filter((slot) => slot.kind === "post").map((slot) => slot.id);
    const profileIds = snapshot.filter((slot) => slot.kind === "avatar").map((slot) => slot.id);
    const result = await refreshSignedMedia({ postIds, profileIds });
    for (const slot of snapshot) {
      const url = slot.kind === "post" ? result.posts[slot.id] : result.avatars[slot.id];
      slot.listener(url ?? null);
    }
  } finally {
    ticking = false;
  }
}

function ensureTimer() {
  if (timer != null || typeof window === "undefined") return;
  timer = window.setInterval(() => {
    void runTick();
  }, SIGNED_URL_REFRESH_MS);
}

/** One batched createSignedUrls request per tick for every image still on screen. */
export function subscribeSignedMedia(kind: Kind, id: string, listener: Listener): () => void {
  const token = nextToken;
  nextToken += 1;
  slots.set(token, { kind, id, listener });
  ensureTimer();
  return () => {
    slots.delete(token);
    if (slots.size === 0 && timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}
