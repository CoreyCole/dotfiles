import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, hostname } from "node:os";
import { dirname, join, basename } from "node:path";
import { parse as parseYAML } from "yaml";

type JsonRecord = Record<string, unknown>;

const WRITER_NAME = "vamos-pi-metadata";
const WRITER_VERSION = "0.1.0";
const EVENT_LOG_PATH = join(
  homedir(),
  ".local",
  "share",
  "vamos",
  "pi-sessions",
  "events.jsonl",
);

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      const record = asRecord(block);
      return record?.type === "text" && typeof record.text === "string"
        ? record.text
        : "";
    })
    .filter(Boolean)
    .join("\n");
}

function latestAssistantMessageText(
  event: unknown,
  ctx: any,
): {
  text: string;
  entryId?: string;
  parentEntryId?: string;
  provider?: string;
  model?: string;
} {
  const eventRecord = asRecord(event);
  const eventMessages = Array.isArray(eventRecord?.messages)
    ? eventRecord.messages
    : [];
  for (const message of [...eventMessages].reverse()) {
    const record = asRecord(message);
    if (record?.role === "assistant") {
      return {
        text: textFromContent(record.content),
        provider:
          typeof record.provider === "string" ? record.provider : undefined,
        model: typeof record.model === "string" ? record.model : undefined,
      };
    }
  }

  const branch =
    typeof ctx.sessionManager?.getBranch === "function"
      ? ctx.sessionManager.getBranch()
      : [];
  for (const entry of [...branch].reverse()) {
    const record = asRecord(entry);
    const message = asRecord(record?.message);
    if (record?.type === "message" && message?.role === "assistant") {
      return {
        text: textFromContent(message.content),
        entryId: typeof record.id === "string" ? record.id : undefined,
        parentEntryId:
          typeof record.parentId === "string" ? record.parentId : undefined,
        provider:
          typeof message.provider === "string" ? message.provider : undefined,
        model: typeof message.model === "string" ? message.model : undefined,
      };
    }
  }

  return { text: "" };
}

function gitValue(cwd: string, args: string[]): string | undefined {
  try {
    return (
      execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 1000,
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

function projectIDFromRemote(remote: string | undefined): string | undefined {
  if (!remote) return undefined;
  const trimmed = remote.trim().replace(/\.git$/, "");
  const ssh = trimmed.match(/^git@([^:]+):(.+)$/);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;
  const https = trimmed.match(/^https?:\/\/([^/]+)\/(.+)$/);
  if (https) return `${https[1]}/${https[2]}`;
  return undefined;
}

function detectGitProject(cwd: string): JsonRecord | undefined {
  const gitRoot = gitValue(cwd, ["rev-parse", "--show-toplevel"]);
  if (!gitRoot) return undefined;
  const branch = gitValue(cwd, ["branch", "--show-current"]);
  const commit = gitValue(cwd, ["rev-parse", "HEAD"]);
  const remote = gitValue(cwd, ["config", "--get", "remote.origin.url"]);
  const id = projectIDFromRemote(remote);
  return {
    ...(id ? { id } : {}),
    repository: basename(gitRoot),
    git_root: gitRoot,
    ...(branch ? { branch } : {}),
    ...(commit ? { commit } : {}),
  };
}

function normalizeThoughtsPlanDir(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const normalized = raw.replaceAll("\\", "/");
  const thoughtsIndex = normalized.lastIndexOf("/thoughts/");
  const candidate = normalized.startsWith("thoughts/")
    ? normalized
    : thoughtsIndex >= 0
      ? `thoughts/${normalized.slice(thoughtsIndex + "/thoughts/".length)}`
      : undefined;
  if (!candidate) return undefined;
  const match = candidate.match(/^(thoughts\/[^/]+\/plans\/[^/]+)/);
  return match?.[1];
}

function detectPlanFromCwd(cwd: string): JsonRecord | undefined {
  const planDir = normalizeThoughtsPlanDir(cwd);
  return planDir ? { plan_dir: planDir } : undefined;
}

function extractFencedQRSPIResult(text: string): string | undefined {
  const fencePattern = /```(?:yaml|yml)?\s*\n([\s\S]*?)```/gi;
  for (const match of text.matchAll(fencePattern)) {
    const body = match[1]?.trim();
    if (body?.includes("qrspi_result:")) return body;
  }
  const bare = text.match(/(^|\n)(qrspi_result:\n[\s\S]*)/);
  return bare?.[2]?.trim();
}

function hashText(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function qrspiPayloadFromText(
  text: string,
): { qrspi: JsonRecord; plan?: JsonRecord } | undefined {
  const raw = extractFencedQRSPIResult(text);
  if (!raw) return undefined;

  let parsed: JsonRecord | undefined;
  try {
    parsed = asRecord(parseYAML(raw));
  } catch {
    return undefined;
  }
  const result = asRecord(parsed?.qrspi_result);
  if (!result) return undefined;

  const workspaceMetadata = asRecord(result.workspace_metadata);
  const planDir = normalizeThoughtsPlanDir(
    typeof workspaceMetadata?.plan_workspace === "string"
      ? workspaceMetadata.plan_workspace
      : typeof result.workspace === "string"
        ? result.workspace
        : typeof result.artifact === "string"
          ? result.artifact
          : undefined,
  );

  if (!planDir) return undefined;

  const stage = typeof result.stage === "string" ? result.stage : undefined;
  return {
    plan: {
      plan_dir: planDir,
      ...(typeof workspaceMetadata?.implementation_workspace === "string"
        ? {
            implementation_workspace:
              workspaceMetadata.implementation_workspace,
          }
        : {}),
    },
    qrspi: {
      ...(stage ? { stage, workflow_node_id: stage } : {}),
      ...(typeof result.status === "string" ? { status: result.status } : {}),
      ...(typeof result.outcome === "string"
        ? { outcome: result.outcome }
        : {}),
      ...(typeof result.artifact === "string"
        ? { artifact: result.artifact }
        : {}),
      result_json: result,
      result_yaml: raw,
      raw_result: raw,
      raw_result_hash: hashText(raw),
      ...(result.summary !== undefined ? { summary: result.summary } : {}),
    },
  };
}

async function appendEvent(event: JsonRecord): Promise<void> {
  await mkdir(dirname(EVENT_LOG_PATH), { recursive: true });
  await appendFile(EVENT_LOG_PATH, `${JSON.stringify(event)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function baseEvent(
  ctx: any,
  eventType: string,
  message?: { provider?: string; model?: string },
): JsonRecord {
  const cwd = typeof ctx.cwd === "string" ? ctx.cwd : process.cwd();
  const sessionFile =
    typeof ctx.sessionManager?.getSessionFile === "function"
      ? ctx.sessionManager.getSessionFile()
      : undefined;
  const sessionID =
    typeof ctx.sessionManager?.getSessionId === "function"
      ? ctx.sessionManager.getSessionId()
      : undefined;
  const project = detectGitProject(cwd);
  const plan = detectPlanFromCwd(cwd);
  return {
    schema_version: 1,
    event_id: randomUUID(),
    event_type: eventType,
    event_time: new Date().toISOString(),
    writer: {
      name: WRITER_NAME,
      version: WRITER_VERSION,
      pid: process.pid,
      hostname: hostname(),
    },
    pi: {
      ...(sessionID ? { session_id: sessionID } : {}),
      ...(sessionFile ? { session_file: sessionFile } : {}),
      cwd,
      ...(message?.provider ? { provider: message.provider } : {}),
      ...(message?.model ? { model: message.model } : {}),
    },
    ...(project ? { project } : {}),
    ...(plan ? { plan } : {}),
    workspace: {
      kind: existsSync(join(cwd, ".vamos")) ? "implementation" : "unknown",
      absolute_path: cwd,
    },
  };
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    await appendEvent(baseEvent(ctx, "session_start"));
  });

  pi.on("agent_start", async (_event, ctx) => {
    await appendEvent(baseEvent(ctx, "agent_start"));
  });

  pi.on("agent_end", async (event, ctx) => {
    const assistant = latestAssistantMessageText(event, ctx);
    await appendEvent(baseEvent(ctx, "agent_end", assistant));

    const extracted = qrspiPayloadFromText(assistant.text);
    if (!extracted) return;

    await appendEvent({
      ...baseEvent(ctx, "qrspi_result", assistant),
      plan: extracted.plan,
      qrspi: extracted.qrspi,
      source: {
        ...(assistant.entryId ? { message_entry_id: assistant.entryId } : {}),
        ...(assistant.parentEntryId
          ? { parent_entry_id: assistant.parentEntryId }
          : {}),
        assistant_message_hash: hashText(assistant.text),
      },
    });
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    await appendEvent(baseEvent(ctx, "session_shutdown"));
  });
}

export const vamosPiMetadataTest = {
  eventLogPath: EVENT_LOG_PATH,
  extractFencedQRSPIResult,
  qrspiPayloadFromText,
  normalizeThoughtsPlanDir,
};
