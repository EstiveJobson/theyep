import { isUuid } from "./ids.ts";

export const PENDING_RETRY_COOKIE = "ps_retry_after";
export const PENDING_NOTICE_COOKIE = "ps_school_notice";
export const PENDING_RETRY_SECONDS = 5 * 60;
export const INACTIVE_SCHOOL_NOTICE = "A escola escolhida não está disponível. Escolha outra.";

export type PendingRetryCookie = {
  name: typeof PENDING_RETRY_COOKIE;
  value: string;
  maxAge: number;
};

export function pendingRetryCookie(now = Date.now()): PendingRetryCookie {
  return {
    name: PENDING_RETRY_COOKIE,
    value: String(now + PENDING_RETRY_SECONDS * 1000),
    maxAge: PENDING_RETRY_SECONDS,
  };
}

export function pendingRetryActive(value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const expiresAt = Number(value);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function classifyPendingMetadata(raw: unknown): "absent" | "invalid" | "ready" {
  if (raw == null) return "absent";
  if (typeof raw !== "string") return "invalid";
  const id = raw.trim();
  if (!id) return "invalid";
  return isUuid(id) ? "ready" : "invalid";
}

export function pendingMetadataAction(raw: unknown): "skip" | "clear" | "apply" {
  const kind = classifyPendingMetadata(raw);
  switch (kind) {
    case "absent":
      return "skip";
    case "invalid":
      return "clear";
    case "ready":
      return "apply";
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

export type PendingRpcPlan =
  | { action: "ok" }
  | { action: "clear"; notice: "inactive" | null }
  | { action: "retry"; cookie: PendingRetryCookie };

export function planPendingRpc(input: {
  thrown?: boolean;
  ok?: boolean;
  status?: number;
  message?: string;
  now?: number;
}): PendingRpcPlan {
  if (input.thrown || input.ok) {
    if (input.ok && !input.thrown) return { action: "ok" };
    return { action: "retry", cookie: pendingRetryCookie(input.now) };
  }

  const status = input.status ?? 0;
  const message = input.message ?? "";
  if (status >= 400 && status < 500) {
    const inactive = message.toLowerCase().includes("inactive");
    return { action: "clear", notice: inactive ? "inactive" : null };
  }

  return { action: "retry", cookie: pendingRetryCookie(input.now) };
}
