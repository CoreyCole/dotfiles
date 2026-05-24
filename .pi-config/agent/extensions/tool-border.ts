// @ts-ignore: Patch the active pi runtime module instead of the local config dependency copy.
import { AssistantMessageComponent, ToolExecutionComponent, UserMessageComponent } from "/home/ruby/.local/share/mise/installs/node/25.8.0/lib/node_modules/@earendil-works/pi-coding-agent/dist/index.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "/home/ruby/.local/share/mise/installs/node/25.8.0/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-tui/dist/index.js";

const ORIGINAL_UPDATE_DISPLAY = Symbol.for("corey.toolBorderOriginalUpdateDisplay");
const ORIGINAL_RENDER = Symbol.for("corey.toolBorderOriginalRender");
const ORIGINAL_ASSISTANT_RENDER = Symbol.for("corey.toolBorderOriginalAssistantRender");
const ORIGINAL_ASSISTANT_UPDATE_CONTENT = Symbol.for("corey.toolBorderOriginalAssistantUpdateContent");
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
  if (filePath.startsWith(`${normalizedCwd}/`)) return filePath.slice(normalizedCwd.length + 1);
  return filePath;
}

function deterministicDocsSummary(result: ToolResult | undefined, width: number, cwd: string | undefined): string[] {
  const loaded = result?.details?.deterministicDocs?.loaded;
  if (!Array.isArray(loaded) || loaded.length === 0) return [];

  return loaded
    .map((entry) => entry?.path)
    .filter((path): path is string => typeof path === "string" && path.length > 0)
    .map((path) => truncateToWidth(` 📖 \x1b[90mload\x1b[39m \x1b[36m${displayPath(path, cwd)}\x1b[39m`, width, "..."));
}

function visibleReadResult(result: ToolResult | undefined): ToolResult | undefined {
  const hiddenBlocks = result?.details?.deterministicDocs?.autoContextContentBlocks;
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

function prefixFirstContentLine(lines: string[], prefix: string): string[] {
  const index = lines.findIndex((line) => {
    const text = stripAnsi(line).trim();
    return text !== "" && !/^─+$/.test(text) && !text.startsWith("loaded:");
  });
  if (index === -1) return lines;

  const next = [...lines];
  const line = next[index];
  const match = line.match(/^((?:\x1b\[[0-9;]*m)*)\s*/);
  const start = match?.[0] ?? "";
  const colors = match?.[1] ?? "";
  next[index] = `${colors}${prefix}${line.slice(start.length)}`;
  return next;
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
      lines = prefixFirstContentLine(lines, " ✏️ ");
    } else if (this.toolName === "read") {
      lines = prefixFirstContentLine(lines, " 📖 ");
    }

    if (hasBorder(lines)) return truncateLines(trimLeadingBlankLines(lines), width);

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
    return trimLeadingBlankLines(proto[ORIGINAL_ASSISTANT_RENDER].call(this, width) as string[]);
  };
}

function patchUserMessageSpacing() {
  const proto = UserMessageComponent.prototype as any;
  proto[ORIGINAL_USER_RENDER] ??= proto.render;

  proto.render = function render(width: number): string[] {
    const lines = proto[ORIGINAL_USER_RENDER].call(this, width) as string[];
    if (lines.length === 0 || stripAnsi(lines[lines.length - 1]).trim() === "") return lines;
    return [...lines, ""];
  };
}

export default function (_pi: ExtensionAPI) {
  patchToolExecutionBorder();
  patchAssistantMessageSpacing();
  patchUserMessageSpacing();
}
