import {
  buildContextEntries,
  buildSessionContext,
  parseSessionEntries,
  type SessionEntry as PiSessionEntry,
} from "@earendil-works/pi-coding-agent";
import {
  appendFileSync,
  closeSync,
  copyFileSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

export interface SessionEntry {
  type: string;
  id: string;
  parentId?: string;
  [key: string]: unknown;
}

export interface MessageEntry extends SessionEntry {
  type: "message";
  message: {
    role: "user" | "assistant" | "toolResult";
    content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  };
}

export type SeededSubagentSessionMode = "lineage-only" | "fork";

function getForkContentLines(parentSessionFile: string): string[] {
  const raw = readFileSync(parentSessionFile, "utf8");
  const lines = raw.split("\n").filter((line) => line.trim());

  let truncateAt = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === "message" && entry.message?.role === "user") {
        truncateAt = i;
        break;
      }
    } catch {
      // ignore malformed lines
    }
  }

  return lines.slice(0, truncateAt).filter((line) => {
    try {
      return JSON.parse(line).type !== "session";
    } catch {
      return true;
    }
  });
}

export function seedSubagentSessionFile(params: {
  mode: SeededSubagentSessionMode;
  parentSessionFile: string;
  childSessionFile: string;
  childCwd: string;
  childSessionId?: string;
}): string {
  const childSessionId = params.childSessionId ?? randomUUID();
  const header = {
    type: "session",
    version: 3,
    id: childSessionId,
    timestamp: new Date().toISOString(),
    cwd: params.childCwd,
    parentSession: params.parentSessionFile,
  };
  const contentLines =
    params.mode === "fork" ? getForkContentLines(params.parentSessionFile) : [];
  const lines = [JSON.stringify(header), ...contentLines];

  mkdirSync(dirname(params.childSessionFile), { recursive: true });
  writeFileSync(params.childSessionFile, lines.join("\n") + "\n", {
    encoding: "utf8",
    flag: "wx",
  });
  return childSessionId;
}

function readEntries(sessionFile: string): SessionEntry[] {
  const raw = readFileSync(sessionFile, "utf8");
  const entries: SessionEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as SessionEntry);
    } catch {}
  }
  return entries;
}

export interface SessionPeek {
  provider?: string;
  model?: string;
  totalTokens?: number;
  messages: Array<{ role: string; text: string }>;
}

export function inspectSession(sessionFile: string, tail = 5): SessionPeek {
  const entries = parseSessionEntries(readFileSync(sessionFile, "utf8")).filter(
    (entry): entry is PiSessionEntry => entry.type !== "session",
  );
  if (entries.length === 0) return { messages: [] };
  const active = buildContextEntries(entries);
  const context = buildSessionContext(entries);
  const compaction = active.find((entry) => entry.type === "compaction");
  const compactionIndex = compaction
    ? entries.findIndex((entry) => entry.id === compaction.id)
    : -1;
  const activeIds = new Set(active.map((entry) => entry.id));
  const usageCandidates = entries
    .slice(compactionIndex + 1)
    .filter((entry) => activeIds.has(entry.id));
  let totalTokens: number | undefined;
  for (const entry of usageCandidates) {
    if (entry.type !== "message" || entry.message.role !== "assistant")
      continue;
    const message = entry.message;
    if (
      message.stopReason !== "error" &&
      message.stopReason !== "aborted" &&
      Number.isFinite(message.usage?.totalTokens) &&
      message.usage.totalTokens > 0
    )
      totalTokens = message.usage.totalTokens;
  }
  const messages = active.flatMap((entry) => {
    if (
      entry.type !== "message" ||
      (entry.message.role !== "user" && entry.message.role !== "assistant")
    )
      return [];
    const message = entry.message;
    const blocks = Array.isArray(message.content)
      ? message.content
      : [{ type: "text", text: message.content }];
    const text = blocks
      .filter(
        (block): block is { type: "text"; text: string } =>
          block.type === "text" &&
          "text" in block &&
          typeof block.text === "string",
      )
      .map((block) => block.text)
      .join("\n")
      .trim();
    return text
      ? [
          {
            role: message.role,
            text: text.length > 600 ? `${text.slice(0, 597)}…` : text,
          },
        ]
      : [];
  });
  return {
    provider: context.model?.provider,
    model: context.model?.modelId,
    totalTokens,
    messages: messages.slice(-tail),
  };
}

/**
 * Return the id of the last entry in the session file (current branch point / leaf).
 */
export function getLeafId(sessionFile: string): string | null {
  const entries = readEntries(sessionFile);
  return entries.length > 0 ? entries[entries.length - 1].id : null;
}

/**
 * Return entries added after `afterLine` (1-indexed count of existing entries).
 */
export function getNewEntries(
  sessionFile: string,
  afterLine: number,
): SessionEntry[] {
  const raw = readFileSync(sessionFile, "utf8");
  const lines = raw.split("\n").filter((line) => line.trim());
  return lines.slice(afterLine).map((line) => JSON.parse(line) as SessionEntry);
}

export interface SessionReadCursor {
  offset: number;
  pending: Buffer;
}

/** Byte size, or 0 when the session file does not exist yet. */
export function sessionFileSize(sessionFile: string): number {
  try {
    return statSync(sessionFile).size;
  } catch {
    return 0;
  }
}

function splitCompleteLines(
  pending: Buffer,
  chunk: Buffer,
): { lines: string[]; pending: Buffer } {
  const combined = pending.length > 0 ? Buffer.concat([pending, chunk]) : chunk;
  const newline = combined.lastIndexOf(0x0a);
  if (newline < 0) return { lines: [], pending: combined };
  const text = combined.subarray(0, newline).toString("utf8");
  return {
    lines: text.length > 0 ? text.split("\n") : [],
    pending: combined.subarray(newline + 1),
  };
}

/**
 * Read only bytes appended since `cursor`. Does not reread the session history.
 */
export function readNewSessionEntries(
  sessionFile: string,
  cursor: SessionReadCursor,
): { entries: SessionEntry[]; cursor: SessionReadCursor } {
  let fd: number;
  try {
    fd = openSync(sessionFile, "r");
  } catch {
    return { entries: [], cursor };
  }
  try {
    const size = fstatSync(fd).size;
    let offset = cursor.offset;
    let pending = cursor.pending;
    if (size < offset) {
      offset = 0;
      pending = Buffer.alloc(0);
    }
    if (size === offset) return { entries: [], cursor: { offset, pending } };
    const length = size - offset;
    const buffer = Buffer.alloc(length);
    const read = readSync(fd, buffer, 0, length, offset);
    const decoded = splitCompleteLines(pending, buffer.subarray(0, read));
    const entries: SessionEntry[] = [];
    for (const line of decoded.lines) {
      if (!line.trim()) continue;
      entries.push(JSON.parse(line) as SessionEntry);
    }
    return {
      entries,
      cursor: { offset: offset + read, pending: decoded.pending },
    };
  } finally {
    closeSync(fd);
  }
}

/**
 * Find the last assistant message text in a list of entries.
 *
 * Falls back to the `errorMessage` field when the last assistant message has
 * `stopReason: "error"` and no usable text content — this happens when
 * auto-retry exhausts on a provider overload / rate limit / server error, and
 * without this fallback the parent would silently see a stale earlier message.
 */
export function findLastAssistantMessage(
  entries: SessionEntry[],
): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== "message") continue;
    const msg = entry as MessageEntry;
    if (msg.message.role !== "assistant") continue;

    const texts = msg.message.content
      .filter(
        (block) =>
          block.type === "text" &&
          typeof block.text === "string" &&
          block.text.trim() !== "",
      )
      .map((block) => block.text as string);

    if (texts.length > 0 && texts.join("").trim()) return texts.join("\n");

    const stopReason = (msg.message as { stopReason?: unknown }).stopReason;
    const errorMessage = (msg.message as { errorMessage?: unknown })
      .errorMessage;
    if (
      stopReason === "error" &&
      typeof errorMessage === "string" &&
      errorMessage.trim() !== ""
    ) {
      return `Subagent error: ${errorMessage.trim()}`;
    }
  }
  return null;
}

/**
 * Append a branch_summary entry to the session file.
 * Returns the new entry's id.
 */
export function appendBranchSummary(
  sessionFile: string,
  branchPointId: string,
  fromId: string | null,
  summary: string,
): string {
  const id = randomBytes(4).toString("hex");
  const entry = {
    type: "branch_summary",
    id,
    parentId: branchPointId,
    timestamp: new Date().toISOString(),
    fromId: fromId ?? branchPointId,
    summary,
  };
  appendFileSync(sessionFile, JSON.stringify(entry) + "\n", "utf8");
  return id;
}

/**
 * Copy the session file to destDir for parallel worker isolation.
 * Returns the path of the copy.
 */
export function copySessionFile(sessionFile: string, destDir: string): string {
  const id = randomBytes(4).toString("hex");
  const dest = join(destDir, `subagent-${id}.jsonl`);
  copyFileSync(sessionFile, dest);
  return dest;
}

/**
 * Read new entries from sourceFile (after afterLine), append them to targetFile.
 * Returns the appended entries.
 */
export function mergeNewEntries(
  sourceFile: string,
  targetFile: string,
  afterLine: number,
): SessionEntry[] {
  const entries = getNewEntries(sourceFile, afterLine);
  for (const entry of entries) {
    appendFileSync(targetFile, JSON.stringify(entry) + "\n", "utf8");
  }
  return entries;
}
