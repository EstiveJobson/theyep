export type ImageRetryState = { retried: boolean };

export function imageRetryReset(): ImageRetryState {
  return { retried: false };
}

/** One retry, then the fallback. The signed URL is not part of the decision. */
export function imageRetryOnError(state: ImageRetryState): {
  state: ImageRetryState;
  action: "retry" | "fallback";
} {
  if (state.retried) return { state, action: "fallback" };
  return { state: { retried: true }, action: "retry" };
}
