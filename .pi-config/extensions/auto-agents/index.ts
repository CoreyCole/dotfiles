import type { ExtensionAPI, ReadToolDetails } from "@mariozechner/pi-coding-agent";
import { createReadToolDefinition } from "@mariozechner/pi-coding-agent";
import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";
import { findAncestorAgentsFiles, resolveReadTarget } from "./paths";
import { hashAgentsFile } from "./hash";
import { renderAutoAgentsSummary } from "./render";
import { rememberAgentsFile, restoreAutoAgentsState, shouldReadAgentsFile } from "./state";
import type { AutoAgentsReadDetails, AutoAgentsStateEntry } from "./types";

type ReadContent = TextContent | ImageContent;
type ReadResult = { content: ReadContent[]; details?: ReadToolDetails };

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
    return [`## Auto-loaded AGENTS.md: ${entry.path}`, body || "[AGENTS.md produced no text content]"].join("\n");
  });

  return ["# Auto-loaded AGENTS.md context", ...sections].join("\n\n");
}

function formatAutoAgentsNotice(loaded: AutoAgentsStateEntry[], skipped: string[]): string | undefined {
  if (loaded.length === 0 && skipped.length === 0) return undefined;

  const lines = [`[auto-agents loaded ${loaded.length}, skipped ${skipped.length}]`];
  for (const entry of loaded) lines.push(`loaded: ${entry.path}`);
  for (const path of skipped) lines.push(`skipped: ${path}`);
  return lines.join("\n");
}

function composeReadResult(args: {
  autoLoaded: AutoLoadedAgentsRead[];
  skipped: string[];
  targetResult: ReadResult;
}): ReadResult & { details: ReadToolDetails & AutoAgentsReadDetails } {
  const loaded = args.autoLoaded.map(({ entry }) => entry);
  const notice = formatAutoAgentsNotice(loaded, args.skipped);
  const loadedSection = formatLoadedAgentsSection(args.autoLoaded);
  const prefix = [notice, loadedSection].filter((part): part is string => Boolean(part));
  const content = prefix.length > 0 ? [textContent(prefix.join("\n\n")), ...args.targetResult.content] : args.targetResult.content;

  return {
    ...args.targetResult,
    content,
    details: {
      ...(args.targetResult.details ?? {}),
      autoAgents: { loaded, skipped: args.skipped },
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
      const base = originalRead.renderResult?.(result as any, options, theme, context as any);
      const summary = renderAutoAgentsSummary(result as { details?: AutoAgentsReadDetails }, options, theme);
      if (!summary) return base ?? new Text("", 0, 0);
      if (!base) return summary;

      const baseLines = base.render(200).join("\n").trimEnd();
      const summaryLines = summary.render(200).join("\n").trimEnd();
      return new Text([summaryLines, baseLines].filter(Boolean).join("\n"), 0, 0);
    },
  });
}
