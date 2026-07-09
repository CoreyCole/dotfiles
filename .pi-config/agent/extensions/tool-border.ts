import {
  AssistantMessageComponent,
  ToolExecutionComponent,
  UserMessageComponent,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { TOOL_DISPLAY } from "./tool-display-style.ts";

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
  return TOOL_DISPLAY.border("─".repeat(Math.max(1, width)));
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

function splitDisplayPath(
  path: string,
  cwd: string | undefined,
): { directory: string; filename: string; lineRange: string } {
  const displayed = displayPath(path, cwd);
  const lineRangeMatch = displayed.match(/:\d+(?:-\d+)?$/);
  const lineRange = lineRangeMatch?.[0] ?? "";
  const pathOnly = lineRange
    ? displayed.slice(0, -lineRange.length)
    : displayed;
  const slash = pathOnly.lastIndexOf("/");
  if (slash === -1) return { directory: "", filename: pathOnly, lineRange };
  return {
    directory: pathOnly.slice(0, slash + 1),
    filename: pathOnly.slice(slash + 1),
    lineRange,
  };
}

function pathDisplayLines(
  path: string,
  cwd: string | undefined,
  icon: string,
  width: number,
): string[] {
  const prefix = ` ${icon} `;
  const pathWidth = Math.max(1, width - visibleWidth(prefix));
  const continuationPrefix = " ".repeat(visibleWidth(prefix));
  const { directory, filename, lineRange } = splitDisplayPath(path, cwd);
  const styledFilename = `${TOOL_DISPLAY.filename(filename)}${TOOL_DISPLAY.lineNumber(lineRange)}`;
  const styledPath = `${TOOL_DISPLAY.path(directory)}${styledFilename}`;
  if (visibleWidth(`${prefix}${directory}${filename}${lineRange}`) <= width) {
    return [`${prefix}${styledPath}`];
  }

  const directoryLines = directory
    ? wrapTextWithAnsi(TOOL_DISPLAY.path(directory), pathWidth)
    : [];
  const lines = [...directoryLines];

  if (
    lines.length > 0 &&
    visibleWidth(`${lines[lines.length - 1]}${filename}${lineRange}`) <=
      pathWidth
  ) {
    lines[lines.length - 1] = `${lines[lines.length - 1]}${styledFilename}`;
  } else {
    lines.push(...wrapTextWithAnsi(styledFilename, pathWidth));
  }

  return lines.map((line, index) =>
    index === 0 ? `${prefix}${line}` : `${continuationPrefix}${line}`,
  );
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
    .flatMap((path) => pathDisplayLines(path, cwd, "🧠", width));
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

function firstContentLineIndex(lines: string[]): number {
  return lines.findIndex((line) => {
    const text = stripAnsi(line).trim();
    return text !== "" && !/^─+$/.test(text) && !text.startsWith("loaded:");
  });
}

function iconizeFirstContentLine(
  lines: string[],
  icon: string,
  toolName: "read" | "edit" | "write",
): string[] {
  const index = firstContentLineIndex(lines);
  if (index === -1) return lines;

  const next = [...lines];
  const line = next[index];
  const match = line.match(/^((?:\x1b\[[0-9;]*m)*\s*)/);
  const rawStart = match?.[0] ?? "";
  const displayStart = /\s/.test(stripAnsi(rawStart))
    ? rawStart
    : `${rawStart} `;
  const ansi = "(?:\\x1b\\[[0-9;]*m)*";
  const toolPrefix = new RegExp(`^${ansi}${toolName}${ansi}\\s*`);
  const content = line.slice(rawStart.length).replace(toolPrefix, "");
  if (content.trim() === "") {
    const pathIndex = next.findIndex((candidate, candidateIndex) => {
      if (candidateIndex <= index) return false;
      const text = stripAnsi(candidate).trim();
      return text !== "" && !/^─+$/.test(text) && !text.startsWith("loaded:");
    });
    if (pathIndex !== -1) {
      next[index] = `${displayStart}${icon}${next[pathIndex].trimStart()}`;
      next.splice(index + 1, pathIndex - index);
      return next;
    }
  }

  next[index] = `${displayStart}${icon}${content}`;
  return next;
}

function rawToolPath(
  args:
    | { path?: unknown; file_path?: unknown; offset?: unknown; limit?: unknown }
    | undefined,
): string | undefined {
  return typeof args?.file_path === "string"
    ? args.file_path
    : typeof args?.path === "string"
      ? args.path
      : undefined;
}

function toolPathDisplay(
  args:
    | { path?: unknown; file_path?: unknown; offset?: unknown; limit?: unknown }
    | undefined,
  cwd: string | undefined,
): string | undefined {
  const rawPath = rawToolPath(args);
  if (!rawPath) return undefined;

  let suffix = "";
  if (typeof args?.offset === "number" || typeof args?.limit === "number") {
    const start = typeof args.offset === "number" ? args.offset : 1;
    const end =
      typeof args.limit === "number" ? start + args.limit - 1 : undefined;
    suffix = `:${start}${end === undefined ? "" : `-${end}`}`;
  }
  return `${displayPath(rawPath, cwd)}${suffix}`;
}

function toolPathLines(
  args:
    | { path?: unknown; file_path?: unknown; offset?: unknown; limit?: unknown }
    | undefined,
  cwd: string | undefined,
  icon: string,
  width: number,
): string[] | undefined {
  const path = toolPathDisplay(args, cwd);
  if (!path) return undefined;

  return pathDisplayLines(path, undefined, icon, width);
}

function normalizePathFragment(text: string): string {
  return stripAnsi(text).replace(/\s+/g, "");
}

function pathFragmentMatches(
  fragment: string,
  normalizedPath: string,
): boolean {
  if (normalizedPath.includes(fragment) || fragment.includes(normalizedPath)) {
    return true;
  }

  const anchored = anchoredPath(fragment);
  return anchored !== undefined && normalizedPath.includes(anchored);
}

function replaceFirstContentLineBlock(
  lines: string[],
  replacements: string[],
  originalPath?: string,
): string[] {
  const index = firstContentLineIndex(lines);
  if (index === -1) return [...replacements, ...lines];

  const next = [...lines];
  let deleteCount = 1;
  const normalizedPath = originalPath
    ? normalizePathFragment(originalPath)
    : undefined;
  if (normalizedPath) {
    for (let i = index + 1; i < next.length; i++) {
      const fragment = normalizePathFragment(next[i]);
      if (!fragment || !pathFragmentMatches(fragment, normalizedPath)) break;
      deleteCount++;
    }
  }

  next.splice(index, deleteCount, ...replacements);
  return next;
}

function setBashStatusIcon(lines: string[], icon: string): string[] {
  const index = firstContentLineIndex(lines);
  if (index === -1) return lines;

  const next = [...lines];
  const line = next[index];
  const match = line.match(/^((?:\x1b\[[0-9;]*m)*\s*)/);
  const start = match?.[0] ?? "";
  const content = line.slice(start.length).replace(/^[🟢🟡🔴]\s*/, "");
  next[index] = `${start}${icon} ${content}`;
  return next;
}

function firstContentLine(lines: string[]): string[] {
  const index = firstContentLineIndex(lines);
  return index === -1 ? [] : [lines[index]];
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

function isPathDisplayLine(line: string): boolean {
  return /^\s*[📖✏️📝🧠]/u.test(stripAnsi(line));
}

function truncateLines(lines: string[], width: number): string[] {
  return lines.map((line) => {
    const trimmed = trimLineEnd(line);
    return isPathDisplayLine(trimmed)
      ? trimmed
      : truncateToWidth(trimmed, width);
  });
}

function wrapLines(lines: string[], width: number): string[] {
  return lines.flatMap((line) => {
    const trimmed = trimLineEnd(line);
    if (isPathDisplayLine(trimmed)) return [trimmed];
    return wrapTextWithAnsi(trimmed, Math.max(1, width));
  });
}

function restoreBashCollapsedHint(lines: string[]): string[] {
  if (lines.some((line) => stripAnsi(line).includes("earlier lines"))) {
    return lines;
  }

  const oldHintIndex = lines.findIndex((line) =>
    /^\s*\d+ lines\.\.\.\s*$/.test(stripAnsi(line)),
  );
  if (oldHintIndex === -1) return lines;

  const oldHint = stripAnsi(lines[oldHintIndex]);
  const indent = oldHint.match(/^\s*/)?.[0] ?? "";
  const skipped = oldHint.trim().match(/^(\d+) lines\.\.\.$/)?.[1];
  if (!skipped) return lines;

  const next = [...lines];
  next[oldHintIndex] =
    `${indent}${TOOL_DISPLAY.dim(`... (${skipped} earlier lines, ctrl+o to expand)`)}`;
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
      const pathLines = toolPathLines(this.args, this.cwd, "✏️", width);
      lines = pathLines
        ? replaceFirstContentLineBlock(
            lines,
            pathLines,
            toolPathDisplay(this.args, this.cwd),
          )
        : iconizeFirstContentLine(lines, "✏️", "edit");
    } else if (this.toolName === "write") {
      const pathLines = toolPathLines(this.args, this.cwd, "📝", width);
      lines = pathLines
        ? replaceFirstContentLineBlock(
            lines,
            pathLines,
            toolPathDisplay(this.args, this.cwd),
          )
        : iconizeFirstContentLine(lines, "📝", "write");
    } else if (this.toolName === "read") {
      const pathLines = toolPathLines(this.args, this.cwd, "📖", width);
      lines =
        pathLines ??
        firstContentLine(iconizeFirstContentLine(lines, "📖", "read"));
    } else if (this.toolName === "bash") {
      if (this.isPartial) lines = setBashStatusIcon(lines, "🟡");
      if (!this.expanded) lines = restoreBashCollapsedHint(lines);
      const content = trimLeadingBlankLines(lines);
      if (hasBorder(content)) return wrapLines(content, width);
      const docs = deterministicDocsSummary(this.result, width, this.cwd);
      return wrapLines(
        [...trimTrailingBlankLines(content), ...docs, subtleBorder(width)],
        width,
      );
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
    const indented = lines.flatMap((line) => {
      if (stripAnsi(line).trim() === "") return [line];
      return wrapTextWithAnsi(line, Math.max(1, width - 2)).map(
        (wrapped) => `  ${wrapped}`,
      );
    });
    return [...indented, subtleBorder(width)];
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
