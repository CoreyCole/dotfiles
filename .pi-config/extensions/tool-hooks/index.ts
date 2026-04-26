import type { ExtensionAPI, SessionStartEvent } from "@mariozechner/pi-coding-agent";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadToolHooksConfig } from "./config";
import { buildHookPayload } from "./payload";
import { runHookRules } from "./runner";

const EXTENSION_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(EXTENSION_DIR, "../../config/tool-hooks.json");

function sessionStartSource(reason: SessionStartEvent["reason"]): "startup" | "resume" | undefined {
  if (reason === "resume") return "resume";
  if (reason === "startup" || reason === "reload" || reason === "new" || reason === "fork") return "startup";
  return undefined;
}

export default function toolHooks(pi: ExtensionAPI) {
  const rules = loadToolHooksConfig(CONFIG_PATH);
  let claudeEnvFile: string | undefined;

  pi.on("session_start", async (event, ctx) => {
    const payload = buildHookPayload({
      event: "SessionStart",
      piEvent: "session_start",
      ctx,
      source: sessionStartSource(event.reason),
    });

    const result = await runHookRules({ rules, event: "SessionStart", payload, ctx, claudeEnvFile });
    if (result.additionalContext.length > 0) {
      pi.sendMessage({
        customType: "tool-hooks-session-start",
        display: true,
        content: result.additionalContext.join("\n\n"),
        details: { lines: result.additionalContext.length },
      });
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    const payload = buildHookPayload({
      event: "PreToolUse",
      piEvent: "tool_call",
      ctx,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      toolInput: event.input,
    });

    const result = await runHookRules({ rules, event: "PreToolUse", payload, ctx, claudeEnvFile });
    if (result.inputPatch) Object.assign(event.input, result.inputPatch);
    if (result.block) return { block: true, reason: result.reason ?? "Blocked by hook" };
    return undefined;
  });

  pi.on("tool_result", async (event, ctx) => {
    const payload = buildHookPayload({
      event: "PostToolUse",
      piEvent: "tool_result",
      ctx,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      toolInput: event.input,
      toolResult: event,
    });

    const result = await runHookRules({ rules, event: "PostToolUse", payload, ctx, claudeEnvFile });
    return result.resultPatch;
  });
}
