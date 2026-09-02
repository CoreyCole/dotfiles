import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { FAST_STATUS_KEY } from "./pi-fast/src/capabilities.ts";

const ANSI_SGR_PATTERN = /\x1b\[[0-?]*[ -/]*m/g;

function sanitizeStatusText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

function stripAnsiSgr(text: string): string {
  return text.replace(ANSI_SGR_PATTERN, "");
}

function shouldShowStatusText(text: string): boolean {
  const mcpStatus = stripAnsiSgr(text).match(
    /^MCP:\s*(\d+)\/(\d+)\s+servers$/i,
  );
  if (!mcpStatus) return true;
  return Number(mcpStatus[1]) > 0;
}

function parseSessionStartTime(
  timestamp: string | undefined,
  now = Date.now(),
): number | undefined {
  if (!timestamp) return undefined;
  const startTime = new Date(timestamp).getTime();
  if (!Number.isFinite(startTime) || startTime > now) return undefined;
  return startTime;
}

function formatLocalHHMM(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatElapsedDuration(elapsedMs: number): string {
  const totalMinutes = Math.floor(Math.max(0, elapsedMs) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `(${days}d ${String(remainingHours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m)`;
  }
  return `(${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m)`;
}

function formatSessionLine(
  startTime: number | undefined,
  now = Date.now(),
): string | undefined {
  if (
    startTime === undefined ||
    !Number.isFinite(startTime) ||
    startTime > now
  ) {
    return undefined;
  }
  return `${formatLocalHHMM(startTime)} ${formatElapsedDuration(now - startTime)}`;
}

function formatCompactTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

function formatContextTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function formatContextBar(percent: number): string {
  const filledBlocks = Math.max(0, Math.min(5, Math.round(percent / 20)));
  return `${"■".repeat(filledBlocks)}${"□".repeat(5 - filledBlocks)}`;
}

function renderPaddedLine(left: string, right: string, width: number): string {
  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  if (leftWidth + 2 + rightWidth <= width) {
    return left + " ".repeat(width - leftWidth - rightWidth) + right;
  }

  const availableForRight = width - leftWidth - 2;
  if (availableForRight > 0) {
    const truncatedRight = truncateToWidth(right, availableForRight, "");
    return (
      left +
      " ".repeat(
        Math.max(2, width - leftWidth - visibleWidth(truncatedRight)),
      ) +
      truncatedRight
    );
  }

  return truncateToWidth(left, width, "...");
}

function totalUsage(ctx: ExtensionContext) {
  let input = 0;
  let output = 0;
  let cost = 0;

  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "message" || entry.message.role !== "assistant")
      continue;

    const usage = entry.message.usage;
    input += usage.input;
    output += usage.output;
    cost += usage.cost.total;
  }

  return { input, output, cost };
}

function installFooter(pi: ExtensionAPI, ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;

  const sessionStartTime = parseSessionStartTime(
    ctx.sessionManager.getHeader()?.timestamp,
  );

  ctx.ui.setFooter((tui, theme, footerData) => {
    const unsubscribe = footerData.onBranchChange(() => tui.requestRender());
    const refreshInterval =
      sessionStartTime === undefined
        ? undefined
        : setInterval(() => tui.requestRender(), 60_000);

    return {
      dispose() {
        unsubscribe();
        if (refreshInterval !== undefined) clearInterval(refreshInterval);
      },
      invalidate() {},
      render(width: number): string[] {
        const safeWidth = Math.max(1, width);
        const usage = totalUsage(ctx);
        const contextUsage = ctx.getContextUsage();
        const contextWindow =
          contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
        const contextTokens = contextUsage?.tokens;
        const contextPercentValue = contextUsage?.percent ?? 0;
        const contextPercent =
          contextUsage?.percent === null || contextUsage === undefined
            ? "?"
            : contextPercentValue.toFixed(0);

        const statsParts: string[] = [];

        const contextTokenCount =
          contextTokens === null || contextTokens === undefined
            ? "?"
            : formatContextTokens(contextTokens);
        const contextBar =
          contextUsage?.percent === null || contextUsage === undefined
            ? "?????"
            : formatContextBar(contextPercentValue);
        const contextDisplay = `${contextTokenCount}/${formatCompactTokens(contextWindow)} ${contextBar} ${contextPercent}%`;
        const styledContext =
          contextPercentValue > 90
            ? theme.fg("error", contextDisplay)
            : contextPercentValue > 70
              ? theme.fg("warning", contextDisplay)
              : contextDisplay;
        statsParts.push(styledContext);
        if (usage.input || usage.output || usage.cost) statsParts.push("│");
        if (usage.input)
          statsParts.push(`↑${formatCompactTokens(usage.input)}`);
        if (usage.output)
          statsParts.push(`↓${formatCompactTokens(usage.output)}`);
        if (usage.cost) statsParts.push(`$${usage.cost.toFixed(2)}`);

        let leftStats = statsParts.join(" ");
        if (visibleWidth(leftStats) > safeWidth)
          leftStats = truncateToWidth(leftStats, safeWidth, "...");

        const extensionStatuses = footerData.getExtensionStatuses();
        const rightStats = [
          ctx.model?.id ?? "no-model",
          pi.getThinkingLevel(),
          extensionStatuses.get(FAST_STATUS_KEY),
        ]
          .filter((part): part is string => Boolean(part))
          .join(" • ");
        const statsLine = renderPaddedLine(
          theme.fg("dim", leftStats),
          theme.fg("dim", rightStats),
          safeWidth,
        );

        const lines: string[] = [];
        if (extensionStatuses.size > 0) {
          const statusLine = Array.from(extensionStatuses.entries())
            .filter(([key]) => key !== FAST_STATUS_KEY)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, text]) => sanitizeStatusText(text))
            .filter(shouldShowStatusText)
            .join(" ");
          if (statusLine) {
            lines.push(
              truncateToWidth(statusLine, safeWidth, theme.fg("dim", "...")),
            );
          }
        }

        const sessionLine = formatSessionLine(sessionStartTime);
        if (sessionLine) {
          lines.push(
            renderPaddedLine("", theme.fg("dim", sessionLine), safeWidth),
          );
        }
        lines.push(statsLine);
        return lines;
      },
    };
  });
}

export const __test__ = {
  formatElapsedDuration,
  formatLocalHHMM,
  formatSessionLine,
  installFooter,
  parseSessionStartTime,
  sanitizeStatusText,
  shouldShowStatusText,
  stripAnsiSgr,
};

export default function customFooterExtension(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    installFooter(pi, ctx);
  });
}
