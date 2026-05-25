// @ts-ignore: Use the active pi runtime module, not a local config dependency copy.
import { createEditToolDefinition } from "/home/ruby/.local/share/mise/installs/node/25.8.0/lib/node_modules/@earendil-works/pi-coding-agent/dist/index.js";
// @ts-ignore: Use the active pi runtime's bundled TUI package.
import { Container, Text } from "/home/ruby/.local/share/mise/installs/node/25.8.0/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-tui/dist/index.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";

// Match lazygit's delta pager flags so Pi edit diffs use the same visual style.
const DELTA_ARGS = [
  "--paging=never",
  "--tabs=2",
  // Hide delta's file header; Pi already labels the tool call with the edited path.
  "--file-style=omit",
  "-n",
  "--hyperlinks",
  "--hyperlinks-file-link-format=lazygit-edit://{path}:{line}",
];

type TextBlock = { type: string; text?: string };
type EditResult = {
  content: TextBlock[];
  details?: { diff?: string; patch?: string; firstChangedLine?: number };
};
type RenderContext = {
  args?: { path?: string; file_path?: string };
  isError: boolean;
  lastComponent?: unknown;
};

type ParsedDiffLine = {
  kind: "add" | "remove" | "context" | "skip";
  lineNum?: number;
  content: string;
};

function parseDisplayDiffLine(line: string): ParsedDiffLine | undefined {
  const match = line.match(/^([+\- ])(\s*\d*)\s(.*)$/);
  if (!match) return undefined;

  const content = match[3];
  if (content === "...") return { kind: "skip", content };

  const lineNumText = match[2].trim();
  const lineNum = lineNumText ? Number.parseInt(lineNumText, 10) : undefined;
  const prefix = match[1];
  if (prefix === "+") return { kind: "add", lineNum, content };
  if (prefix === "-") return { kind: "remove", lineNum, content };
  return { kind: "context", lineNum, content };
}

function hunkHeader(lines: ParsedDiffLine[]): string {
  const oldStart = lines.find((line) => line.kind !== "add" && line.lineNum !== undefined)?.lineNum ?? 1;
  const newStart = lines.find((line) => line.kind !== "remove" && line.lineNum !== undefined)?.lineNum ?? oldStart;
  const oldCount = Math.max(1, lines.filter((line) => line.kind !== "add").length);
  const newCount = Math.max(1, lines.filter((line) => line.kind !== "remove").length);
  return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
}

function toUnifiedDiff(displayDiff: string, filePath: string): string {
  const parsedLines = displayDiff
    .split("\n")
    .map(parseDisplayDiffLine)
    .filter((line): line is ParsedDiffLine => line !== undefined);

  const output = [`--- a/${filePath}`, `+++ b/${filePath}`];
  let hunk: ParsedDiffLine[] = [];

  const flush = () => {
    if (hunk.length === 0) return;
    output.push(hunkHeader(hunk));
    for (const line of hunk) {
      const prefix = line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " ";
      output.push(`${prefix}${line.content}`);
    }
    hunk = [];
  };

  for (const line of parsedLines) {
    if (line.kind === "skip") {
      flush();
    } else {
      hunk.push(line);
    }
  }
  flush();

  return `${output.join("\n")}\n`;
}

function renderWithDelta(displayDiff: string, filePath: string, patch?: string): string | undefined {
  const delta = spawnSync("delta", DELTA_ARGS, {
    input: patch ?? toUnifiedDiff(displayDiff, filePath),
    encoding: "utf8",
    env: { ...process.env, CLICOLOR_FORCE: "1", NO_COLOR: undefined },
  });

  if (delta.error || delta.status !== 0 || !delta.stdout.trim()) return undefined;
  return delta.stdout.trim();
}

function errorText(result: EditResult): string | undefined {
  const text = result.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n");
  return text || undefined;
}

export default function (pi: ExtensionAPI) {
  const edit = createEditToolDefinition(process.cwd());
  const originalRenderResult = edit.renderResult?.bind(edit);

  pi.registerTool({
    ...edit,
    renderCall(args, theme, context) {
      const text = context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
      const path = context.args?.file_path ?? context.args?.path ?? args?.file_path ?? args?.path ?? "...";
      text.setText(`${theme.fg("toolTitle", theme.bold("edit"))} ${theme.fg("accent", path)}`);
      return text;
    },
    renderResult(result: EditResult, options, theme, context: RenderContext) {
      if (context.isError) {
        const message = errorText(result);
        if (!message) {
          const component = context.lastComponent instanceof Container ? context.lastComponent : new Container();
          component.clear();
          return component;
        }
        const text = context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
        text.setText(`\n${theme.fg("error", message)}`);
        return text;
      }

      const diff = result.details?.diff;
      const path = context.args?.file_path ?? context.args?.path ?? "edit";
      const deltaOutput = diff ? renderWithDelta(diff, path, result.details?.patch) : undefined;
      if (!deltaOutput) {
        return originalRenderResult?.(result, options, theme, context) ?? new Container();
      }

      const text = context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
      text.setText(deltaOutput);
      return text;
    },
  });
}
