/**
 * Extension loaded into sub-agents.
 * - Shows agent identity + available tools as a styled widget above the editor (toggle with Ctrl+J)
 * - Provides a `subagent_done` tool for autonomous agents to self-terminate
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createSubagentActivityRecorder } from "./activity.ts";

export function shouldMarkUserTookOver(agentStarted: boolean): boolean {
  return agentStarted;
}

export type DiscussMode = "normal" | "next-turn" | "locked";

export function settleDiscussMode(mode: DiscussMode): {
  mode: DiscussMode;
  suppress: boolean;
} {
  if (mode === "next-turn") return { mode: "normal", suppress: true };
  return { mode, suppress: mode === "locked" };
}

export function queueDiscussMessage(
  message: string,
  send: (message: string, options: { deliverAs: "steer" }) => void,
  arm: () => void,
): void {
  send(message, { deliverAs: "steer" });
  arm();
}

export interface SubagentErrorInfo {
  errorMessage: string;
  stopReason: "error";
}

/**
 * If the last assistant message in the turn ended with `stopReason: "error"`
 * (typically auto-retry exhausted on an overload / rate limit / server error),
 * return its error info so the parent orchestrator can surface a clear
 * failure instead of silently treating the run as completed.
 *
 * Returns `null` when the latest assistant turn completed normally or was
 * aborted by the user (handled separately by shouldAutoExitOnAgentEnd).
 */
export function findLatestAssistantError(
  messages: any[] | undefined,
): SubagentErrorInfo | null {
  if (!messages) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    if (msg.stopReason !== "error") return null;
    const raw =
      typeof msg.errorMessage === "string" ? msg.errorMessage.trim() : "";
    return {
      errorMessage:
        raw ||
        "Subagent agent loop ended with stopReason=error (no errorMessage field).",
      stopReason: "error",
    };
  }
  return null;
}

export function parseDeniedTools(rawValue: string | undefined): string[] {
  return (rawValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function persistTerminalOutcome(
  sessionFile: string | undefined,
  payload: object,
  markIntent: () => void,
  writer: typeof writeFileSync = writeFileSync,
): void {
  if (!sessionFile)
    throw new Error("PI_SUBAGENT_SESSION environment variable is not set.");
  writer(`${sessionFile}.exit`, JSON.stringify(payload));
  markIntent();
}

export default function (pi: ExtensionAPI) {
  let toolNames: string[] = [];
  let denied: string[] = [];
  let expanded = false;

  // Read subagent identity from env vars (set by parent orchestrator)
  const subagentName = process.env.PI_SUBAGENT_NAME ?? "";
  const subagentAgent = process.env.PI_SUBAGENT_AGENT ?? "";
  const deniedToolsValue = process.env.PI_DENY_TOOLS;
  const requestedSkills = parseDeniedTools(process.env.PI_SUBAGENT_SKILLS);
  const recorder = createSubagentActivityRecorder({
    runningChildId: process.env.PI_SUBAGENT_ID,
    activityFile: process.env.PI_SUBAGENT_ACTIVITY_FILE,
  });

  function renderWidget(ctx: { ui: { setWidget: Function } }, _theme: any) {
    ctx.ui.setWidget(
      "subagent-tools",
      (_tui: any, theme: any) => {
        const box = new Box(1, 0, (text: string) =>
          theme.bg("toolSuccessBg", text),
        );

        const label = subagentAgent || subagentName;
        const agentTag = label
          ? theme.bold(theme.fg("accent", `[${label}]`))
          : "";

        if (expanded) {
          // Expanded: full tool list + denied
          const countInfo = theme.fg("dim", ` — ${toolNames.length} available`);
          const hint = theme.fg("muted", "  (Ctrl+J to collapse)");

          const toolList = toolNames
            .map((name: string) => theme.fg("dim", name))
            .join(theme.fg("muted", ", "));

          let deniedLine = "";
          if (denied.length > 0) {
            const deniedList = denied
              .map((name: string) => theme.fg("error", name))
              .join(theme.fg("muted", ", "));
            deniedLine = "\n" + theme.fg("muted", "denied: ") + deniedList;
          }

          const content = new Text(
            `${agentTag}${countInfo}${hint}\n${toolList}${deniedLine}`,
            0,
            0,
          );
          box.addChild(content);
        } else {
          // Collapsed: one-line summary
          const countInfo = theme.fg("dim", ` — ${toolNames.length} tools`);
          const deniedInfo =
            denied.length > 0
              ? theme.fg("dim", " · ") +
                theme.fg("error", `${denied.length} denied`)
              : "";
          const hint = theme.fg("muted", "  (Ctrl+J to expand)");

          const content = new Text(
            `${agentTag}${countInfo}${deniedInfo}${hint}`,
            0,
            0,
          );
          box.addChild(content);
        }

        return box;
      },
      { placement: "aboveEditor" },
    );
  }

  let userTookOver = false;
  let agentStarted = false;
  let discussMode: DiscussMode = "normal";
  let terminalIntent = false;
  let firstInput = true;
  let latestMessages: any[] | undefined;

  // Show widget + status bar on session start
  pi.on("session_start", (_event, ctx) => {
    recorder.sessionStart();
    const tools = pi.getAllTools();
    toolNames = tools.map((t) => t.name).sort();
    denied = parseDeniedTools(deniedToolsValue);

    renderWidget(ctx, null);
  });

  pi.on("input", (event, ctx) => {
    recorder.input();

    if (firstInput) {
      firstInput = false;
      const commands = pi
        .getCommands()
        .filter((command) => command.source === "skill");
      const blocks: string[] = [];

      try {
        for (const skillName of requestedSkills) {
          const command = commands.find(
            (candidate) => candidate.name === `skill:${skillName}`,
          );
          if (!command) {
            throw new Error(`Requested subagent skill not found: ${skillName}`);
          }
          const skillFile = command.sourceInfo.path;
          const body = readFileSync(skillFile, "utf8")
            .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
            .trim();
          blocks.push(
            `<skill name="${skillName}" location="${skillFile}">\n` +
              `References are relative to ${dirname(skillFile)}.\n\n` +
              `${body}\n</skill>`,
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        persistTerminalOutcome(
          process.env.PI_SUBAGENT_SESSION,
          { type: "error", stopReason: "error", errorMessage },
          () => {
            terminalIntent = true;
          },
        );
        recorder.agentEndDone();
        ctx.shutdown();
        return { action: "handled" as const };
      }

      if (blocks.length > 0) {
        return {
          action: "transform" as const,
          text: `${blocks.join("\n\n")}\n\n${event.text}`,
        };
      }
    }

    // Ignore the initial task message that starts an autonomous subagent.
    // Only inputs after the first agent run has started count as user takeover.
    if (!shouldMarkUserTookOver(agentStarted)) return;
    userTookOver = true;
  });

  pi.on("before_agent_start", () => {
    recorder.beforeAgentStart();
  });

  pi.on("agent_start", () => {
    agentStarted = true;
    recorder.agentStart();
  });

  pi.on("agent_end", (event) => {
    latestMessages = (event as any).messages as any[] | undefined;
    recorder.agentEndWaiting();
    userTookOver = false;
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (terminalIntent) return;
    const errorInfo = findLatestAssistantError(latestMessages);
    if (errorInfo) {
      persistTerminalOutcome(
        process.env.PI_SUBAGENT_SESSION,
        { type: "error", ...errorInfo },
        () => {
          terminalIntent = true;
        },
      );
      recorder.agentEndDone();
      ctx.shutdown();
      return;
    }
    const decision = settleDiscussMode(discussMode);
    discussMode = decision.mode;
    if (decision.suppress) return;
    persistTerminalOutcome(
      process.env.PI_SUBAGENT_SESSION,
      { type: "settlement" },
      () => {
        terminalIntent = true;
      },
    );
    recorder.agentEndDone();
    ctx.shutdown();
  });

  pi.on("turn_start", (event) => {
    recorder.turnStart((event as any).turnIndex);
  });

  pi.on("turn_end", (event) => {
    recorder.turnEnd((event as any).turnIndex);
  });

  pi.on("before_provider_request", () => {
    recorder.beforeProviderRequest();
  });

  pi.on("after_provider_response", () => {
    recorder.afterProviderResponse();
  });

  pi.on("message_update", (event) => {
    recorder.messageUpdate((event as any).assistantMessageEvent?.type);
  });

  pi.on("tool_execution_start", (event) => {
    recorder.toolExecutionStart(
      (event as any).toolCallId,
      (event as any).toolName,
    );
  });

  pi.on("tool_call", (event) => {
    recorder.toolCall((event as any).toolCallId, (event as any).toolName);
  });

  pi.on("tool_execution_update", (event) => {
    recorder.toolExecutionUpdate(
      (event as any).toolCallId,
      (event as any).toolName,
    );
  });

  pi.on("tool_result", (event) => {
    recorder.toolResult((event as any).toolCallId, (event as any).toolName);
  });

  pi.on("tool_execution_end", (event) => {
    recorder.toolExecutionEnd(
      (event as any).toolCallId,
      (event as any).toolName,
    );
  });

  pi.on("session_shutdown", (event) => {
    recorder.sessionShutdown((event as any).reason);
  });

  pi.registerCommand("discuss", {
    description:
      "Send one lead-engineer message and keep this child open for that turn",
    handler: async (args, ctx) => {
      const message = args.trim();
      if (!message) {
        ctx.ui.notify("Usage: /discuss <message>", "error");
        return;
      }
      queueDiscussMessage(
        message,
        (content, options) => pi.sendUserMessage(content, options),
        () => {
          discussMode = "next-turn";
        },
      );
    },
  });
  pi.registerCommand("discuss-lock", {
    description: "Keep this child open across ordinary settlements",
    handler: async (_args, ctx) => {
      discussMode = "locked";
      ctx.ui.notify("Discussion lock enabled.", "info");
    },
  });
  pi.registerCommand("discuss-unlock", {
    description: "Restore ordinary settlement behavior",
    handler: async (_args, ctx) => {
      discussMode = "normal";
      ctx.ui.notify("Discussion lock disabled.", "info");
    },
  });

  // Toggle expand/collapse with Ctrl+J
  pi.registerShortcut("ctrl+j", {
    description: "Toggle subagent tools widget",
    handler: (ctx) => {
      expanded = !expanded;
      renderWidget(ctx, null);
    },
  });

  pi.registerTool({
    name: "caller_ping",
    label: "Caller Ping",
    description:
      "Send a help request to the parent agent and exit this session. " +
      "The parent will be notified with your message and can resume this session with a response. " +
      "Use when you're stuck, need clarification, or need the parent to take action.",
    parameters: Type.Object({
      message: Type.String({ description: "What you need help with" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sessionFile = process.env.PI_SUBAGENT_SESSION;
      if (!sessionFile) {
        throw new Error(
          "caller_ping is only available in subagent contexts. " +
            "PI_SUBAGENT_SESSION environment variable is not set.",
        );
      }

      const exitData = {
        type: "ping" as const,
        name: process.env.PI_SUBAGENT_NAME ?? "subagent",
        message: params.message,
      };
      persistTerminalOutcome(sessionFile, exitData, () => {
        terminalIntent = true;
      });
      recorder.callerPing();
      ctx.shutdown();
      return {
        content: [
          {
            type: "text",
            text: "Ping sent. Session will exit and parent will be notified.",
          },
        ],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "subagent_done",
    label: "Subagent Done",
    description:
      "Call this tool when you have completed your task. " +
      "It will close this session and return your results to the main session. " +
      "Your LAST assistant message before calling this becomes the summary returned to the caller.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      persistTerminalOutcome(
        process.env.PI_SUBAGENT_SESSION,
        { type: "done" },
        () => {
          terminalIntent = true;
        },
      );
      recorder.subagentDone();
      ctx.shutdown();
      return {
        content: [{ type: "text", text: "Shutting down subagent session." }],
        details: {},
      };
    },
  });
}
