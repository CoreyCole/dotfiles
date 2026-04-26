import type { ExtensionContext, ToolResultEventResult } from "@mariozechner/pi-coding-agent";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { matchesHookRule } from "./matchers";
import { parseHookOutput, runCommand } from "./process";
import type { ClaudeHookEventName, HookCommandPayload, HookExecutionResult, NormalizedHookRule } from "./types";

export function createClaudeEnvFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "pi-tool-hooks-"));
  const file = path.join(dir, "session.env");
  writeFileSync(file, "", "utf8");
  return file;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function buildHookEnv(payload: HookCommandPayload, claudeEnvFile: string | undefined): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLAUDE_HOOK_EVENT_NAME: payload.hook_event_name,
    CLAUDE_PROJECT_DIR: payload.cwd,
    CLAUDE_SESSION_ID: payload.session_id,
    CLAUDE_TOOL_NAME: payload.tool_name,
    CLAUDE_TOOL_USE_ID: payload.tool_use_id,
    CLAUDE_ENV_FILE: claudeEnvFile,
  };
}

function filterInputPatch(
  inputPatch: Record<string, unknown> | undefined,
  originalInput: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!inputPatch || !originalInput) return undefined;

  const filtered = Object.fromEntries(
    Object.entries(inputPatch).filter(([key, value]) => key in originalInput && value !== undefined),
  );
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function filterResultPatch(resultPatch: HookExecutionResult["resultPatch"]): ToolResultEventResult | undefined {
  if (!resultPatch) return undefined;

  const next: ToolResultEventResult = {};
  if (Array.isArray(resultPatch.content)) next.content = resultPatch.content as ToolResultEventResult["content"];
  if (resultPatch.details && typeof resultPatch.details === "object" && !Array.isArray(resultPatch.details)) {
    next.details = resultPatch.details;
  }
  if (typeof resultPatch.isError === "boolean") next.isError = resultPatch.isError;

  return Object.keys(next).length > 0 ? next : undefined;
}

export async function runHookRules(args: {
  rules: NormalizedHookRule[];
  event: ClaudeHookEventName;
  payload: HookCommandPayload;
  ctx: ExtensionContext;
  claudeEnvFile?: string;
}): Promise<{
  block?: boolean;
  reason?: string;
  inputPatch?: Record<string, unknown>;
  resultPatch?: ToolResultEventResult;
  additionalContext: string[];
}> {
  const matching = args.rules.filter((rule) => rule.event === args.event && matchesHookRule(rule, args.payload));
  const additionalContext: string[] = [];
  let inputPatch: Record<string, unknown> | undefined;
  let resultPatch: ToolResultEventResult | undefined;

  for (const rule of matching) {
    const env = buildHookEnv(args.payload, args.claudeEnvFile);

    if (rule.async) {
      runCommand(rule, args.payload, env).catch(() => undefined);
      continue;
    }

    const outcome = parseHookOutput(await runCommand(rule, args.payload, env));

    const nextInputPatch = filterInputPatch(outcome.inputPatch, args.payload.tool_input);
    const nextResultPatch = filterResultPatch(outcome.resultPatch);

    if (outcome.additionalContext) additionalContext.push(outcome.additionalContext);
    if (nextInputPatch) inputPatch = { ...(inputPatch ?? {}), ...nextInputPatch };
    if (nextResultPatch) resultPatch = { ...(resultPatch ?? {}), ...nextResultPatch };
    if (outcome.block) return { block: true, reason: outcome.reason, inputPatch, resultPatch, additionalContext };
  }

  return { inputPatch, resultPatch, additionalContext };
}
