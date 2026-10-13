export type SiteUrlEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
};

const LOCAL_SITE = "http://localhost:3000";

function siteUrlEnvFromProcess(): SiteUrlEnv {
  return {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  };
}

function withProtocol(value: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  return `https://${value}`;
}

/** Adds https:// when the value has no protocol, drops a trailing slash, and rejects anything else. */
export function normalizeSiteUrl(raw: string | null | undefined): URL | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const candidate = withProtocol(trimmed).replace(/\/+$/, "");
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function hostUrl(host: string | undefined): URL | null {
  const trimmed = host?.trim() ?? "";
  if (!trimmed) return null;
  return normalizeSiteUrl(trimmed);
}

export function resolveSiteUrl(env: SiteUrlEnv = siteUrlEnvFromProcess()): URL {
  const configured = normalizeSiteUrl(env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;

  if (env.VERCEL_ENV === "production") {
    const production = hostUrl(env.VERCEL_PROJECT_PRODUCTION_URL);
    if (production) return production;
  }

  const preview = hostUrl(env.VERCEL_URL);
  if (preview) return preview;

  return new URL(LOCAL_SITE);
}
