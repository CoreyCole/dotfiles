/**
 * Settled webhook for Grok Bot launches.
 * Usage: agent/extensions/AGENTS.md
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";

export const DEBOUNCE_MS = 500;
export const WEBHOOK_TIMEOUT_MS = 3000;
export const SHUTDOWN_FLUSH_MS = 4000;
export const EXCERPT_MAX = 800;
export const UNAVAILABLE_NOTICE = "Settled webhook is unavailable.";

const TIMER_KEY = Symbol.for("pi-settled-webhook/timer");
const DISPOSE_KEY = Symbol.for("pi-settled-webhook/dispose");

export type WebhookStatus = "settled" | "question" | "error";
export type PromptKind = "input" | "editor" | "custom";

export interface SettledWebhookPayload {
  source: "pi-settled-webhook";
  eventId: string;
  timestamp: string;
  status: WebhookStatus;
  aborted: boolean;
  cwd: string;
  sessionId: string;
  sessionFile: string | null;
  tmux: string | null;
  tmuxPane: string | null;
  herdrPaneId?: string | null;
  herdrTabId?: string | null;
  herdrWorkspaceId?: string | null;
  piGrokbotProfile?: string;
  excerpt: string;
  promptKind?: PromptKind;
}

export interface GateEnv {
  PI_SETTLED_WEBHOOK?: string;
  PI_SETTLED_WEBHOOK_URL?: string;
  PI_SETTLED_WEBHOOK_KEY?: string;
  PI_SETTLED_WEBHOOK_AUTH?: string;
  PI_SUBAGENT_ID?: string;
  PI_SETTLED_WEBHOOK_DEBUG?: string;
  TMUX?: string;
  TMUX_PANE?: string;
  HERDR_ENV?: string;
  HERDR_PANE_ID?: string;
  HERDR_TAB_ID?: string;
  HERDR_WORKSPACE_ID?: string;
  PI_GROKBOT_PROFILE?: string;
}

export type StartupGate =
  | { ok: false }
  | { ok: true; url: string; authHeader: string; debug: boolean };

export interface PostResult {
  ok: boolean;
  status: number | null;
}

type TimerHandle = ReturnType<typeof setTimeout>;

export interface NotifyController {
  scheduleNotify(payload: SettledWebhookPayload): void;
  cancelPendingQuestion(): void;
  flush(timeoutMs?: number): Promise<void>;
  dispose(): void;
}

type HookAPI = ExtensionAPI & {
  on(
    event: "ui_prompt_start" | "ui_prompt_end",
    handler: (event: unknown, ctx: ExtensionContext) => void | Promise<void>,
  ): void;
};

interface InstallDeps {
  env?: GateEnv;
  fetchImpl?: typeof fetch;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  stderr?: { write(chunk: string): void };
  randomId?: () => string;
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function safeWrite(stderr: { write(chunk: string): void } | undefined, line: string): void {
  if (!stderr) return;
  try {
    const stream = stderr as { write(chunk: string): void; once?: (event: string, fn: () => void) => void; off?: (event: string, fn: () => void) => void };
    const onError = () => {};
    stream.once?.("error", onError);
    stream.write(line);
    stream.off?.("error", onError);
  } catch {
    // A closed stderr pipe must not crash Pi.
  }
}

export function redactSecrets(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(secret).join("[redacted]");
  }
  return out.replace(/https?:\/\/\S+/g, "[redacted]");
}

export function resolveWebhookUrl(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) throw new Error("invalid webhook URL");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("invalid webhook URL");
  }
  if (parsed.protocol !== "https:") throw new Error("invalid webhook URL");
  return parsed.toString();
}

export function resolveAuthHeader(auth: string | undefined, key: string | undefined): string {
  const explicit = auth?.trim() ?? "";
  if (explicit) return explicit;
  const trimmed = key?.trim() ?? "";
  if (!trimmed) return "";
  return `Bearer ${trimmed}`;
}

export function startupGate(env: GateEnv): StartupGate {
  if (blankToNull(env.PI_SUBAGENT_ID)) return { ok: false };
  if (env.PI_SETTLED_WEBHOOK?.trim() !== "1") return { ok: false };
  const key = env.PI_SETTLED_WEBHOOK_KEY?.trim() ?? "";
  if (!key) return { ok: false };
  let url: string;
  try {
    url = resolveWebhookUrl(env.PI_SETTLED_WEBHOOK_URL);
  } catch {
    return { ok: false };
  }
  return {
    ok: true,
    url,
    authHeader: resolveAuthHeader(env.PI_SETTLED_WEBHOOK_AUTH, key),
    debug: env.PI_SETTLED_WEBHOOK_DEBUG?.trim() === "1",
  };
}

export function isQuestionPrompt(kind: string | undefined): kind is PromptKind {
  return kind === "input" || kind === "editor" || kind === "custom";
}

export function classifyStatus(input: {
  stopReason?: string;
  errorMessage?: string;
  aborted?: boolean;
  excerpt?: string;
  promptKind?: string;
}): { status: WebhookStatus; aborted: boolean; promptKind?: PromptKind } {
  if (isQuestionPrompt(input.promptKind)) {
    return { status: "question", aborted: false, promptKind: input.promptKind };
  }
  const aborted = input.aborted === true;
  if (input.stopReason === "error" || (input.errorMessage?.trim() ?? "") !== "") {
    return { status: "error", aborted };
  }
  if (aborted) return { status: "settled", aborted: true };
  const line = (input.excerpt ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1);
  if (line?.endsWith("?")) return { status: "question", aborted: false };
  return { status: "settled", aborted: false };
}

export function truncateExcerpt(text: string, max = EXCERPT_MAX): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function excerptFromContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const record = block as { type?: string; text?: unknown };
      if (record.type !== "text" || typeof record.text !== "string") return "";
      return record.text;
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function lastAssistantFromBranch(branch: readonly unknown[]): {
  stopReason?: string;
  errorMessage?: string;
  content?: unknown;
} | undefined {
  for (let i = branch.length - 1; i >= 0; i -= 1) {
    const entry = branch[i] as {
      type?: string;
      message?: { role?: string; content?: unknown; stopReason?: string; errorMessage?: string };
    };
    if (entry?.type !== "message") continue;
    if (entry.message?.role !== "assistant") continue;
    return {
      stopReason: entry.message.stopReason,
      errorMessage: entry.message.errorMessage,
      content: entry.message.content,
    };
  }
  return undefined;
}

export function herdrPayloadFields(
  env: GateEnv,
): Partial<Pick<SettledWebhookPayload, "herdrPaneId" | "herdrTabId" | "herdrWorkspaceId" | "piGrokbotProfile">> {
  const fields: Partial<
    Pick<SettledWebhookPayload, "herdrPaneId" | "herdrTabId" | "herdrWorkspaceId" | "piGrokbotProfile">
  > = {};
  if (env.HERDR_ENV?.trim() === "1") {
    fields.herdrPaneId = blankToNull(env.HERDR_PANE_ID);
    fields.herdrTabId = blankToNull(env.HERDR_TAB_ID);
    fields.herdrWorkspaceId = blankToNull(env.HERDR_WORKSPACE_ID);
  }
  const profile = blankToNull(env.PI_GROKBOT_PROFILE);
  if (profile) fields.piGrokbotProfile = profile;
  return fields;
}

export function buildPayload(input: {
  cwd: string;
  sessionId?: string;
  sessionFile?: string | null;
  tmux?: string | null;
  tmuxPane?: string | null;
  launchEnv?: GateEnv;
  excerpt?: string;
  status: WebhookStatus;
  aborted: boolean;
  promptKind?: PromptKind;
  timestamp?: string;
  eventId?: string;
}): SettledWebhookPayload {
  const payload: SettledWebhookPayload = {
    source: "pi-settled-webhook",
    eventId: input.eventId ?? randomUUID(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    status: input.status,
    aborted: input.aborted,
    cwd: input.cwd,
    sessionId: input.sessionId ?? "",
    sessionFile: input.sessionFile ?? null,
    tmux: blankToNull(input.tmux ?? undefined),
    tmuxPane: blankToNull(input.tmuxPane ?? undefined),
    ...(input.launchEnv ? herdrPayloadFields(input.launchEnv) : {}),
    excerpt: truncateExcerpt(input.excerpt ?? ""),
  };
  if (input.promptKind) payload.promptKind = input.promptKind;
  return payload;
}

export async function postSettledWebhook(
  url: string,
  payload: SettledWebhookPayload,
  authHeader: string,
  fetchImpl: typeof fetch = fetch,
  options: {
    debug?: boolean;
    stderr?: { write(chunk: string): void };
    timeoutMs?: number;
    secrets?: readonly string[];
  } = {},
): Promise<PostResult> {
  try {
    if (typeof fetchImpl !== "function") return { ok: false, status: null };
    const headers: Record<string, string> = {
      "content-type": "application/json",
      connection: "close",
    };
    if (authHeader) headers.authorization = authHeader;
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options.timeoutMs ?? WEBHOOK_TIMEOUT_MS),
    });
    if (options.debug) {
      safeWrite(options.stderr, `settled-webhook: POST status=${response.status}\n`);
    }
    if (!response.ok && options.debug) {
      let body = "";
      try {
        body = typeof response.text === "function" ? await response.text() : "";
      } catch {
        body = "";
      }
      const excerpt = redactSecrets(body, options.secrets ?? [url, authHeader]).slice(0, 180);
      if (excerpt) safeWrite(options.stderr, `settled-webhook: body=${excerpt}\n`);
    } else {
      try {
        await response.body?.cancel();
      } catch {
        // Ignore a closed body.
      }
    }
    return { ok: response.ok, status: response.status };
  } catch {
    if (options.debug) safeWrite(options.stderr, "settled-webhook: POST failed\n");
    return { ok: false, status: null };
  }
}

export function createNotifyController(options: {
  post: (payload: SettledWebhookPayload) => Promise<void>;
  now?: () => number;
  debounceMs?: number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}): NotifyController {
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS;
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as TimerHandle));
  let pending: SettledWebhookPayload | undefined;
  let timer: unknown;
  let scheduledAt = 0;
  const inflight: Promise<void>[] = [];

  function startPost(payload: SettledWebhookPayload): void {
    const task = Promise.resolve()
      .then(() => options.post(payload))
      .catch(() => {})
      .finally(() => {
        const index = inflight.indexOf(task);
        if (index >= 0) inflight.splice(index, 1);
      });
    inflight.push(task);
  }

  return {
    scheduleNotify(payload) {
      scheduledAt = now();
      pending = payload;
      if (timer !== undefined) clearTimer(timer);
      timer = setTimer(() => {
        timer = undefined;
        const next = pending;
        pending = undefined;
        if (next) startPost(next);
      }, debounceMs);
      void scheduledAt;
    },
    cancelPendingQuestion() {
      if (pending?.status !== "question") return;
      pending = undefined;
      if (timer !== undefined) {
        clearTimer(timer);
        timer = undefined;
      }
    },
    async flush(timeoutMs = SHUTDOWN_FLUSH_MS) {
      if (timer !== undefined) {
        clearTimer(timer);
        timer = undefined;
      }
      const next = pending;
      pending = undefined;
      if (next) startPost(next);
      const waiting = inflight.slice();
      if (waiting.length === 0) return;
      await Promise.race([
        Promise.all(waiting.map((item) => item.catch(() => {}))),
        new Promise<void>((resolve) => {
          setTimeout(resolve, timeoutMs);
        }),
      ]);
    },
    dispose() {
      pending = undefined;
      if (timer !== undefined) {
        clearTimer(timer);
        timer = undefined;
      }
    },
  };
}

function clearPriorRuntime(): void {
  const globals = globalThis as Record<symbol, unknown>;
  const timer = globals[TIMER_KEY];
  if (timer !== undefined) {
    try {
      clearTimeout(timer as TimerHandle);
    } catch {
      // Ignore a stale timer handle.
    }
    globals[TIMER_KEY] = undefined;
  }
  const dispose = globals[DISPOSE_KEY];
  globals[DISPOSE_KEY] = undefined;
  if (typeof dispose === "function") {
    try {
      (dispose as () => void)();
    } catch {
      // A stale dispose must not crash the next load.
    }
  }
}

function sessionIdOf(ctx: ExtensionContext): string {
  try {
    return ctx.sessionManager.getSessionId() ?? "";
  } catch {
    return "";
  }
}

function sessionFileOf(ctx: ExtensionContext): string | null {
  try {
    return ctx.sessionManager.getSessionFile() ?? null;
  } catch {
    return null;
  }
}

function assistantSnapshot(ctx: ExtensionContext): {
  stopReason?: string;
  errorMessage?: string;
  excerpt: string;
} {
  try {
    const assistant = lastAssistantFromBranch(ctx.sessionManager.getBranch());
    return {
      stopReason: assistant?.stopReason,
      errorMessage: assistant?.errorMessage,
      excerpt: excerptFromContent(assistant?.content),
    };
  } catch {
    return { excerpt: "" };
  }
}

function eventAborted(event: unknown): boolean {
  return Boolean(
    event &&
      typeof event === "object" &&
      "aborted" in event &&
      (event as { aborted?: unknown }).aborted === true,
  );
}

function eventKind(event: unknown): string | undefined {
  if (!event || typeof event !== "object" || !("kind" in event)) return undefined;
  const kind = (event as { kind?: unknown }).kind;
  return typeof kind === "string" ? kind : undefined;
}

export function installSettledWebhook(pi: ExtensionAPI, deps: InstallDeps = {}): StartupGate {
  clearPriorRuntime();
  const env = deps.env ?? process.env;
  const gate = startupGate(env);
  const stderr = deps.stderr ?? process.stderr;
  const globals = globalThis as Record<symbol, unknown>;
  let enabled = gate.ok;
  let lastPostFailed = false;
  const setTimer = deps.setTimer
    ? deps.setTimer
    : (callback: () => void, ms: number) => {
        const handle = setTimeout(callback, ms);
        globals[TIMER_KEY] = handle;
        return handle;
      };
  const clearTimer = deps.clearTimer
    ? deps.clearTimer
    : (handle: unknown) => {
        clearTimeout(handle as TimerHandle);
        if (globals[TIMER_KEY] === handle) globals[TIMER_KEY] = undefined;
      };
  const live = createNotifyController({
    now: deps.now,
    setTimer,
    clearTimer,
    post: async (payload) => {
      if (!enabled || !gate.ok) return;
      const result = await postSettledWebhook(gate.url, payload, gate.authHeader, deps.fetchImpl, {
        debug: gate.debug,
        stderr,
        secrets: [gate.url, gate.authHeader],
      });
      if (!result.ok) lastPostFailed = true;
    },
  });
  if (!deps.setTimer) globals[DISPOSE_KEY] = () => live.dispose();

  function notice(text: string): string {
    return lastPostFailed ? `${text} Last post failed.` : text;
  }

  pi.registerCommand("settled-webhook", {
    description: "Show or toggle the Grok Bot settled webhook for this gated process",
    handler: async (args, ctx) => {
      if (!gate.ok) {
        ctx.ui.notify(UNAVAILABLE_NOTICE, "warning");
        return;
      }
      const command = args.trim();
      if (command === "off") {
        enabled = false;
        live.dispose();
        ctx.ui.notify(notice("Settled webhook is off."), "info");
        return;
      }
      if (command === "on") {
        enabled = true;
        ctx.ui.notify(notice("Settled webhook is on."), "info");
        return;
      }
      ctx.ui.notify(notice(enabled ? "Settled webhook is on." : "Settled webhook is off."), "info");
    },
  });

  if (!gate.ok) return gate;

  function payloadFrom(ctx: ExtensionContext, status: WebhookStatus, aborted: boolean, promptKind?: PromptKind): SettledWebhookPayload {
    const assistant = assistantSnapshot(ctx);
    return buildPayload({
      cwd: ctx.cwd,
      sessionId: sessionIdOf(ctx),
      sessionFile: sessionFileOf(ctx),
      tmux: env.TMUX,
      tmuxPane: env.TMUX_PANE,
      launchEnv: env,
      excerpt: assistant.excerpt,
      status,
      aborted,
      promptKind,
      eventId: deps.randomId?.(),
    });
  }

  pi.on("agent_settled", (event, ctx) => {
    try {
      if (!enabled) return;
      if (ctx.isIdle() !== true) return;
      const assistant = assistantSnapshot(ctx);
      const classified = classifyStatus({
        stopReason: assistant.stopReason,
        errorMessage: assistant.errorMessage,
        aborted: eventAborted(event),
        excerpt: assistant.excerpt,
      });
      live.scheduleNotify(payloadFrom(ctx, classified.status, classified.aborted));
    } catch {
      // A settle notice must not crash Pi.
    }
  });

  const hooked = pi as HookAPI;
  try {
    hooked.on("ui_prompt_start", (event, ctx) => {
      try {
        if (!enabled) return;
        const kind = eventKind(event);
        if (!isQuestionPrompt(kind)) return;
        live.scheduleNotify(payloadFrom(ctx, "question", false, kind));
      } catch {
        // A prompt notice must not crash Pi.
      }
    });
    hooked.on("ui_prompt_end", () => {
      try {
        live.cancelPendingQuestion();
      } catch {
        // Ignore a late prompt end.
      }
    });
  } catch {
    // Older runtimes do not emit prompt events. Settle notices still work.
  }

  pi.on("session_shutdown", async () => {
    try {
      await live.flush(SHUTDOWN_FLUSH_MS);
    } catch {
      // Shutdown must not crash Pi.
    }
  });

  return gate;
}

export default function settledWebhookExtension(pi: ExtensionAPI): void {
  installSettledWebhook(pi);
}
