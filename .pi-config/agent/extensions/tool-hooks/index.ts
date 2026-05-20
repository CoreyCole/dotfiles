import {
  createBashToolDefinition,
  createReadToolDefinition,
  getAgentDir,
  type ExtensionAPI,
  type SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import {
  Container,
  Text,
  truncateToWidth,
  type Component,
} from "@earendil-works/pi-tui";
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
const STOP_HOOK_LOOP_LIMIT = 3;

type ThemeLike = {
  fg(color: string, text: string): string;
  bold(text: string): string;
};

function replaceTabs(text: string): string {
  return text.replace(/\t/g, "   ");
}

function normalizeDisplayText(text: string): string {
  return text.replace(/\r/g, "");
}

function textOutput(result: {
  content?: Array<{ type: string; text?: string }>;
}): string {
  return (result.content ?? [])
    .filter((content) => content.type === "text")
    .map((content) => normalizeDisplayText(content.text ?? ""))
    .join("\n");
}

function linesMessage(count: number, theme: ThemeLike): string {
  return theme.fg("muted", `${count} lines...`);
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function deterministicDocsSummary(result: any, theme: ThemeLike): string[] {
  const loaded = result?.details?.deterministicDocs?.loaded;
  if (!Array.isArray(loaded) || loaded.length === 0) return [];

  return loaded
    .map((entry) => entry?.path)
    .filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    )
    .map(
      (path) => `${theme.fg("success", "loaded:")} ${theme.fg("accent", path)}`,
    );
}

function stripDeterministicDocsContext(result: any): any {
  const autoContextContentBlocks =
    result?.details?.deterministicDocs?.autoContextContentBlocks ?? 0;
  if (autoContextContentBlocks <= 0) return result;

  return {
    ...result,
    content: result.content?.slice(autoContextContentBlocks),
  };
}

function invalidArgText(theme: ThemeLike): string {
  return theme.fg("error", "[invalid arg]");
}

function str(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return null;
}

function formatBashCall(args: any, theme: ThemeLike): string {
  const command = str(args?.command);
  const timeout = typeof args?.timeout === "number" ? args.timeout : undefined;
  const timeoutSuffix = timeout
    ? theme.fg("muted", ` (timeout ${timeout}s)`)
    : "";
  if (command === null) {
    return `${theme.fg("toolTitle", theme.bold("$"))} ${invalidArgText(theme)}${timeoutSuffix}`;
  }

  const commandDisplay = command
    ? replaceTabs(normalizeDisplayText(command))
    : theme.fg("toolOutput", "...");
  return `${theme.fg("toolTitle", theme.bold(`$ ${commandDisplay}`))}${timeoutSuffix}`;
}

class BashPreviewComponent implements Component {
  constructor(
    private result: any,
    private theme: ThemeLike,
    private isPartial: boolean,
    private startedAt?: number,
    private endedAt?: number,
  ) {}

  set(
    result: any,
    theme: ThemeLike,
    isPartial: boolean,
    startedAt?: number,
    endedAt?: number,
  ) {
    this.result = result;
    this.theme = theme;
    this.isPartial = isPartial;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
  }

  invalidate() {}

  render(width: number): string[] {
    const output = textOutput(this.result).trim();
    const lines = output ? output.split("\n") : [];
    const rendered =
      lines.length > 5
        ? ["", linesMessage(lines.length - 5, this.theme), ...lines.slice(-5)]
        : lines.length > 0
          ? ["", ...lines]
          : [];

    if (this.startedAt !== undefined) {
      const label = this.isPartial ? "Elapsed" : "Took";
      const endTime = this.endedAt ?? Date.now();
      rendered.push(
        "",
        this.theme.fg(
          "muted",
          `${label} ${formatDuration(endTime - this.startedAt)}`,
        ),
      );
    }

    return rendered.map((line) => truncateToWidth(line, width));
  }
}

function trimTrailingEmptyLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") end--;
  return lines.slice(0, end);
}

class ReadPreviewComponent implements Component {
  constructor(
    private result: any,
    private theme: ThemeLike,
  ) {}

  set(result: any, theme: ThemeLike) {
    this.result = result;
    this.theme = theme;
  }

  invalidate() {}

  render(width: number): string[] {
    const summary = deterministicDocsSummary(this.result, this.theme);
    const visibleResult = stripDeterministicDocsContext(this.result);
    const lines = trimTrailingEmptyLines(textOutput(visibleResult).split("\n"));
    if (lines.length === 0 && summary.length === 0) return [];

    return [
      "",
      ...summary,
      ...(lines.length > 0 ? [linesMessage(lines.length, this.theme)] : []),
    ].map((line) => truncateToWidth(line, width));
  }
}

type ShellSettings = {
  shellPath?: string;
  shellCommandPrefix?: string;
};

function loadShellSettings(): ShellSettings {
  const settingsPath = path.join(getAgentDir(), "settings.json");
  if (!existsSync(settingsPath)) return {};

  const settings = JSON.parse(
    readFileSync(settingsPath, "utf8"),
  ) as ShellSettings;
  return {
    shellPath:
      typeof settings.shellPath === "string" ? settings.shellPath : undefined,
    shellCommandPrefix:
      typeof settings.shellCommandPrefix === "string"
        ? settings.shellCommandPrefix
        : undefined,
  };
}

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

function getDisplayContent(message: {
  content: unknown;
  details?: unknown;
}): string {
  const details = message.details as { displayContent?: unknown } | undefined;
  if (typeof details?.displayContent === "string")
    return details.displayContent;
  return typeof message.content === "string" ? message.content : "";
}

export default function toolHooks(pi: ExtensionAPI) {
  const cwd = process.cwd();
  const rules = loadRules(cwd);
  let claudeEnvFile: string | undefined;
  let lastStopHookContinuation: string | undefined;
  let stopHookContinuationCount = 0;

  const shellSettings = loadShellSettings();
  const bashTool = createBashToolDefinition(cwd, {
    shellPath: shellSettings.shellPath,
    commandPrefix: shellSettings.shellCommandPrefix,
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
    renderCall(args, theme, context) {
      const state = context.state as {
        startedAt?: number;
        endedAt?: number;
      };
      if (context.executionStarted && state.startedAt === undefined) {
        state.startedAt = Date.now();
        state.endedAt = undefined;
      }

      const text =
        context.lastComponent instanceof Text
          ? context.lastComponent
          : new Text("", 0, 0);
      text.setText(formatBashCall(args, theme));
      return text;
    },
    renderResult(result, options, theme, context) {
      const state = context.state as {
        startedAt?: number;
        endedAt?: number;
        interval?: ReturnType<typeof setInterval>;
      };
      if (
        state.startedAt !== undefined &&
        options.isPartial &&
        !state.interval
      ) {
        state.interval = setInterval(() => context.invalidate(), 1000);
      }
      if (!options.isPartial || context.isError) {
        state.endedAt ??= Date.now();
        if (state.interval) {
          clearInterval(state.interval);
          state.interval = undefined;
        }
      }

      if (options.expanded) {
        return (
          bashTool.renderResult?.(result as Parameters<NonNullable<typeof bashTool.renderResult>>[0], options, theme, {
            ...context,
            lastComponent: undefined,
          }) ?? new Container()
        );
      }

      const component =
        context.lastComponent instanceof BashPreviewComponent
          ? context.lastComponent
          : new BashPreviewComponent(
              result,
              theme,
              Boolean(options.isPartial),
              state.startedAt,
              state.endedAt,
            );
      component.set(
        result,
        theme,
        Boolean(options.isPartial),
        state.startedAt,
        state.endedAt,
      );
      return component;
    },
  });

  // Own read rendering so pi-deterministic-docs can patch read results without
  // registering a conflicting read tool.
  const readTool = createReadToolDefinition(cwd);
  pi.registerTool({
    ...readTool,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return readTool.execute(toolCallId, params, signal, onUpdate, ctx);
    },
    renderCall(args, theme, context) {
      return readTool.renderCall?.(args, theme, context) ?? new Text("", 0, 0);
    },
    renderResult(result, options, theme, context) {
      if (options.expanded) {
        const visibleResult = stripDeterministicDocsContext(result);
        const base =
          readTool.renderResult?.(visibleResult, options, theme, {
            ...context,
            lastComponent: undefined,
          }) ?? new Container();
        const summary = deterministicDocsSummary(result, theme).join("\n");
        if (!summary) return base;

        const baseLines = base
          .render(200)
          .map((line) => line.trimEnd())
          .join("\n")
          .trimEnd();
        return new Text([summary, baseLines].filter(Boolean).join("\n"), 0, 0);
      }

      const component =
        context.lastComponent instanceof ReadPreviewComponent
          ? context.lastComponent
          : new ReadPreviewComponent(result, theme);
      component.set(result, theme);
      return component;
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
    const text = getDisplayContent(message);
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
        details: {
          lines: result.additionalContext.length,
          event: "Stop",
          displayContent:
            result.additionalContextDisplay.length > 0
              ? result.additionalContextDisplay.join("\n\n")
              : undefined,
        },
      });
    }
    if (result.block) {
      const continuation = result.reason ?? "Stop hook requested continuation.";
      if (continuation === lastStopHookContinuation) {
        stopHookContinuationCount++;
      } else {
        lastStopHookContinuation = continuation;
        stopHookContinuationCount = 1;
      }

      if (stopHookContinuationCount >= STOP_HOOK_LOOP_LIMIT) {
        lastStopHookContinuation = undefined;
        stopHookContinuationCount = 0;
        pi.sendMessage({
          customType: "tool-hooks-stop",
          display: true,
          content: `Stop hook returned the same continuation ${STOP_HOOK_LOOP_LIMIT} times; letting the agent stop.\n\n${continuation}`,
          details: { event: "Stop", loopProtection: true },
        });
        return;
      }

      pi.sendUserMessage(continuation, { deliverAs: "followUp" });
    } else {
      lastStopHookContinuation = undefined;
      stopHookContinuationCount = 0;
    }
  });
}
