import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type LeadEventKind =
  | "agent_settled"
  | "subagent_settled"
  | "subagent_report";

export type LeadEvent = {
  ts: string;
  kind: LeadEventKind;
  session: string;
  cwd: string;
  summary: string;
  snippet: string;
};

type Subscription = {
  webhookUrl?: string;
};

const SNIPPET_MAX = 800;
const SUMMARY_MAX = 160;
const WEBHOOK_TIMEOUT_MS = 3000;
const SUBAGENT_CUSTOM_TYPES = new Map<string, LeadEventKind>([
  ["subagent_result", "subagent_settled"],
  ["subagent_ping", "subagent_report"],
  ["subagent_status", "subagent_report"],
]);

type SettledExtensionAPI = ExtensionAPI & {
  on(
    event: "agent_settled",
    handler: (event: unknown, ctx: ExtensionContext) => void | Promise<void>,
  ): void;
};

export function agentDir(): string {
  return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

export function leadInboxPath(root = agentDir()): string {
  return join(root, "lead-inbox", "events.jsonl");
}

export function classifySubagentCustomType(
  customType: string,
): LeadEventKind | undefined {
  return SUBAGENT_CUSTOM_TYPES.get(customType);
}

export function resolveWebhookUrl(
  argUrl?: string,
  envUrl = process.env.PI_LEAD_WEBHOOK_URL,
): { url?: string; error?: string } {
  const raw = argUrl?.trim() || envUrl?.trim() || "";
  if (!raw) return {};
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: `Webhook URL must be http(s): ${raw}` };
    }
    return { url: parsed.toString() };
  } catch {
    return { error: `Invalid webhook URL: ${raw}` };
  }
}

export function extractText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (
        block &&
        typeof block === "object" &&
        "text" in block &&
        typeof (block as { text: unknown }).text === "string"
      ) {
        return (block as { text: string }).text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function firstLine(text: string, max = SUMMARY_MAX): string {
  const line = text.split("\n").find((candidate) => candidate.trim()) ?? "";
  return truncate(line.trim(), max);
}

export function buildLeadEvent(input: {
  kind: LeadEventKind;
  session: string;
  cwd: string;
  summary: string;
  snippet: string;
  ts?: string;
}): LeadEvent {
  return {
    ts: input.ts ?? new Date().toISOString(),
    kind: input.kind,
    session: input.session,
    cwd: input.cwd,
    summary: firstLine(input.summary || input.snippet),
    snippet: truncate(input.snippet, SNIPPET_MAX),
  };
}

export function appendLeadEvent(
  event: LeadEvent,
  filePath = leadInboxPath(),
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
}

export async function postLeadWebhook(
  url: string,
  event: LeadEvent,
  fetchImpl: typeof fetch = fetch,
  authHeader = process.env.PI_LEAD_WEBHOOK_AUTH?.trim() ||
    (process.env.PI_LEAD_WEBHOOK_KEY?.trim()
      ? `Bearer ${process.env.PI_LEAD_WEBHOOK_KEY.trim()}`
      : ""),
): Promise<void> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (authHeader) {
    headers.authorization = authHeader;
  }
  await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });
}

function sessionIdOf(ctx: ExtensionContext): string {
  try {
    return ctx.sessionManager.getSessionId() ?? "";
  } catch {
    return "";
  }
}

function lastAssistantText(ctx: ExtensionContext): string {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i] as {
      type?: string;
      message?: { role?: string; content?: unknown };
    };
    if (entry.type !== "message") continue;
    if (entry.message?.role !== "assistant") continue;
    return extractText(entry.message.content);
  }
  return "";
}

function customMessageSummary(
  customType: string,
  content: string,
  details: unknown,
): string {
  const record =
    details && typeof details === "object"
      ? (details as Record<string, unknown>)
      : {};
  const name =
    typeof record.name === "string" && record.name
      ? record.name
      : typeof record.childSessionId === "string"
        ? record.childSessionId
        : "subagent";
  if (customType === "subagent_ping") return `subagent ping: ${name}`;
  if (customType === "subagent_status") {
    const kind = typeof record.kind === "string" ? record.kind : "status";
    return `subagent ${kind}: ${name}`;
  }
  const reason = typeof record.reason === "string" ? record.reason : "";
  if (reason) return `subagent ${name} ${reason}`;
  return firstLine(content) || `subagent ${name} settled`;
}

export default function (pi: ExtensionAPI) {
  const api = pi as SettledExtensionAPI;
  let subscription: Subscription | undefined;
  const processedIds = new Set<string>();

  function seedProcessed(ctx: ExtensionContext): void {
    for (const entry of ctx.sessionManager.getBranch()) {
      if ((entry as { type?: string }).type === "custom_message") {
        processedIds.add((entry as { id: string }).id);
      }
    }
  }

  function deliver(event: LeadEvent): void {
    try {
      appendLeadEvent(event);
    } catch {
      return;
    }
    const webhookUrl = subscription?.webhookUrl;
    if (!webhookUrl) return;
    void postLeadWebhook(webhookUrl, event).catch(() => {});
  }

  function scanSubagentEvents(ctx: ExtensionContext): void {
    if (!subscription) return;
    for (const entry of ctx.sessionManager.getBranch()) {
      const custom = entry as {
        type?: string;
        id?: string;
        customType?: string;
        content?: unknown;
        details?: unknown;
      };
      if (custom.type !== "custom_message" || !custom.id) continue;
      if (processedIds.has(custom.id)) continue;
      const kind = classifySubagentCustomType(custom.customType ?? "");
      if (!kind) continue;
      processedIds.add(custom.id);
      const content = extractText(custom.content);
      deliver(
        buildLeadEvent({
          kind,
          session: sessionIdOf(ctx),
          cwd: ctx.cwd,
          summary: customMessageSummary(
            custom.customType ?? "",
            content,
            custom.details,
          ),
          snippet: content,
        }),
      );
    }
  }

  pi.on("session_start", (_event, ctx) => {
    processedIds.clear();
    seedProcessed(ctx);
  });

  pi.on("agent_start", (_event, ctx) => {
    scanSubagentEvents(ctx);
  });

  pi.on("turn_start", (_event, ctx) => {
    scanSubagentEvents(ctx);
  });

  api.on("agent_settled", (_event, ctx) => {
    if (!subscription || ctx.isIdle() !== true) return;
    scanSubagentEvents(ctx);
    const snippet = lastAssistantText(ctx);
    deliver(
      buildLeadEvent({
        kind: "agent_settled",
        session: sessionIdOf(ctx),
        cwd: ctx.cwd,
        summary: snippet ? firstLine(snippet) : "manager settled",
        snippet: snippet || "manager settled",
      }),
    );
  });

  pi.registerCommand("lead-subscribe", {
    description:
      "Subscribe this session so Lead gets settle events. Usage: /lead-subscribe [webhookUrl]",
    handler: async (args, ctx) => {
      const argUrl = args.trim();
      const resolved = resolveWebhookUrl(argUrl || undefined);
      if (resolved.error) {
        ctx.ui.notify(resolved.error, "error");
        return;
      }
      subscription = { webhookUrl: resolved.url };
      processedIds.clear();
      seedProcessed(ctx);
      const sink = resolved.url
        ? `jsonl + webhook ${resolved.url}`
        : "jsonl (local)";
      ctx.ui.notify(`Lead subscribed (${sink})`, "info");
    },
  });

  pi.registerCommand("lead-unsubscribe", {
    description: "Stop Lead settle notifications for this session",
    handler: async (_args, ctx) => {
      if (!subscription) {
        ctx.ui.notify("Lead is not subscribed in this session", "warning");
        return;
      }
      subscription = undefined;
      ctx.ui.notify("Lead unsubscribed", "info");
    },
  });
}
