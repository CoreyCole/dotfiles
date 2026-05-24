// @ts-ignore: Patch the active pi runtime module instead of the local config dependency copy.
import { ToolExecutionComponent } from "/home/ruby/.local/share/mise/installs/node/25.8.0/lib/node_modules/@earendil-works/pi-coding-agent/dist/index.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "/home/ruby/.local/share/mise/installs/node/25.8.0/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-tui/dist/index.js";

const PATCHED = Symbol.for("corey.toolBorderPatched");

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

function displayPath(filePath: string, cwd: string | undefined): string {
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
    .map((path) => truncateToWidth(`\x1b[90mloaded:\x1b[39m \x1b[36m${displayPath(path, cwd)}\x1b[39m`, width, "..."));
}

function visibleReadResult(result: ToolResult | undefined): ToolResult | undefined {
  const hiddenBlocks = result?.details?.deterministicDocs?.autoContextContentBlocks;
  if (typeof hiddenBlocks !== "number" || hiddenBlocks <= 0) return result;

  return {
    ...result,
    content: result?.content?.slice(hiddenBlocks),
  };
}

function patchToolExecutionBorder() {
  const proto = ToolExecutionComponent.prototype as any;
  if (proto[PATCHED]) return;
  proto[PATCHED] = true;

  const originalUpdateDisplay = proto.updateDisplay;
  proto.updateDisplay = function updateDisplay() {
    if (this.toolName !== "read" || !this.result) {
      return originalUpdateDisplay.call(this);
    }

    const originalResult = this.result;
    this.result = visibleReadResult(originalResult);
    try {
      return originalUpdateDisplay.call(this);
    } finally {
      this.result = originalResult;
    }
  };

  const originalRender = proto.render;
  proto.render = function render(width: number): string[] {
    const lines = originalRender.call(this, width) as string[];
    if (lines.length === 0) return lines;

    const insertAt = lines[0]?.trim() === "" ? 1 : 0;
    const prefix = [subtleBorder(width), ...deterministicDocsSummary(this.result, width, this.cwd)];
    return [...lines.slice(0, insertAt), ...prefix, ...lines.slice(insertAt)];
  };
}

export default function (_pi: ExtensionAPI) {
  patchToolExecutionBorder();
}
