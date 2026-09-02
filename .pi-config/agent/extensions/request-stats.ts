import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  appendFile,
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const STATE_DIR = join(homedir(), ".local", "state", "pi", "request-stats");
const CSV_PATH = join(homedir(), ".local", "state", "pi", "request-stats.csv");
const UNAVAILABLE = "not_available";
const NOT_APPLICABLE = "not_applicable";
export const REQUEST_STATS_VERSION = 1;

export type RequestStatsAggregate = {
  version: 1;
  sessionId: string;
  buckets: {
    provider: string;
    model: string;
    outputTokens: number;
    generationMs: number;
  }[];
};

const CSV_HEADER = [
  "timestamp_utc",
  "x_client_request_id",
  "x_request_id",
  "response_id",
  "provider",
  "model",
  "api",
  "endpoint",
  "transport",
  "fast_mode_requested",
  "streaming",
  "ttft_ms",
  "total_ms",
  "output_tokens",
  "output_tokens_per_second",
  "stop_reason",
].join(",");

type RequestStats = {
  startedAt: number;
  timestamp: string;
  sessionID: string;
  provider: string;
  model: string;
  api: string;
  endpoint: string;
  xRequestID?: string;
  transport?: "sse" | "websocket";
  fastModeRequested: boolean;
  firstTokenAt?: number;
  streaming: boolean;
};

function endpointName(api: string): string {
  switch (api) {
    case "openai-responses":
      return "Responses";
    case "openai-codex-responses":
      return "Codex Responses";
    case "openai-completions":
      return "Chat Completions";
    default:
      return api;
  }
}
function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function valueOrUnavailable(value: string | undefined): string {
  return value?.trim() || UNAVAILABLE;
}
function xClientRequestID(stats: RequestStats): string {
  return stats.api.startsWith("openai-") ? stats.sessionID : NOT_APPLICABLE;
}
function isFastModeRequested(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    (payload as Record<string, unknown>).service_tier === "priority"
  );
}

function migrateCsvColumns(content: string): string | undefined {
  const lines = content.trimEnd().split(/\r?\n/);
  const header = lines[0]?.split(",") ?? [];
  const rows = lines.slice(1).map((line) => line.split(","));
  let changed = false;
  for (const [name, before] of [
    ["transport", "streaming"],
    ["fast_mode_requested", "streaming"],
  ] as const) {
    if (header.includes(name)) continue;
    const index = header.indexOf(before);
    if (index < 0) continue;
    header.splice(index, 0, name);
    for (const row of rows) row.splice(index, 0, UNAVAILABLE);
    changed = true;
  }
  return changed
    ? `${[header, ...rows].map((row) => row.join(",")).join("\n")}\n`
    : undefined;
}
async function ensureStatsColumns(): Promise<void> {
  let content: string;
  try {
    content = await readFile(CSV_PATH, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const migrated = migrateCsvColumns(content);
  if (migrated !== undefined)
    await writeFile(CSV_PATH, migrated, { encoding: "utf8", mode: 0o600 });
}
async function appendRow(
  row: readonly (string | number | boolean)[],
  initialized: boolean,
): Promise<void> {
  await appendFile(
    CSV_PATH,
    `${initialized ? "" : `${CSV_HEADER}\n`}${row.map(csvCell).join(",")}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

export function requestStatsSidecarPath(
  sessionId: string,
  stateDir = STATE_DIR,
): string {
  return join(stateDir, "sessions", `${sessionId}.json`);
}
export function validateRequestStatsAggregate(
  value: unknown,
  sessionId: string,
): RequestStatsAggregate | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const state = value as Record<string, unknown>;
  if (
    state.version !== 1 ||
    state.sessionId !== sessionId ||
    !Array.isArray(state.buckets)
  )
    return undefined;
  const buckets = state.buckets.map((bucket) => {
    if (!bucket || typeof bucket !== "object" || Array.isArray(bucket))
      return undefined;
    const b = bucket as Record<string, unknown>;
    return typeof b.provider === "string" &&
      typeof b.model === "string" &&
      typeof b.outputTokens === "number" &&
      Number.isFinite(b.outputTokens) &&
      b.outputTokens >= 0 &&
      typeof b.generationMs === "number" &&
      Number.isFinite(b.generationMs) &&
      b.generationMs >= 0
      ? {
          provider: b.provider,
          model: b.model,
          outputTokens: b.outputTokens,
          generationMs: b.generationMs,
        }
      : undefined;
  });
  return buckets.every(Boolean)
    ? {
        version: 1,
        sessionId,
        buckets: buckets as RequestStatsAggregate["buckets"],
      }
    : undefined;
}
export async function readRequestStatsAggregate(
  sessionId: string,
  stateDir = STATE_DIR,
): Promise<RequestStatsAggregate | undefined> {
  try {
    return validateRequestStatsAggregate(
      JSON.parse(
        await readFile(requestStatsSidecarPath(sessionId, stateDir), "utf8"),
      ),
      sessionId,
    );
  } catch {
    return undefined;
  }
}
export async function updateRequestStatsAggregate(
  sessionId: string,
  provider: string,
  model: string,
  outputTokens: number,
  generationMs: number,
  stateDir = STATE_DIR,
): Promise<void> {
  if (
    !Number.isFinite(outputTokens) ||
    outputTokens < 0 ||
    !Number.isFinite(generationMs) ||
    generationMs <= 0
  )
    return;
  const file = requestStatsSidecarPath(sessionId, stateDir);
  const directory = dirname(file);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  let aggregate = await readRequestStatsAggregate(sessionId, stateDir);
  if (!aggregate) aggregate = { version: 1, sessionId, buckets: [] };
  const bucket = aggregate.buckets.find(
    (candidate) => candidate.provider === provider && candidate.model === model,
  );
  if (bucket) {
    bucket.outputTokens += outputTokens;
    bucket.generationMs += generationMs;
  } else
    aggregate.buckets.push({ provider, model, outputTokens, generationMs });
  const temporary = join(directory, `.${sessionId}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(aggregate)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, file);
  } catch (error) {
    await import("node:fs/promises").then(({ unlink }) =>
      unlink(temporary).catch(() => {}),
    );
    throw error;
  }
}

export default function requestStatsExtension(pi: ExtensionAPI) {
  let activeRequest: RequestStats | undefined;
  let csvInitialized = false;
  pi.on("session_start", async () => {
    await mkdir(dirname(CSV_PATH), { recursive: true, mode: 0o700 });
    await ensureStatsColumns();
    try {
      csvInitialized = (await stat(CSV_PATH)).size > 0;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  });
  pi.on("before_provider_request", (event, ctx) => {
    const model = ctx.model;
    if (!model) return;
    activeRequest = {
      startedAt: performance.now(),
      timestamp: new Date().toISOString(),
      sessionID: ctx.sessionManager.getSessionId(),
      provider: model.provider,
      model: model.id,
      api: model.api,
      endpoint: endpointName(model.api),
      fastModeRequested: isFastModeRequested(event.payload),
      streaming: false,
    };
  });
  pi.on("after_provider_response", (event) => {
    if (activeRequest) {
      activeRequest.xRequestID = event.headers["x-request-id"];
      activeRequest.transport = "sse";
    }
  });
  pi.on("message_update", (event) => {
    if (!activeRequest || event.assistantMessageEvent.type === "start") return;
    activeRequest.streaming = true;
    activeRequest.transport ??= "websocket";
    activeRequest.firstTokenAt ??= performance.now();
  });
  pi.on("message_end", async (event) => {
    if (event.message.role !== "assistant" || !activeRequest) return;
    const request = activeRequest;
    activeRequest = undefined;
    const finishedAt = performance.now();
    const totalMs = Math.round(finishedAt - request.startedAt);
    const generationMs = request.firstTokenAt
      ? finishedAt - request.firstTokenAt
      : undefined;
    const outputTokens = event.message.usage.output;
    const tps =
      generationMs && generationMs > 0
        ? (outputTokens / (generationMs / 1000)).toFixed(3)
        : UNAVAILABLE;
    const csv = appendRow(
      [
        request.timestamp,
        xClientRequestID(request),
        valueOrUnavailable(request.xRequestID),
        valueOrUnavailable(event.message.responseId),
        request.provider,
        request.model,
        request.api,
        request.endpoint,
        request.transport ?? UNAVAILABLE,
        request.fastModeRequested,
        request.streaming,
        request.firstTokenAt
          ? Math.round(request.firstTokenAt - request.startedAt)
          : UNAVAILABLE,
        totalMs,
        outputTokens,
        tps,
        event.message.stopReason,
      ],
      csvInitialized,
    ).then(() => {
      csvInitialized = true;
    });
    const aggregate =
      generationMs === undefined
        ? Promise.resolve()
        : updateRequestStatsAggregate(
            request.sessionID,
            request.provider,
            request.model,
            outputTokens,
            generationMs,
          );
    const results = await Promise.allSettled([csv, aggregate]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  });
}

export const requestStatsTest = {
  CSV_HEADER,
  CSV_PATH,
  STATE_DIR,
  endpointName,
  csvCell,
  isFastModeRequested,
  migrateCsvColumns,
  validateRequestStatsAggregate,
  requestStatsSidecarPath,
  readRequestStatsAggregate,
  updateRequestStatsAggregate,
};
