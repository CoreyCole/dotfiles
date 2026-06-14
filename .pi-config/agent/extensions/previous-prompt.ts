import type {
  ExtensionAPI,
  ExtensionContext,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

const WIDGET_KEY = "previous-prompt";
const WIDGET_PREFIX = "❓ ";
const WIDGET_OPTIONS = { placement: "belowEditor" } as const;
const MAX_PROMPT_CHARS = 160;
const MAX_PROMPT_LINES = 4;

type QrspiResult = {
  stage: string;
  next: string;
};

function tagPattern(tagName: string): string {
  return tagName
    .split("")
    .map((char) => `${char}\\s*`)
    .join("");
}

function extractXmlTag(text: string, tagName: string): string | undefined {
  const tag = tagPattern(tagName);
  const match = text.match(
    new RegExp(
      `<\\s*${tag}(?:\\s+[^>]*)?>\\s*([\\s\\S]*?)\\s*<\\s*/\\s*${tag}>`,
      "i",
    ),
  );
  return match?.[1];
}

function normalizeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeNextText(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0].replace(/\s+/g, " ").trim();

  const [first, ...rest] = lines;
  if (first.startsWith("/") && rest.length > 0) {
    return `${first.replace(/\s+/g, " ").trim()} ${rest.join("")}`.trim();
  }
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

function parseQrspiResult(text: string): QrspiResult | undefined {
  if (!new RegExp(`<\\s*${tagPattern("qrspi-result")}`, "i").test(text))
    return undefined;

  const stage = normalizeXmlText(extractXmlTag(text, "stage") ?? "");
  const next = normalizeNextText(
    normalizeXmlText(extractXmlTag(text, "next") ?? ""),
  );
  if (!stage || !next) return undefined;
  return { stage, next };
}

function formatNextStage(next: string): string {
  const match = next.match(/^\/(?:skill:)?(q-[^\s]+)/);
  return match?.[1] ?? next.split(/\s+/, 1)[0] ?? "next";
}

function formatQrspiPrompt(text: string): string | undefined {
  const qrspi = parseQrspiResult(text);
  if (!qrspi) return undefined;
  return `[qrspi:${formatNextStage(qrspi.next)}] <- ${qrspi.stage}`;
}

function formatSkillPrompt(text: string): string | undefined {
  const match = text.match(/^\/skill:(\S+)\s*([\s\S]*)/);
  if (!match) return undefined;

  const skillName = match[1];
  const userPrompt = match[2].trim().replace(/\s+/g, " ");
  return userPrompt ? `💪 ${skillName} ${userPrompt}` : `💪 ${skillName}`;
}

function normalizePromptText(text: string): string | undefined {
  const normalized = text.trim();
  if (!normalized) return undefined;

  const qrspiPrompt = formatQrspiPrompt(normalized);
  if (qrspiPrompt) return qrspiPrompt;

  const skillPrompt = formatSkillPrompt(normalized);
  if (skillPrompt)
    return skillPrompt.length <= MAX_PROMPT_CHARS
      ? skillPrompt
      : `${skillPrompt.slice(0, MAX_PROMPT_CHARS - 1).trimEnd()}…`;

  if (normalized.length <= MAX_PROMPT_CHARS) return normalized;
  return `${normalized.slice(0, MAX_PROMPT_CHARS - 1).trimEnd()}…`;
}

type TextContentPart = { type: "text"; text: string };

type UserMessageWithContent = {
  role: "user";
  content: string | TextContentPart[];
  timestamp: number;
};

function isTextContentPart(part: unknown): part is TextContentPart {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    part.type === "text" &&
    "text" in part &&
    typeof part.text === "string"
  );
}

function isUserMessageWithContent(
  message: SessionMessageEntry["message"],
): message is UserMessageWithContent {
  return (
    message.role === "user" &&
    "content" in message &&
    (typeof message.content === "string" || Array.isArray(message.content))
  );
}

function textFromUserMessage(entry: SessionMessageEntry): string | undefined {
  if (!isUserMessageWithContent(entry.message)) return undefined;

  const { content } = entry.message;
  if (typeof content === "string") return content;

  const text = content
    .filter(isTextContentPart)
    .map((part) => part.text)
    .join("\n\n");
  return text || undefined;
}

function latestUserPromptFromBranch(ctx: ExtensionContext): string | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry?.type !== "message" || entry.message.role !== "user") continue;

    const text = textFromUserMessage(entry);
    if (text) return normalizePromptText(text);
  }
  return undefined;
}

function truncatePromptLines(lines: string[], width: number): string[] {
  if (lines.length <= MAX_PROMPT_LINES) return lines;

  const visibleLines = lines.slice(0, MAX_PROMPT_LINES);
  const lastLineIndex = visibleLines.length - 1;
  if (width <= 1) {
    visibleLines[lastLineIndex] = "…";
    return visibleLines;
  }

  visibleLines[lastLineIndex] =
    `${truncateToWidth(visibleLines[lastLineIndex].trimEnd(), width - 1)}…`;
  return visibleLines;
}

function updatePreviousPromptWidget(
  ctx: ExtensionContext,
  prompt: string | undefined,
): void {
  if (!ctx.hasUI) return;

  if (!prompt) {
    ctx.ui.setWidget(WIDGET_KEY, undefined, WIDGET_OPTIONS);
    return;
  }

  ctx.ui.setWidget(
    WIDGET_KEY,
    (_tui, theme) => ({
      render(width: number): string[] {
        const safeWidth = Math.max(1, width);
        const promptWidth = Math.max(1, safeWidth - WIDGET_PREFIX.length);
        const promptLines = truncatePromptLines(
          wrapTextWithAnsi(prompt, promptWidth),
          promptWidth,
        );
        return promptLines.map((line, index) => {
          const prefix =
            index === 0 ? WIDGET_PREFIX : " ".repeat(WIDGET_PREFIX.length);
          return truncateToWidth(
            theme.fg("muted", `${prefix}${line}`),
            safeWidth,
          );
        });
      },
      invalidate() {},
    }),
    WIDGET_OPTIONS,
  );
}

export default function previousPromptExtension(pi: ExtensionAPI) {
  let pendingPrompt: string | undefined;
  let sentPrompts: string[] = [];

  const restoreFromBranch = (ctx: ExtensionContext) => {
    pendingPrompt = undefined;
    sentPrompts = [];
    updatePreviousPromptWidget(ctx, latestUserPromptFromBranch(ctx));
  };

  pi.on("session_start", (_event, ctx) => {
    restoreFromBranch(ctx);
  });

  pi.on("session_tree", (_event, ctx) => {
    restoreFromBranch(ctx);
  });

  pi.on("input", (event, ctx) => {
    if (event.source === "extension") {
      return { action: "continue" as const };
    }

    const prompt = normalizePromptText(event.text);
    if (!prompt) {
      return { action: "continue" as const };
    }

    if (ctx.isIdle()) {
      pendingPrompt = prompt;
    } else {
      sentPrompts.push(prompt);
    }

    return { action: "continue" as const };
  });

  pi.on("before_agent_start", () => {
    if (!pendingPrompt) return;
    sentPrompts.push(pendingPrompt);
    pendingPrompt = undefined;
  });

  pi.on("message_end", (event, ctx) => {
    if (event.message.role !== "user") return;

    const prompt = sentPrompts.shift();
    if (!prompt) return;

    updatePreviousPromptWidget(ctx, prompt);
  });
}
