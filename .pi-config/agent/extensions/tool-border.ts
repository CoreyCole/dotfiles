import {
  AssistantMessageComponent,
  ToolExecutionComponent,
  UserMessageComponent,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

const ORIGINAL_UPDATE_DISPLAY = Symbol.for(
  "corey.toolBorderOriginalUpdateDisplay",
);
const ORIGINAL_RENDER = Symbol.for("corey.toolBorderOriginalRender");
const ORIGINAL_ASSISTANT_RENDER = Symbol.for(
  "corey.toolBorderOriginalAssistantRender",
);
const ORIGINAL_ASSISTANT_UPDATE_CONTENT = Symbol.for(
  "corey.toolBorderOriginalAssistantUpdateContent",
);
const ORIGINAL_USER_RENDER = Symbol.for("corey.toolBorderOriginalUserRender");

type TextBlock = { type: string; text?: string };
type ToolResult = {
  content?: TextBlock[];
  details?: {
    deterministicDocs?: {
      loaded?: Array<{ path?: unknown }>;
      autoContextContentBlocks?: unknown;
    };
  };
};

function subtleBorder(width: number): string {
  return `\x1b[90m${"─".repeat(Math.max(1, width))}\x1b[39m`;
}

const LOAD_PATH_ANCHORS = ["thoughts", "chestnut-flake"];

function anchoredPath(filePath: string): string | undefined {
  const parts = filePath.split("/");
  for (const anchor of LOAD_PATH_ANCHORS) {
    const anchorIndex = parts.findIndex((part) => part === anchor);
    if (anchorIndex !== -1) return parts.slice(anchorIndex).join("/");
  }
  return undefined;
}

function displayPath(filePath: string, cwd: string | undefined): string {
  const anchored = anchoredPath(filePath);
  if (anchored) return anchored;

  const base = cwd || process.cwd();
  const normalizedCwd = base.endsWith("/") ? base.slice(0, -1) : base;
  if (filePath === normalizedCwd) return ".";
  if (filePath.startsWith(`${normalizedCwd}/`))
    return filePath.slice(normalizedCwd.length + 1);
  return filePath;
}

function deterministicDocsSummary(
  result: ToolResult | undefined,
  width: number,
  cwd: string | undefined,
): string[] {
  const loaded = result?.details?.deterministicDocs?.loaded;
  if (!Array.isArray(loaded) || loaded.length === 0) return [];

  return loaded
    .map((entry) => entry?.path)
    .filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    )
    .map((path) =>
      truncateToWidth(
        ` 🧠\x1b[36m${displayPath(path, cwd)}\x1b[39m`,
        width,
        "...",
      ),
    );
}

function visibleReadResult(
  result: ToolResult | undefined,
): ToolResult | undefined {
  const hiddenBlocks =
    result?.details?.deterministicDocs?.autoContextContentBlocks;
  if (typeof hiddenBlocks !== "number" || hiddenBlocks <= 0) return result;

  return {
    ...result,
    content: result?.content?.slice(hiddenBlocks),
  };
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function isBorderLine(line: string): boolean {
  return /^─+$/.test(stripAnsi(line).trim());
}

function hasBorder(lines: string[]): boolean {
  return lines.some(isBorderLine);
}

function iconizeFirstContentLine(
  lines: string[],
  icon: string,
  toolName: "read" | "edit" | "write",
): string[] {
  const index = lines.findIndex((line) => {
    const text = stripAnsi(line).trim();
    return text !== "" && !/^─+$/.test(text) && !text.startsWith("loaded:");
  });
  if (index === -1) return lines;

  const next = [...lines];
  const line = next[index];
  const match = line.match(/^((?:\x1b\[[0-9;]*m)*\s*)/);
  const start = match?.[0] ?? "";
  const ansi = "(?:\\x1b\\[[0-9;]*m)*";
  const toolPrefix = new RegExp(`^${ansi}${toolName}${ansi}\\s*`);
  const content = line.slice(start.length).replace(toolPrefix, "");
  if (content.trim() === "" && next[index + 1]) {
    next[index] = `${start}${icon}${next[index + 1].trimStart()}`;
    next.splice(index + 1, 1);
    return next;
  }

  next[index] = `${start}${icon}${content}`;
  return next;
}

function firstContentLine(lines: string[]): string[] {
  const line = lines.find((candidate) => {
    const text = stripAnsi(candidate).trim();
    return text !== "" && !/^─+$/.test(text);
  });
  return line ? [line] : [];
}

function trimLeadingBlankLines(lines: string[]): string[] {
  let start = 0;
  while (start < lines.length && stripAnsi(lines[start]).trim() === "") start++;
  return lines.slice(start);
}

function trimTrailingBlankLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && stripAnsi(lines[end - 1]).trim() === "") end--;
  return lines.slice(0, end);
}

function trimLineEnd(line: string): string {
  return line.replace(/[ \t]+((?:\x1b\[[0-9;]*m)*)$/, "$1");
}

function truncateLines(lines: string[], width: number): string[] {
  return lines.map((line) => truncateToWidth(trimLineEnd(line), width));
}

function textOutputLineCount(result: ToolResult | undefined): number {
  const text = result?.content
    ?.filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text?.trimEnd())
    .filter(Boolean)
    .join("\n");
  if (!text) return 0;
  return text.split("\n").length;
}

function restoreBashCollapsedHint(
  lines: string[],
  result: ToolResult | undefined,
): string[] {
  const lineCount = textOutputLineCount(result);
  const skipped = lineCount - 5;
  if (skipped <= 0) return lines;

  const timingIndex = lines.findIndex((line) =>
    /\b(?:Took|Elapsed)\b/.test(stripAnsi(line)),
  );
  const outputEnd = timingIndex === -1 ? lines.length : timingIndex;
  const outputIndent =
    lines
      .slice(Math.max(0, outputEnd - 5), outputEnd)
      .map((line) => stripAnsi(line).match(/^\s*/)?.[0] ?? "")
      .find((indent) => indent.length > 0) ?? "";
  const hint = `${outputIndent}\x1b[90m... (${skipped} earlier lines, to expand)\x1b[39m`;
  const existingHint = lines.findIndex((line) =>
    stripAnsi(line).includes("earlier lines"),
  );
  if (existingHint !== -1) {
    const next = [...lines];
    next[existingHint] = hint;
    return next;
  }

  const next = lines.filter(
    (line) => !/^\s*\d+ lines\.\.\.\s*$/.test(stripAnsi(line)),
  );
  const filteredTimingIndex = next.findIndex((line) =>
    /\b(?:Took|Elapsed)\b/.test(stripAnsi(line)),
  );
  const filteredOutputEnd =
    filteredTimingIndex === -1 ? next.length : filteredTimingIndex;
  const insertAt = Math.max(1, filteredOutputEnd - 5);
  next.splice(insertAt, 0, hint);
  return next;
}

function patchToolExecutionBorder() {
  const proto = ToolExecutionComponent.prototype as any;
  proto[ORIGINAL_UPDATE_DISPLAY] ??= proto.updateDisplay;
  proto[ORIGINAL_RENDER] ??= proto.render;

  proto.updateDisplay = function updateDisplay() {
    if (this.toolName !== "read" || !this.result) {
      return proto[ORIGINAL_UPDATE_DISPLAY].call(this);
    }

    const originalResult = this.result;
    this.result = visibleReadResult(originalResult);
    try {
      return proto[ORIGINAL_UPDATE_DISPLAY].call(this);
    } finally {
      this.result = originalResult;
    }
  };

  proto.render = function render(width: number): string[] {
    let lines = proto[ORIGINAL_RENDER].call(this, width) as string[];
    if (lines.length === 0) return lines;

    if (this.toolName === "edit") {
      lines = iconizeFirstContentLine(lines, "✏️", "edit");
    } else if (this.toolName === "write") {
      lines = iconizeFirstContentLine(lines, "✏️", "write");
    } else if (this.toolName === "read") {
      lines = firstContentLine(iconizeFirstContentLine(lines, "📖", "read"));
    } else if (this.toolName === "bash" && !this.expanded) {
      lines = restoreBashCollapsedHint(lines, this.result);
    }

    if (hasBorder(lines))
      return truncateLines(trimLeadingBlankLines(lines), width);

    const content = trimTrailingBlankLines(trimLeadingBlankLines(lines));
    const docs = deterministicDocsSummary(this.result, width, this.cwd);
    return truncateLines([...content, ...docs, subtleBorder(width)], width);
  };
}

function patchAssistantMessageSpacing() {
  const proto = AssistantMessageComponent.prototype as any;
  proto[ORIGINAL_ASSISTANT_RENDER] ??= proto.render;
  proto[ORIGINAL_ASSISTANT_UPDATE_CONTENT] ??= proto.updateContent;

  proto.updateContent = function updateContent(message: unknown) {
    proto[ORIGINAL_ASSISTANT_UPDATE_CONTENT].call(this, message);
    const contentContainer = this.contentContainer;
    while (contentContainer?.children?.[0]?.constructor?.name === "Spacer") {
      contentContainer.removeChild(contentContainer.children[0]);
    }
  };

  proto.render = function render(width: number): string[] {
    const lines = trimTrailingBlankLines(
      trimLeadingBlankLines(
        proto[ORIGINAL_ASSISTANT_RENDER].call(this, width) as string[],
      ),
    );
    const content = this.lastMessage?.content;
    const hasThinking =
      Array.isArray(content) &&
      content.some(
        (block) =>
          block?.type === "thinking" &&
          typeof block.thinking === "string" &&
          block.thinking.trim(),
      );
    const hasText =
      Array.isArray(content) &&
      content.some(
        (block) =>
          block?.type === "text" &&
          typeof block.text === "string" &&
          block.text.trim(),
      );
    if (!hasThinking || hasText || hasBorder(lines)) return lines;
    const indented = lines.map((line) =>
      stripAnsi(line).trim() === "" ? line : `  ${line}`,
    );
    return truncateLines([...indented, subtleBorder(width)], width);
  };
}

function patchUserMessageSpacing() {
  const proto = UserMessageComponent.prototype as any;
  proto[ORIGINAL_USER_RENDER] ??= proto.render;

  proto.render = function render(width: number): string[] {
    const lines = proto[ORIGINAL_USER_RENDER].call(this, width) as string[];
    if (lines.length === 0 || stripAnsi(lines[lines.length - 1]).trim() === "")
      return lines;
    return [...lines, ""];
  };
}

export default function (_pi: ExtensionAPI) {
  patchToolExecutionBorder();
  patchAssistantMessageSpacing();
  patchUserMessageSpacing();
}
