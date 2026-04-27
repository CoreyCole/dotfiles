import type { ExtensionContext, ToolResultEvent } from "@mariozechner/pi-coding-agent";
import { toClaudeToolName } from "./matchers";
import type { ClaudeHookEventName, HookCommandPayload } from "./types";

function getSessionId(ctx: ExtensionContext): string {
  return ctx.sessionManager.getSessionId();
}

function getTranscriptPath(ctx: ExtensionContext): string | null {
  return ctx.sessionManager.getSessionFile() ?? null;
}

export function buildHookPayload(args: {
  event: ClaudeHookEventName;
  piEvent: string;
  ctx: ExtensionContext;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: Pick<ToolResultEvent, "content" | "details" | "isError">;
  durationMs?: number;
  source?: "startup" | "resume" | "clear" | "compact";
}): HookCommandPayload {
  return {
    session_id: getSessionId(args.ctx),
    transcript_path: getTranscriptPath(args.ctx),
    cwd: args.ctx.cwd,
    hook_event_name: args.event,
    tool_name: args.toolName ? toClaudeToolName(args.toolName) : undefined,
    tool_input: args.toolInput,
    tool_response: args.toolResult
      ? {
          content: args.toolResult.content,
          details: args.toolResult.details,
          isError: args.toolResult.isError,
        }
      : undefined,
    tool_use_id: args.toolCallId,
    duration_ms: args.durationMs,
    source: args.source,
    model: args.ctx.model?.id,
    pi_event: args.piEvent,
  };
}
