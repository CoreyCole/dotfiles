import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Matches the footer warning: usage above 200k, not the model window size. */
export const CONTEXT_DELEGATE_THRESHOLD = 200_000;
export const CONTEXT_DELEGATE_NOTE =
  "note: context above 200k prefer to delegate to subagents";
export const CONTEXT_DELEGATE_CUSTOM_TYPE = "context-delegate-note";

export function contextDelegateMessage(tokens: number | null | undefined) {
  if (
    tokens == null ||
    !Number.isFinite(tokens) ||
    tokens <= CONTEXT_DELEGATE_THRESHOLD
  ) {
    return undefined;
  }
  return {
    customType: CONTEXT_DELEGATE_CUSTOM_TYPE,
    content: CONTEXT_DELEGATE_NOTE,
    display: false as const,
  };
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", (_event, ctx) => {
    const message = contextDelegateMessage(ctx.getContextUsage()?.tokens);
    if (!message) return;
    return { message };
  });
}
