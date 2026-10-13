import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSiteUrl, resolveSiteUrl } from "./site-url.ts";

test("site URL adds https and drops a trailing slash", () => {
  const url = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "theyep.app/" });
  assert.equal(url.origin, "https://theyep.app");
  assert.equal(normalizeSiteUrl("https://theyep.app/ola/")?.href, "https://theyep.app/ola");
});

test("site URL keeps an explicit http protocol", () => {
  const url = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000/" });
  assert.equal(url.origin, "http://localhost:3000");
});

test("invalid site URL falls back instead of throwing", () => {
  const url = resolveSiteUrl({
    NEXT_PUBLIC_SITE_URL: "not a url",
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_PRODUCTION_URL: "theyep.app",
    VERCEL_URL: "theyep-git-preview.vercel.app",
  });
  assert.equal(url.origin, "https://theyep-git-preview.vercel.app");
  assert.equal(normalizeSiteUrl("ftp://theyep.app"), null);
  assert.doesNotThrow(() => resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "%%%%" }));
});

test("production uses VERCEL_PROJECT_PRODUCTION_URL", () => {
  const url = resolveSiteUrl({
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "theyep.app",
    VERCEL_URL: "theyep-abc123.vercel.app",
  });
  assert.equal(url.origin, "https://theyep.app");
});

test("previews use VERCEL_URL", () => {
  const url = resolveSiteUrl({
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_PRODUCTION_URL: "theyep.app",
    VERCEL_URL: "theyep-git-preview.vercel.app/",
  });
  assert.equal(url.origin, "https://theyep-git-preview.vercel.app");
});

test("local fallback is localhost", () => {
  const url = resolveSiteUrl({});
  assert.equal(url.origin, "http://localhost:3000");
});
