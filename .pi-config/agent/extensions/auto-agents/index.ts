import type { ExtensionAPI, ReadToolDetails } from "@mariozechner/pi-coding-agent";
import { createReadToolDefinition } from "@mariozechner/pi-coding-agent";
import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";
import { findAncestorAgentsFiles, resolveReadTarget } from "./paths";
import { hashAgentsFile } from "./hash";
import { formatAutoAgentsSummary } from "./render";
import { rememberAgentsFile, restoreAutoAgentsState, shouldReadAgentsFile } from "./state";
import type { AutoAgentsReadDetails, AutoAgentsStateEntry } from "./types";

type ReadContent = TextContent | ImageContent;
type ReadResult = { content: ReadContent[]; details?: ReadToolDetails & AutoAgentsReadDetails };

type AutoLoadedAgentsRead = {
  entry: AutoAgentsStateEntry;
  result: ReadResult;
};

function textContent(text: string): TextContent {
  return { type: "text", text };
}

function textBlocks(result: ReadResult): string[] {
  return result.content.flatMap((content) => (content.type === "text" ? [content.text] : []));
}

function formatLoadedAgentsSection(autoLoaded: AutoLoadedAgentsRead[]): string | undefined {
  if (autoLoaded.length === 0) return undefined;

  const sections = autoLoaded.map(({ entry, result }) => {
    const body = textBlocks(result).join("\n").trimEnd();
    return [`## Auto-loaded context: ${entry.path}`, body || "[context file produced no text content]"].join("\n");
  });

  return ["# Auto-loaded project context", ...sections].join("\n\n");
}

function composeReadResult(args: {
  autoLoaded: AutoLoadedAgentsRead[];
  skipped: string[];
  targetResult: ReadResult;
}): ReadResult {
  const loaded = args.autoLoaded.map(({ entry }) => entry);
  if (loaded.length === 0) return args.targetResult;

  const loadedSection = formatLoadedAgentsSection(args.autoLoaded);
  const prefix = [loadedSection].filter((part): part is string => Boolean(part));
  const content = prefix.length > 0 ? [textContent(prefix.join("\n\n")), ...args.targetResult.content] : args.targetResult.content;

  return {
    ...args.targetResult,
    content,
    details: {
      ...(args.targetResult.details ?? {}),
      autoAgents: { loaded, skipped: [], autoContextContentBlocks: prefix.length },
    },
  };
}

export default function autoAgents(pi: ExtensionAPI) {
  const cwd = process.cwd();
  const originalRead = createReadToolDefinition(cwd);
  let state = { byPath: new Map<string, AutoAgentsStateEntry>() };

  pi.on("session_start", async (_event, ctx) => {
    state = restoreAutoAgentsState(ctx);
  });

  pi.registerTool({
    name: "read",
    label: originalRead.label,
    description: originalRead.description,
    promptSnippet: originalRead.promptSnippet,
    promptGuidelines: originalRead.promptGuidelines,
    parameters: originalRead.parameters,

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const target = resolveReadTarget(cwd, params.path);
      const candidates = findAncestorAgentsFiles(target.absolutePath);
      const autoLoaded: AutoLoadedAgentsRead[] = [];
      const skipped: string[] = [];

      for (const agentsPath of candidates) {
        const hash = hashAgentsFile(agentsPath);
        if (!shouldReadAgentsFile(state, { path: agentsPath, hash })) {
          skipped.push(agentsPath);
          continue;
        }

        const result = (await originalRead.execute(toolCallId, { path: agentsPath }, signal, onUpdate, ctx)) as ReadResult;
        const entry: AutoAgentsStateEntry = {
          path: agentsPath,
          hash,
          loadedAt: new Date().toISOString(),
          triggerPath: target.absolutePath,
        };
        rememberAgentsFile(state, entry, pi.appendEntry);
        autoLoaded.push({ entry, result });
      }

      const targetResult = (await originalRead.execute(toolCallId, params, signal, onUpdate, ctx)) as ReadResult;
      return composeReadResult({ autoLoaded, skipped, targetResult });
    },

    renderCall: originalRead.renderCall,
    renderResult(result, options, theme, context) {
      const readResult = result as ReadResult;
      const autoContextContentBlocks = readResult.details?.autoAgents?.autoContextContentBlocks ?? 0;
      const visibleResult =
        autoContextContentBlocks > 0
          ? { ...readResult, content: readResult.content.slice(autoContextContentBlocks) }
          : readResult;
      const base = originalRead.renderResult?.(visibleResult as any, options, theme, context as any);
      const summary = formatAutoAgentsSummary(readResult, options, theme);
      if (!summary) return base ?? new Text("", 0, 0);
      if (!base) return new Text(summary, 0, 0);

      const baseLines = base
        .render(200)
        .map((line) => line.trimEnd())
        .join("\n")
        .trimEnd();
      return new Text([summary, baseLines].filter(Boolean).join("\n"), 0, 0);
    },
  });
}
