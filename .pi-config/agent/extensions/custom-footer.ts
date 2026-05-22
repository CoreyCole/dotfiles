import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

function sanitizeStatusText(text: string): string {
	return text
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
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
	const filledBlocks = Math.max(0, Math.min(10, Math.round(percent / 10)));
	return `|${"■".repeat(filledBlocks)}${"□".repeat(10 - filledBlocks)}|`;
}

function shortHomePath(cwd: string): string {
	const home = process.env.HOME || process.env.USERPROFILE;
	if (home && cwd.startsWith(home)) return `~${cwd.slice(home.length)}`;
	return cwd;
}

function getCwd(ctx: ExtensionContext): string {
	return shortHomePath(ctx.sessionManager.getCwd?.() ?? ctx.cwd);
}

function getSessionLabel(ctx: ExtensionContext): string | undefined {
	return ctx.sessionManager.getSessionName?.();
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
		return left + " ".repeat(Math.max(2, width - leftWidth - visibleWidth(truncatedRight))) + truncatedRight;
	}

	return truncateToWidth(left, width, "...");
}

function totalUsage(ctx: ExtensionContext) {
	let input = 0;
	let output = 0;
	let cacheRead = 0;
	let cacheWrite = 0;
	let cost = 0;

	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;

		const usage = entry.message.usage;
		input += usage.input;
		output += usage.output;
		cacheRead += usage.cacheRead;
		cacheWrite += usage.cacheWrite;
		cost += usage.cost.total;
	}

	return { input, output, cacheRead, cacheWrite, cost };
}

function installFooter(pi: ExtensionAPI, ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;

	ctx.ui.setFooter((tui, theme, footerData) => {
		const unsubscribe = footerData.onBranchChange(() => tui.requestRender());

		return {
			dispose: unsubscribe,
			invalidate() {},
			render(width: number): string[] {
				const safeWidth = Math.max(1, width);
				const usage = totalUsage(ctx);
				const contextUsage = ctx.getContextUsage();
				const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
				const contextTokens = contextUsage?.tokens;
				const contextPercentValue = contextUsage?.percent ?? 0;
				const contextPercent = contextUsage?.percent === null || contextUsage === undefined ? "?" : contextPercentValue.toFixed(1);

				const cwdLabel = getSessionLabel(ctx);
				const cwd = cwdLabel ? `${getCwd(ctx)} • ${cwdLabel}` : getCwd(ctx);
				const branch = footerData.getGitBranch();

				const statsParts: string[] = [];
				if (usage.input) statsParts.push(`↑${formatCompactTokens(usage.input)}`);
				if (usage.output) statsParts.push(`↓${formatCompactTokens(usage.output)}`);
				if (usage.cacheRead) statsParts.push(`R${formatCompactTokens(usage.cacheRead)}`);
				if (usage.cacheWrite) statsParts.push(`W${formatCompactTokens(usage.cacheWrite)}`);

				const usingSubscription = ctx.model ? ctx.modelRegistry.isUsingOAuth(ctx.model) : false;
				if (usage.cost || usingSubscription) {
					statsParts.push(`$${usage.cost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`);
				}

				const contextTokenCount = contextTokens === null || contextTokens === undefined ? "?" : formatContextTokens(contextTokens);
				const contextBar = contextUsage?.percent === null || contextUsage === undefined ? "|??????????|" : formatContextBar(contextPercentValue);
				const contextDisplay = `${contextPercent}% ${contextBar} (${contextTokenCount}/${formatCompactTokens(contextWindow)})`;
				const styledContext =
					contextPercentValue > 90
						? theme.fg("error", contextDisplay)
						: contextPercentValue > 70
							? theme.fg("warning", contextDisplay)
							: contextDisplay;
				statsParts.push(styledContext);

				let leftStats = statsParts.join(" ");
				if (visibleWidth(leftStats) > safeWidth) leftStats = truncateToWidth(leftStats, safeWidth, "...");

				const rightStats = `${ctx.model?.id ?? "no-model"} • ${pi.getThinkingLevel()}`;
				const statsLine = renderPaddedLine(theme.fg("dim", leftStats), theme.fg("dim", rightStats), safeWidth);

				const lines = [truncateToWidth(theme.fg("dim", cwd), safeWidth, theme.fg("dim", "..."))];
				if (branch) lines.push(truncateToWidth(theme.fg("dim", `   ${branch}`), safeWidth, theme.fg("dim", "...")));

				const extensionStatuses = footerData.getExtensionStatuses();
				if (extensionStatuses.size > 0) {
					const statusLine = Array.from(extensionStatuses.entries())
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([, text]) => sanitizeStatusText(text))
						.join(" ");
					lines.push(truncateToWidth(statusLine, safeWidth, theme.fg("dim", "...")));
				}

				lines.push(statsLine);
				return lines;
			},
		};
	});
}

export default function customFooterExtension(pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		installFooter(pi, ctx);
	});
}
