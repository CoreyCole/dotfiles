import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const CSV_PATH = join(homedir(), ".local", "state", "pi", "request-stats.csv");
const UNAVAILABLE = "not_available";
const NOT_APPLICABLE = "not_applicable";

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
    const columnIndex = header.indexOf(before);
    if (columnIndex < 0) continue;

    header.splice(columnIndex, 0, name);
    for (const row of rows) row.splice(columnIndex, 0, UNAVAILABLE);
    changed = true;
  }

  const transportIndex = header.indexOf("transport");
  const fastModeIndex = header.indexOf("fast_mode_requested");
  for (const row of rows) {
    if (row.length === header.length - 2) {
      row.splice(transportIndex, 0, UNAVAILABLE);
      row.splice(fastModeIndex, 0, UNAVAILABLE);
      changed = true;
    } else if (row.length === header.length - 1) {
      const missingIndex = ["true", "false"].includes(row[transportIndex])
        ? transportIndex
        : fastModeIndex;
      row.splice(missingIndex, 0, UNAVAILABLE);
      changed = true;
    }
  }

  if (!changed) return undefined;
  return `${[header, ...rows].map((row) => row.join(",")).join("\n")}\n`;
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
  if (migrated !== undefined) {
    await writeFile(CSV_PATH, migrated, { encoding: "utf8", mode: 0o600 });
  }
}

async function appendRow(
  row: readonly (string | number | boolean)[],
  csvInitialized: boolean,
): Promise<void> {
  const content = `${csvInitialized ? "" : `${CSV_HEADER}\n`}${row.map(csvCell).join(",")}\n`;
  await appendFile(CSV_PATH, content, { encoding: "utf8", mode: 0o600 });
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
    if (!activeRequest) return;
    activeRequest.xRequestID = event.headers["x-request-id"];
    activeRequest.transport = "sse";
  });

  pi.on("message_update", (event) => {
    if (!activeRequest || event.assistantMessageEvent.type === "start") return;

    activeRequest.streaming = true;
    activeRequest.transport ??= "websocket";
    activeRequest.firstTokenAt ??= performance.now();
  });

  pi.on("message_end", async (event, _ctx) => {
    if (event.message.role !== "assistant" || !activeRequest) return;

    const request = activeRequest;
    activeRequest = undefined;

    const finishedAt = performance.now();
    const totalMs = Math.round(finishedAt - request.startedAt);
    const ttftMs = request.firstTokenAt
      ? Math.round(request.firstTokenAt - request.startedAt)
      : UNAVAILABLE;
    const generationMs = request.firstTokenAt
      ? finishedAt - request.firstTokenAt
      : undefined;
    const outputTokens = event.message.usage.output;
    const outputTokensPerSecond =
      generationMs && generationMs > 0
        ? (outputTokens / (generationMs / 1000)).toFixed(3)
        : UNAVAILABLE;

    await appendRow(
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
        ttftMs,
        totalMs,
        outputTokens,
        outputTokensPerSecond,
        event.message.stopReason,
      ],
      csvInitialized,
    );
    csvInitialized = true;
  });
}

export const requestStatsTest = {
  CSV_HEADER,
  CSV_PATH,
  endpointName,
  csvCell,
  isFastModeRequested,
  migrateCsvColumns,
};
