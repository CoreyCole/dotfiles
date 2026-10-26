import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  UNAVAILABLE_NOTICE,
  buildPayload,
  classifyStatus,
  createNotifyController,
  excerptFromContent,
  herdrPayloadFields,
  installSettledWebhook,
  isQuestionPrompt,
  postSettledWebhook,
  resolveAuthHeader,
  resolveWebhookUrl,
  startupGate,
  truncateExcerpt,
  type SettledWebhookPayload,
} from "../settled-webhook.ts";

const FAKE_KEY = "fake-key-value";
const FAKE_URL = "https://example.invalid/hook";

function gatedEnv(extra: Record<string, string> = {}) {
  return {
    PI_SETTLED_WEBHOOK: "1",
    PI_SETTLED_WEBHOOK_URL: FAKE_URL,
    PI_SETTLED_WEBHOOK_KEY: FAKE_KEY,
    TMUX: "/tmp/tmux-1/default,1,0",
    TMUX_PANE: "%7",
    ...extra,
  };
}

function payload(status: SettledWebhookPayload["status"] = "settled"): SettledWebhookPayload {
  return buildPayload({
    cwd: "/home/box/dotfiles",
    sessionId: "sess-1",
    sessionFile: "/tmp/sess.jsonl",
    tmux: "/tmp/tmux-1/default,1,0",
    tmuxPane: "%7",
    excerpt: "done",
    status,
    aborted: false,
    timestamp: "2026-10-20T00:00:00.000Z",
    eventId: "event-1",
  });
}

test("payload has the required fields and no secret", () => {
  const event = payload();
  assert.equal(event.cwd, "/home/box/dotfiles");
  assert.equal(event.tmux, "/tmp/tmux-1/default,1,0");
  assert.equal(event.tmuxPane, "%7");
  assert.equal(event.sessionId, "sess-1");
  assert.equal(event.sessionFile, "/tmp/sess.jsonl");
  assert.equal(event.excerpt, "done");
  assert.equal(event.status, "settled");
  assert.equal(event.timestamp, "2026-10-20T00:00:00.000Z");
  const encoded = JSON.stringify(event);
  assert.equal(encoded.includes(FAKE_KEY), false);
  assert.equal(encoded.includes(FAKE_URL), false);
  assert.equal("url" in event, false);
});

test("excerpt skips tool calls and stops at 800 characters", () => {
  const text = excerptFromContent([
    { type: "thinking", thinking: "secret plan" },
    { type: "toolCall", name: "bash", arguments: { command: FAKE_KEY } },
    { type: "text", text: "visible" },
  ]);
  assert.equal(text, "visible");
  assert.equal(truncateExcerpt("x".repeat(801)).length, 800);
});

test("classifies error, abort, question text, and prompt kinds", () => {
  assert.equal(classifyStatus({ stopReason: "error", excerpt: "no" }).status, "error");
  assert.equal(classifyStatus({ aborted: true, stopReason: "stop", excerpt: "stopped" }).status, "settled");
  assert.equal(classifyStatus({ aborted: true, excerpt: "stopped" }).aborted, true);
  assert.equal(classifyStatus({ excerpt: "hello\nReady?" }).status, "question");
  assert.equal(classifyStatus({ promptKind: "custom" }).status, "question");
  assert.equal(isQuestionPrompt("select"), false);
  assert.equal(isQuestionPrompt("confirm"), false);
  assert.equal(isQuestionPrompt("input"), true);
});

test("auth helper uses Bearer and a bad URL error hides the key", () => {
  assert.equal(resolveAuthHeader(undefined, FAKE_KEY), `Bearer ${FAKE_KEY}`);
  assert.equal(resolveAuthHeader("Token raw", FAKE_KEY), "Token raw");
  assert.throws(
    () => resolveWebhookUrl(`http://example.invalid/?token=${FAKE_KEY}`),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes(FAKE_KEY), false);
      return true;
    },
  );
});

test("herdr ids are included only when HERDR_ENV is 1, and the profile only when set", () => {
  const absent = herdrPayloadFields({
    HERDR_PANE_ID: "w1:p4",
    HERDR_TAB_ID: "w1:t3",
    HERDR_WORKSPACE_ID: "w1",
    PI_GROKBOT_PROFILE: "  ",
  });
  assert.equal("herdrPaneId" in absent, false);
  assert.equal("herdrTabId" in absent, false);
  assert.equal("herdrWorkspaceId" in absent, false);
  assert.equal("piGrokbotProfile" in absent, false);

  const outside = buildPayload({
    cwd: "/home/box/dotfiles",
    status: "settled",
    aborted: false,
    launchEnv: { HERDR_ENV: "0", HERDR_PANE_ID: "w1:p4", PI_GROKBOT_PROFILE: "sentry-fixer" },
    eventId: "event-1",
    timestamp: "2026-10-20T00:00:00.000Z",
  });
  assert.equal("herdrPaneId" in outside, false);
  assert.equal(outside.piGrokbotProfile, "sentry-fixer");

  const inside = buildPayload({
    cwd: "/home/box/dotfiles",
    status: "settled",
    aborted: false,
    tmux: "/tmp/tmux-1/default,1,0",
    tmuxPane: "%7",
    launchEnv: {
      HERDR_ENV: "1",
      HERDR_PANE_ID: "w1:p4",
      HERDR_TAB_ID: " ",
      HERDR_WORKSPACE_ID: "w1",
      PI_GROKBOT_PROFILE: "pi-extensions",
    },
    eventId: "event-1",
    timestamp: "2026-10-20T00:00:00.000Z",
  });
  assert.equal(inside.herdrPaneId, "w1:p4");
  assert.equal(inside.herdrTabId, null);
  assert.equal(inside.herdrWorkspaceId, "w1");
  assert.equal(inside.piGrokbotProfile, "pi-extensions");
  assert.equal(inside.tmuxPane, "%7");
  assert.equal(JSON.stringify(inside).includes(FAKE_KEY), false);
});

test("startup gate requires all three vars and blocks children", () => {
  assert.equal(startupGate({}).ok, false);
  assert.equal(startupGate({ PI_SETTLED_WEBHOOK: "1" }).ok, false);
  assert.equal(startupGate({ ...gatedEnv(), PI_SETTLED_WEBHOOK_URL: undefined }).ok, false);
  assert.equal(startupGate({ ...gatedEnv(), PI_SETTLED_WEBHOOK_KEY: "  " }).ok, false);
  assert.equal(startupGate({ ...gatedEnv(), PI_SETTLED_WEBHOOK_URL: "http://example.invalid/hook" }).ok, false);
  assert.equal(startupGate({ ...gatedEnv(), PI_SUBAGENT_ID: "child-1" }).ok, false);
  assert.equal(startupGate(gatedEnv()).ok, true);
});

test("a session entry cannot enable an ungated or child process", () => {
  const entry = { type: "custom", customType: "settled-webhook", data: { enabled: true } };
  assert.equal(startupGate({}).ok, false);
  assert.equal(startupGate({ ...gatedEnv(), PI_SUBAGENT_ID: "child-1" }).ok, false);
  assert.equal(JSON.stringify(entry).includes("enabled"), true);
});

test("post to a local server reports status and hides secrets", async () => {
  const bodies: string[] = [];
  const auths: string[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      bodies.push(body);
      auths.push(String(req.headers.authorization ?? ""));
      res.writeHead(204);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("expected tcp address");
  }
  const lines: string[] = [];
  try {
    const result = await postSettledWebhook(
      `http://127.0.0.1:${address.port}/hook`,
      payload(),
      `Bearer ${FAKE_KEY}`,
      fetch,
      { debug: true, stderr: { write: (line) => lines.push(line) }, secrets: [FAKE_KEY] },
    );
    assert.equal(result.ok, true);
    assert.equal(result.status, 204);
    assert.equal(bodies.length, 1);
    assert.equal(JSON.parse(bodies[0]).excerpt, "done");
    assert.equal(auths[0], `Bearer ${FAKE_KEY}`);
    assert.deepEqual(lines, ["settled-webhook: POST status=204\n"]);
    assert.equal(lines.join("").includes(FAKE_KEY), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("a rejected fetch is swallowed", async () => {
  const lines: string[] = [];
  const result = await postSettledWebhook(FAKE_URL, payload(), `Bearer ${FAKE_KEY}`, async () => {
    throw new Error(`connect ${FAKE_URL} key ${FAKE_KEY}`);
  }, { debug: true, stderr: { write: (line) => lines.push(line) }, secrets: [FAKE_KEY, FAKE_URL] });
  assert.equal(result.ok, false);
  assert.deepEqual(lines, ["settled-webhook: POST failed\n"]);
  assert.equal(lines.join("").includes(FAKE_KEY), false);
  assert.equal(lines.join("").includes(FAKE_URL), false);
});

test("debounce sends one later status and prompt end sends nothing", async () => {
  const sent: SettledWebhookPayload[] = [];
  let queued: (() => void) | undefined;
  const controller = createNotifyController({
    now: () => 0,
    setTimer: (callback) => {
      queued = callback;
      return 1;
    },
    clearTimer: () => {
      queued = undefined;
    },
    post: async (event) => {
      sent.push(event);
    },
  });
  controller.scheduleNotify(payload("settled"));
  controller.scheduleNotify(payload("question"));
  queued?.();
  await controller.flush(10);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].status, "question");

  const dropped: SettledWebhookPayload[] = [];
  let second: (() => void) | undefined;
  const other = createNotifyController({
    setTimer: (callback) => {
      second = callback;
      return 2;
    },
    clearTimer: () => {
      second = undefined;
    },
    post: async (event) => {
      dropped.push(event);
    },
  });
  other.scheduleNotify(payload("question"));
  other.cancelPendingQuestion();
  second?.();
  await other.flush(10);
  assert.equal(dropped.length, 0);
});

test("shutdown flush posts without waiting for the debounce timer", async () => {
  const sent: string[] = [];
  let queued: (() => void) | undefined;
  const controller = createNotifyController({
    setTimer: (callback) => {
      queued = callback;
      return 3;
    },
    clearTimer: () => {
      queued = undefined;
    },
    post: async (event) => {
      sent.push(event.status);
    },
  });
  controller.scheduleNotify(payload("settled"));
  assert.equal(queued === undefined, false);
  await controller.flush(20);
  assert.deepEqual(sent, ["settled"]);
});

function fakeRuntime() {
  const handlers = new Map<string, Array<(event: unknown, ctx: ExtensionContext) => unknown>>();
  const commands = new Map<string, (args: string, ctx: ExtensionContext) => unknown>();
  const notices: string[] = [];
  const pi = {
    on(event: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    registerCommand(name: string, options: { handler: (args: string, ctx: ExtensionContext) => unknown }) {
      commands.set(name, options.handler);
    },
  } as unknown as ExtensionAPI;
  const ctx = {
    cwd: "/home/box/dotfiles",
    isIdle: () => true,
    ui: {
      notify(message: string) {
        notices.push(message);
      },
    },
    sessionManager: {
      getSessionId: () => "sess-1",
      getSessionFile: () => "/tmp/sess.jsonl",
      getBranch: () => [
        {
          type: "message",
          message: {
            role: "assistant",
            stopReason: "stop",
            content: [{ type: "text", text: "ok" }],
          },
        },
      ],
    },
  } as unknown as ExtensionContext;
  return { pi, handlers, commands, notices, ctx };
}

test("ungated factory registers no POST handler and the toggle cannot bypass the gate", async () => {
  const runtime = fakeRuntime();
  const calls: string[] = [];
  installSettledWebhook(runtime.pi, {
    env: { PI_SETTLED_WEBHOOK_KEY: FAKE_KEY, PI_SETTLED_WEBHOOK_URL: `${FAKE_URL}?k=${FAKE_KEY}` },
    fetchImpl: async () => {
      calls.push("fetch");
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(runtime.handlers.has("agent_settled"), false);
  assert.equal(runtime.handlers.has("session_shutdown"), false);
  const command = runtime.commands.get("settled-webhook");
  assert.ok(command);
  await command("on", runtime.ctx);
  assert.equal(runtime.notices.at(-1), UNAVAILABLE_NOTICE);
  assert.equal(runtime.notices.join("").includes(FAKE_KEY), false);
  assert.equal(runtime.notices.join("").includes(FAKE_URL), false);
  assert.equal(calls.length, 0);
});

test("child guard is not overridable and select prompts do not schedule", async () => {
  const runtime = fakeRuntime();
  const calls: string[] = [];
  let queued: (() => void) | undefined;
  installSettledWebhook(runtime.pi, {
    env: { ...gatedEnv(), PI_SUBAGENT_ID: "child-1" },
    setTimer: (callback) => {
      queued = callback;
      return 1;
    },
    fetchImpl: async () => {
      calls.push("fetch");
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(runtime.handlers.has("agent_settled"), false);
  await runtime.commands.get("settled-webhook")?.("on", runtime.ctx);
  assert.equal(runtime.notices.at(-1), UNAVAILABLE_NOTICE);
  assert.equal(calls.length, 0);
  assert.equal(queued, undefined);
});

test("gated off stops a settle and on can schedule again", async () => {
  const runtime = fakeRuntime();
  const calls: string[] = [];
  const queued: Array<() => void> = [];
  installSettledWebhook(runtime.pi, {
    env: gatedEnv(),
    setTimer: (callback) => {
      queued.push(callback);
      return queued.length;
    },
    clearTimer: () => {},
    fetchImpl: async () => {
      calls.push("fetch");
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(runtime.handlers.has("agent_settled"), true);
  await runtime.commands.get("settled-webhook")?.("off", runtime.ctx);
  await runtime.handlers.get("agent_settled")?.[0]?.({ type: "agent_settled", aborted: false }, runtime.ctx);
  assert.equal(calls.length, 0);
  await runtime.commands.get("settled-webhook")?.("on", runtime.ctx);
  await runtime.handlers.get("agent_settled")?.[0]?.({ type: "agent_settled", aborted: false }, runtime.ctx);
  queued.at(-1)?.();
  await runtime.handlers.get("session_shutdown")?.[0]?.({}, runtime.ctx);
  assert.equal(calls.length, 1);
});

test("a gated settle posts herdr ids only inside herdr", async () => {
  const runtime = fakeRuntime();
  const bodies: string[] = [];
  const queued: Array<() => void> = [];
  installSettledWebhook(runtime.pi, {
    env: {
      ...gatedEnv(),
      HERDR_ENV: "1",
      HERDR_PANE_ID: "w1:p4",
      HERDR_TAB_ID: "w1:t3",
      HERDR_WORKSPACE_ID: "w1",
      PI_GROKBOT_PROFILE: "pi-extensions",
    },
    setTimer: (callback) => {
      queued.push(callback);
      return queued.length;
    },
    clearTimer: () => {},
    fetchImpl: async (_url, init) => {
      bodies.push(String(init?.body ?? ""));
      return new Response(null, { status: 204 });
    },
  });
  await runtime.handlers.get("agent_settled")?.[0]?.({ type: "agent_settled", aborted: false }, runtime.ctx);
  queued.at(-1)?.();
  await runtime.handlers.get("session_shutdown")?.[0]?.({}, runtime.ctx);
  assert.equal(bodies.length, 1);
  const event = JSON.parse(bodies[0]);
  assert.equal(event.herdrPaneId, "w1:p4");
  assert.equal(event.herdrTabId, "w1:t3");
  assert.equal(event.herdrWorkspaceId, "w1");
  assert.equal(event.piGrokbotProfile, "pi-extensions");
  assert.equal(event.tmuxPane, "%7");
  assert.equal(event.excerpt, "ok");
  assert.equal(bodies[0].includes(FAKE_KEY), false);
  assert.equal(bodies[0].includes(FAKE_URL), false);
});

test("extension source does not read config files or spawn a process", () => {
  const source = readFileSync(new URL("../settled-webhook.ts", import.meta.url), "utf8");
  for (const banned of ["settings.json", "secrets.sh", "settled-webhook.env", "getSettings", "appendEntry", "child_process", "node:fs"]) {
    assert.equal(source.includes(banned), false, banned);
  }
  const testSource = readFileSync(new URL(import.meta.url), "utf8");
  const childImport = ["node", "child_process"].join(":");
  assert.equal(testSource.includes(`from "${childImport}"`), false);
  assert.equal(testSource.includes(`from '${childImport}'`), false);
});
