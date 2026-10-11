export const FEED_TAB_KEY = "theyep-feed-tab";

export type FeedTab = "geral" | "campus" | "seguindo";

export function rememberFeedTab(tab: FeedTab): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FEED_TAB_KEY, tab);
  } catch {
    // Private mode can reject storage. The feed still works for this visit.
  }
}

export function readFeedTab(hasCampus: boolean): FeedTab {
  if (typeof window === "undefined") return "geral";
  try {
    const value = localStorage.getItem(FEED_TAB_KEY);
    if (value === "seguindo") return "seguindo";
    if (value === "campus" && hasCampus) return "campus";
  } catch {
    // Ignore and fall back to Geral.
  }
  return "geral";
}
