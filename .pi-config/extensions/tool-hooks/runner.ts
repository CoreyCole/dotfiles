import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { matchesHookRule } from "./matchers";
import { parseHookOutput, runCommand } from "./process";
import type { ClaudeHookEventName, HookCommandPayload, HookExecutionResult, NormalizedHookRule } from "./types";

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
  resultPatch?: HookExecutionResult["resultPatch"];
  additionalContext: string[];
}> {
  const matching = args.rules.filter((rule) => rule.event === args.event && matchesHookRule(rule, args.payload));
  const additionalContext: string[] = [];
  let inputPatch: Record<string, unknown> | undefined;
  let resultPatch: HookExecutionResult["resultPatch"];

  for (const rule of matching) {
    const env = buildHookEnv(args.payload, args.claudeEnvFile);

    if (rule.async) {
      runCommand(rule, args.payload, env).catch(() => undefined);
      continue;
    }

    const outcome = parseHookOutput(await runCommand(rule, args.payload, env));

    if (outcome.additionalContext) additionalContext.push(outcome.additionalContext);
    if (outcome.inputPatch) inputPatch = { ...(inputPatch ?? {}), ...outcome.inputPatch };
    if (outcome.resultPatch) resultPatch = { ...(resultPatch ?? {}), ...outcome.resultPatch };
    if (outcome.block) return { block: true, reason: outcome.reason, inputPatch, resultPatch, additionalContext };
  }

  return { inputPatch, resultPatch, additionalContext };
}
