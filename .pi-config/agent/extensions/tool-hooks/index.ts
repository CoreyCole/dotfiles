import {
  createBashToolDefinition,
  getAgentDir,
  type ExtensionAPI,
  type SessionStartEvent,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadToolHooksConfig, loadToolHooksConfigFromObject } from "./config";
import { buildHookPayload } from "./payload";
import { createClaudeEnvFile, runHookRules, shellQuote } from "./runner";

const GLOBAL_CONFIG_PATH = path.join(
  path.dirname(getAgentDir()),
  "config",
  "tool-hooks.json",
);
const PROJECT_SETTINGS_PATH = path.join(".pi", "settings.json");

function sessionStartSource(
  reason: SessionStartEvent["reason"],
): "startup" | "resume" | undefined {
  if (reason === "resume") return "resume";
  if (
    reason === "startup" ||
    reason === "reload" ||
    reason === "new" ||
    reason === "fork"
  )
    return "startup";
  return undefined;
}

function findGitRoot(start: string): string {
  let current = path.resolve(start);

  while (true) {
    if (existsSync(path.join(current, ".git"))) return current;

    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

function findProjectSettingsPath(cwd: string): string | undefined {
  const candidate = path.join(findGitRoot(cwd), PROJECT_SETTINGS_PATH);
  return existsSync(candidate) ? candidate : undefined;
}

function loadProjectRules(cwd: string) {
  const settingsPath = findProjectSettingsPath(cwd);
  if (!settingsPath) return [];

  const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
    toolHooks?: unknown;
  };
  return settings.toolHooks
    ? loadToolHooksConfigFromObject(settings.toolHooks)
    : [];
}

function loadRules(cwd: string) {
  const globalRules = existsSync(GLOBAL_CONFIG_PATH)
    ? loadToolHooksConfig(GLOBAL_CONFIG_PATH)
    : [];
  return [...globalRules, ...loadProjectRules(cwd)];
}

export default function toolHooks(pi: ExtensionAPI) {
  const cwd = process.cwd();
  const rules = loadRules(cwd);
  let claudeEnvFile: string | undefined;

  const bashTool = createBashToolDefinition(process.cwd(), {
    spawnHook: ({ command, cwd, env }) => ({
      command: claudeEnvFile
        ? `source ${shellQuote(claudeEnvFile)}\n${command}`
        : command,
      cwd,
      env,
    }),
  });

  pi.registerTool({
    ...bashTool,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return bashTool.execute(toolCallId, params, signal, onUpdate, ctx);
    },
  });

  pi.registerMessageRenderer(
    "tool-hooks-session-start",
    (message, _options, theme) => {
      const text = typeof message.content === "string" ? message.content : "";
      return new Text(
        theme.fg("muted", `[tool-hooks session context]\n${text}`),
        0,
        0,
      );
    },
  );

  pi.registerMessageRenderer("tool-hooks-block", (message, _options, theme) => {
    const text = typeof message.content === "string" ? message.content : "";
    return new Text(
      `${theme.fg("warning", "[tool-hooks blocked]")}\n${text}`,
      0,
      0,
    );
  });

  pi.registerMessageRenderer("tool-hooks-stop", (message, _options, theme) => {
    const text = typeof message.content === "string" ? message.content : "";
    return new Text(`${theme.fg("muted", "[tool-hooks stop]")}\n${text}`, 0, 0);
  });

  pi.on("session_start", async (event, ctx) => {
    claudeEnvFile = createClaudeEnvFile();

    const payload = buildHookPayload({
      event: "SessionStart",
      piEvent: "session_start",
      ctx,
      source: sessionStartSource(event.reason),
    });

    const result = await runHookRules({
      rules,
      event: "SessionStart",
      payload,
      ctx,
      claudeEnvFile,
    });
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

    const result = await runHookRules({
      rules,
      event: "PreToolUse",
      payload,
      ctx,
      claudeEnvFile,
    });
    if (result.inputPatch) Object.assign(event.input, result.inputPatch);
    if (result.block) {
      const reason = result.reason ?? "Blocked by hook";
      pi.sendMessage({
        customType: "tool-hooks-block",
        display: true,
        content: reason,
        details: { toolName: event.toolName, toolCallId: event.toolCallId },
      });
      return { block: true, reason };
    }
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

    const result = await runHookRules({
      rules,
      event: "PostToolUse",
      payload,
      ctx,
      claudeEnvFile,
    });
    return result.resultPatch;
  });

  pi.on("agent_end", async (_event, ctx) => {
    const payload = buildHookPayload({
      event: "Stop",
      piEvent: "agent_end",
      ctx,
    });

    const result = await runHookRules({
      rules,
      event: "Stop",
      payload,
      ctx,
      claudeEnvFile,
    });
    if (result.additionalContext.length > 0) {
      pi.sendMessage({
        customType: "tool-hooks-stop",
        display: true,
        content: result.additionalContext.join("\n\n"),
        details: { lines: result.additionalContext.length, event: "Stop" },
      });
    }
    if (result.block) {
      pi.sendUserMessage(result.reason ?? "Stop hook requested continuation.", {
        deliverAs: "followUp",
      });
    }
  });
}
