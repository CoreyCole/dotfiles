import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendFile, mkdir, stat } from "node:fs/promises";
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

async function appendRow(row: readonly (string | number | boolean)[]): Promise<void> {
  await mkdir(dirname(CSV_PATH), { recursive: true, mode: 0o700 });

  let isEmpty = false;
  try {
    isEmpty = (await stat(CSV_PATH)).size === 0;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    isEmpty = true;
  }

  const content = `${isEmpty ? `${CSV_HEADER}\n` : ""}${row.map(csvCell).join(",")}\n`;
  await appendFile(CSV_PATH, content, { encoding: "utf8", mode: 0o600 });
}

export default function requestStatsExtension(pi: ExtensionAPI) {
  let activeRequest: RequestStats | undefined;

  pi.on("before_provider_request", (_event, ctx) => {
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
      streaming: false,
    };
  });

  pi.on("after_provider_response", (event) => {
    if (!activeRequest) return;
    activeRequest.xRequestID = event.headers["x-request-id"];
  });

  pi.on("message_update", (event) => {
    if (!activeRequest || event.assistantMessageEvent.type === "start") return;

    activeRequest.streaming = true;
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

    await appendRow([
      request.timestamp,
      xClientRequestID(request),
      valueOrUnavailable(request.xRequestID),
      valueOrUnavailable(event.message.responseId),
      request.provider,
      request.model,
      request.api,
      request.endpoint,
      request.streaming,
      ttftMs,
      totalMs,
      outputTokens,
      outputTokensPerSecond,
      event.message.stopReason,
    ]);
  });
}

export const requestStatsTest = {
  CSV_HEADER,
  CSV_PATH,
  endpointName,
  csvCell,
};
