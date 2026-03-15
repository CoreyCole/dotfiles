import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { completeSimple } from "@mariozechner/pi-ai";
import { Box, Markdown, Text } from "@mariozechner/pi-tui";

type BranchEntry = {
	type: string;
	id: string;
	parentId: string | null;
	summary?: string;
	[key: string]: unknown;
};

type BranchInfo = {
	count: number;
	totalChars: number;
	estimatedTokens: number;
	contextPercent: number | null;
	summaries: { index: number; chars: number; tokens: number; preview: string }[];
};

function getBranchInfo(ctx: ExtensionContext): BranchInfo {
	const leafId = ctx.sessionManager.getLeafId();
	if (!leafId) return { count: 0, totalChars: 0, estimatedTokens: 0, contextPercent: null, summaries: [] };

	const path = ctx.sessionManager.getBranch(leafId) as BranchEntry[];
	const summaries: BranchInfo["summaries"] = [];
	let totalChars = 0;
	let branchIndex = 0;

	for (const entry of path) {
		if (entry.type === "branch_summary" && entry.summary) {
			branchIndex++;
			const chars = entry.summary.length;
			const tokens = Math.ceil(chars / 4);
			totalChars += chars;
			const preview = entry.summary.slice(0, 120).replace(/\n/g, " ").trim();
			summaries.push({ index: branchIndex, chars, tokens, preview: preview + (chars > 120 ? "…" : "") });
		}
	}

	const estimatedTokens = Math.ceil(totalChars / 4);

	// Get context usage for percentage calculation
	let contextPercent: number | null = null;
	const usage = ctx.getContextUsage();
	if (usage && usage.contextWindow > 0) {
		contextPercent = (estimatedTokens / usage.contextWindow) * 100;
	}

	return { count: summaries.length, totalChars, estimatedTokens, contextPercent, summaries };
}

/**
 * Serialize session entries into a text representation for summarization.
 * Handles user messages, assistant messages, branch summaries, compaction summaries.
 */
function serializeEntries(entries: BranchEntry[]): string {
	const parts: string[] = [];

	for (const entry of entries) {
		if (entry.type === "message") {
			const msg = entry.message as { role: string; content: unknown };
			if (!msg) continue;

			if (msg.role === "user") {
				const text = typeof msg.content === "string"
					? msg.content
					: Array.isArray(msg.content)
						? (msg.content as { type: string; text?: string }[])
							.filter((c) => c.type === "text")
							.map((c) => c.text ?? "")
							.join("")
						: "";
				if (text) parts.push(`[User]: ${text}`);
			} else if (msg.role === "assistant") {
				const content = msg.content;
				if (!Array.isArray(content)) continue;
				const textParts: string[] = [];
				const toolCalls: string[] = [];
				for (const block of content as { type: string; text?: string; thinking?: string; name?: string; arguments?: Record<string, unknown> }[]) {
					if (block.type === "text" && block.text) {
						textParts.push(block.text);
					} else if (block.type === "toolCall" && block.name) {
						const args = block.arguments ?? {};
						const argsStr = Object.entries(args)
							.map(([k, v]) => `${k}=${JSON.stringify(v)}`)
							.join(", ");
						toolCalls.push(`${block.name}(${argsStr})`);
					}
				}
				if (textParts.length > 0) parts.push(`[Assistant]: ${textParts.join("\n")}`);
				if (toolCalls.length > 0) parts.push(`[Assistant tool calls]: ${toolCalls.join("; ")}`);
			} else if (msg.role === "toolResult") {
				const content = msg.content;
				if (!Array.isArray(content)) continue;
				const text = (content as { type: string; text?: string }[])
					.filter((c) => c.type === "text")
					.map((c) => c.text ?? "")
					.join("");
				if (text) parts.push(`[Tool result]: ${text}`);
			}
		} else if (entry.type === "branch_summary" && entry.summary) {
			parts.push(`[Branch summary]: ${entry.summary}`);
		} else if (entry.type === "compaction" && entry.summary) {
			parts.push(`[Previous context summary]: ${entry.summary}`);
		}
	}

	return parts.join("\n\n");
}

const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI coding assistant, then produce a structured summary following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`;

const FULL_SUMMARY_PROMPT = `Create a comprehensive summary of this entire conversation for continuing work in a fresh session.

Use this EXACT format:

## Goal
[What is the user trying to accomplish?]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Work that was started but not finished]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Current State
[What is the current state of the work? What files were modified? What's the current branch?]

## Next Steps
1. [What should happen next to continue this work]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

function formatTokens(tokens: number): string {
	if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
	return `${tokens}`;
}

function updateBranchStatus(ctx: ExtensionContext) {
	if (!ctx.hasUI) return;

	const info = getBranchInfo(ctx);

	if (info.count === 0) {
		ctx.ui.setStatus("branch-chain", undefined);
		return;
	}

	const tokenStr = formatTokens(info.estimatedTokens);
	const pctStr = info.contextPercent !== null ? ` (${info.contextPercent.toFixed(1)}%)` : "";
	const label = info.count === 1
		? `🌿 1 branch · ~${tokenStr} tokens${pctStr}`
		: `🌿 ${info.count} branches · ~${tokenStr} tokens${pctStr}`;

	ctx.ui.setStatus("branch-chain", ctx.ui.theme.fg("muted", label));
}

export default function (pi: ExtensionAPI) {
	// --- Status tracking ---

	pi.on("session_start", (_event, ctx) => {
		updateBranchStatus(ctx);
	});

	pi.on("session_tree", (_event, ctx) => {
		updateBranchStatus(ctx);
	});

	pi.on("session_switch", (_event, ctx) => {
		updateBranchStatus(ctx);
	});

	pi.on("agent_end", (_event, ctx) => {
		// Re-check after each agent turn since context usage may have changed
		updateBranchStatus(ctx);
	});

	// --- Custom renderer for compressed branch summaries ---

	pi.registerMessageRenderer("branch-compressed", (message, { expanded }, theme) => {
		const details = message.details as { count: number; tokens: number; percent: number | null } | undefined;
		const count = details?.count ?? "?";
		const tokenStr = details?.tokens ? formatTokens(details.tokens) : "?";
		const pctStr = details?.percent !== null && details?.percent !== undefined ? ` · ${details.percent.toFixed(1)}% context` : "";

		const box = new Box(1, 1, (t: string) => theme.bg("customMessageBg", t));

		const label = theme.fg("customMessageLabel", `\x1b[1m[${count}x branches · ~${tokenStr} tokens${pctStr}]\x1b[22m`);
		box.addChild(new Text(label, 0, 0));

		if (expanded) {
			const content = typeof message.content === "string" ? message.content : "";
			const mdTheme = getMarkdownTheme();
			box.addChild(new Markdown("\n" + content, 0, 0, mdTheme, {
				color: (text: string) => theme.fg("customMessageText", text),
			}));
		} else {
			box.addChild(new Text(theme.fg("dim", "  expand to see full summary"), 0, 0));
		}

		return box;
	});

	// --- /branch command ---

	pi.registerCommand("branch", {
		description: "Summarize the current conversation and start a fresh branch",
		handler: async (_args, ctx) => {
			await ctx.waitForIdle();

			const leafId = ctx.sessionManager.getLeafId();
			if (!leafId) {
				ctx.ui.notify("No conversation to branch from", "warning");
				return;
			}

			const path = ctx.sessionManager.getBranch(leafId) as BranchEntry[];
			if (path.length === 0) {
				ctx.ui.notify("No conversation to branch from", "warning");
				return;
			}

			// Find the last branch_summary in the current path, or fall back to root
			let branchFromId: string | null = null;
			for (let i = path.length - 1; i >= 0; i--) {
				if (path[i].type === "branch_summary") {
					branchFromId = path[i].id;
					break;
				}
			}
			if (branchFromId === null) {
				branchFromId = path[0].id;
			}

			if (leafId === branchFromId) {
				ctx.ui.notify("Already at a branch point — nothing to branch from", "info");
				return;
			}

			ctx.ui.notify("Summarizing and branching...", "info");

			const result = await ctx.navigateTree(branchFromId, {
				summarize: true,
			});

			if (result.cancelled) {
				ctx.ui.notify("Branch cancelled", "info");
			} else {
				updateBranchStatus(ctx);
			}
		},
	});

	// --- /compress command ---

	pi.registerCommand("compress", {
		description: "Summarize the entire session and start a new session with the summary (original session is preserved)",
		handler: async (_args, ctx) => {
			await ctx.waitForIdle();

			const leafId = ctx.sessionManager.getLeafId();
			if (!leafId) {
				ctx.ui.notify("No conversation to compress", "warning");
				return;
			}

			const path = ctx.sessionManager.getBranch(leafId) as BranchEntry[];
			if (path.length < 2) {
				ctx.ui.notify("Not enough conversation to compress", "info");
				return;
			}

			const model = ctx.model;
			if (!model) {
				ctx.ui.notify("No model selected", "warning");
				return;
			}

			// Estimate conversation size
			const conversationText = serializeEntries(path);
			const estimatedTokens = Math.ceil(conversationText.length / 4);
			const tokenStr = formatTokens(estimatedTokens);

			const ok = await ctx.ui.confirm(
				"Compress to new session",
				`Summarize ~${tokenStr} tokens of conversation and start a fresh session?\nThe original session will be preserved.`,
			);
			if (!ok) return;

			ctx.ui.notify("Generating summary...", "info");

			// Generate a full summary of the conversation via LLM
			const apiKey = await ctx.modelRegistry.getApiKey(model);
			if (!apiKey) {
				ctx.ui.notify(`No API key for ${model.provider}`, "error");
				return;
			}

			// Trim conversation to fit within model context window (leave room for prompt + response)
			const contextWindow = model.contextWindow || 128000;
			const reserveTokens = 8192; // room for system prompt + summary prompt + response
			const maxConversationTokens = contextWindow - reserveTokens;
			const maxConversationChars = maxConversationTokens * 4;
			const trimmedConversation = conversationText.length > maxConversationChars
				? conversationText.slice(-maxConversationChars)
				: conversationText;

			const promptText = `<conversation>\n${trimmedConversation}\n</conversation>\n\n${FULL_SUMMARY_PROMPT}`;

			try {
				const response = await completeSimple(
					model,
					{
						systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
						messages: [
							{
								role: "user" as const,
								content: [{ type: "text" as const, text: promptText }],
								timestamp: Date.now(),
							},
						],
					},
					{ apiKey, maxTokens: 4096 },
				);

				if (response.stopReason === "aborted") {
					ctx.ui.notify("Compress cancelled", "info");
					return;
				}
				if (response.stopReason === "error") {
					ctx.ui.notify(`Summary generation failed: ${response.errorMessage || "unknown error"}`, "error");
					return;
				}

				const summary = response.content
					.filter((c: { type: string }) => c.type === "text")
					.map((c: { type: string; text: string }) => c.text)
					.join("\n");

				if (!summary) {
					ctx.ui.notify("No summary generated", "error");
					return;
				}

				// Collect branch info for the custom message details
				const info = getBranchInfo(ctx);
				const parentSession = ctx.sessionManager.getSessionFile();

				// Create a new session with the summary injected as the initial context
				const result = await ctx.newSession({
					parentSession,
					setup: async (sessionManager) => {
						sessionManager.appendCustomMessageEntry(
							"branch-compressed",
							summary,
							true,
							{
								count: info.count || 1,
								tokens: Math.ceil(summary.length / 4),
								percent: null,
							},
						);
					},
				});

				if (result.cancelled) {
					ctx.ui.notify("Compress cancelled", "info");
				} else {
					updateBranchStatus(ctx);
					ctx.ui.notify("Started fresh session with conversation summary", "success");
				}
			} catch (err) {
				ctx.ui.notify(`Compress failed: ${err instanceof Error ? err.message : String(err)}`, "error");
			}
		},
	});

	// --- /branches command (inspect) ---

	pi.registerCommand("branches", {
		description: "Show branch summary chain details",
		handler: async (_args, ctx) => {
			const info = getBranchInfo(ctx);

			if (info.count === 0) {
				ctx.ui.notify("No branch summaries in current path", "info");
				return;
			}

			const lines: string[] = [];
			for (const s of info.summaries) {
				const tokenStr = formatTokens(s.tokens);
				lines.push(`  ${s.index}. ~${tokenStr} tokens — ${s.preview}`);
			}

			const totalStr = formatTokens(info.estimatedTokens);
			const pctStr = info.contextPercent !== null ? ` (${info.contextPercent.toFixed(1)}% context)` : "";
			const header = `🌿 ${info.count} branch${info.count === 1 ? "" : "es"} · ~${totalStr} tokens${pctStr}`;

			ctx.ui.notify(header + "\n" + lines.join("\n"), "info");
		},
	});
}
