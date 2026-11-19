import assert from "node:assert/strict";
import test from "node:test";
import type {
  BeforeAgentStartEvent,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import extension, {
  CONTEXT_DELEGATE_CUSTOM_TYPE,
  CONTEXT_DELEGATE_NOTE,
  CONTEXT_DELEGATE_THRESHOLD,
  contextDelegateMessage,
} from "../context-delegate-note.ts";

test("attaches the delegate note only above 200k", () => {
  assert.equal(contextDelegateMessage(undefined), undefined);
  assert.equal(contextDelegateMessage(null), undefined);
  assert.equal(contextDelegateMessage(Number.NaN), undefined);
  assert.equal(contextDelegateMessage(CONTEXT_DELEGATE_THRESHOLD), undefined);
  assert.equal(
    contextDelegateMessage(CONTEXT_DELEGATE_THRESHOLD - 1),
    undefined,
  );

  assert.deepEqual(contextDelegateMessage(CONTEXT_DELEGATE_THRESHOLD + 1), {
    customType: CONTEXT_DELEGATE_CUSTOM_TYPE,
    content: CONTEXT_DELEGATE_NOTE,
    display: false,
  });
});

test("before_agent_start returns the note from current context usage", () => {
  let handler:
    | ((
        event: BeforeAgentStartEvent,
        ctx: ExtensionContext,
      ) => { message?: { content: string; display: boolean } } | undefined)
    | undefined;
  const pi = {
    on(event: string, registered: typeof handler) {
      if (event === "before_agent_start") handler = registered;
    },
  } as unknown as ExtensionAPI;
  extension(pi);
  assert.ok(handler);

  const event = { type: "before_agent_start" } as BeforeAgentStartEvent;
  const ctx = {
    getContextUsage: () => ({
      tokens: 200_001,
      contextWindow: 500_000,
      percent: 40,
    }),
  } as ExtensionContext;
  const attached = handler(event, ctx);
  assert.equal(attached?.message?.content, CONTEXT_DELEGATE_NOTE);
  assert.equal(attached?.message?.display, false);

  const quiet = handler(event, {
    getContextUsage: () => ({
      tokens: 200_000,
      contextWindow: 500_000,
      percent: 40,
    }),
  } as ExtensionContext);
  assert.equal(quiet, undefined);
});
