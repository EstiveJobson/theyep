export type ImageRetryState = { retried: boolean };

export function imageRetryReset(): ImageRetryState {
  return { retried: false };
}

/** True when the browser finished the image before React attached onError. */
export function imageAlreadyFailed(
  img: { complete: boolean; naturalWidth: number } | null,
): boolean {
  return Boolean(img && img.complete && img.naturalWidth === 0);
}

/** One retry, then the fallback. The signed URL is not part of the decision. */
export function imageRetryOnError(state: ImageRetryState): {
  state: ImageRetryState;
  action: "retry" | "fallback";
} {
  if (state.retried) return { state, action: "fallback" };
  return { state: { retried: true }, action: "retry" };
}
