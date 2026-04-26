import type { Theme, ToolRenderResultOptions } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { AutoAgentsReadDetails } from "./types";

export function formatAutoAgentsSummary(
  result: { details?: AutoAgentsReadDetails },
  options: ToolRenderResultOptions,
  theme: Theme,
): string | undefined {
  const loaded = result.details?.autoAgents?.loaded ?? [];
  const skipped = result.details?.autoAgents?.skipped ?? [];
  if (loaded.length === 0 && skipped.length === 0) return undefined;

  let text = theme.fg("muted", `[auto-agents loaded ${loaded.length}, skipped ${skipped.length}]`);
  if (options.expanded) {
    for (const entry of loaded) {
      text += `\n${theme.fg("success", "loaded")} ${theme.fg("accent", entry.path)}`;
    }
    for (const path of skipped) {
      text += `\n${theme.fg("muted", "skipped")} ${theme.fg("accent", path)}`;
    }
  }

  return text;
}

export function renderAutoAgentsSummary(
  result: { details?: AutoAgentsReadDetails },
  options: ToolRenderResultOptions,
  theme: Theme,
): Text | undefined {
  const text = formatAutoAgentsSummary(result, options, theme);
  return text ? new Text(text, 0, 0) : undefined;
}
