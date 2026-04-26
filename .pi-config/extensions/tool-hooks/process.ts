import { spawn } from "node:child_process";
import type { HookCommandPayload, HookExecutionResult, NormalizedHookRule } from "./types";

export interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCommand(
  rule: NormalizedHookRule,
  payload: HookCommandPayload,
  env: NodeJS.ProcessEnv,
): Promise<CommandRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(rule.command, {
      cwd: payload.cwd,
      env,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`tool-hooks: ${rule.id} timed out after ${rule.timeoutMs}ms`));
    }, rule.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({ exitCode: exitCode ?? 1, stdout: stdout.trim(), stderr: stderr.trim() });
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResultPatch(value: unknown): HookExecutionResult["resultPatch"] | undefined {
  if (!isPlainObject(value)) return undefined;

  const resultPatch: HookExecutionResult["resultPatch"] = {};
  if ("content" in value) resultPatch.content = value.content;
  if (isPlainObject(value.details)) resultPatch.details = value.details;
  if (typeof value.isError === "boolean") resultPatch.isError = value.isError;

  return Object.keys(resultPatch).length > 0 ? resultPatch : undefined;
}

export function parseHookOutput(result: CommandRunResult): HookExecutionResult {
  if (result.exitCode === 2) {
    return { block: true, reason: result.stderr || "blocked by hook" };
  }

  if (result.exitCode !== 0 || !result.stdout) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return {};
  }

  if (!isPlainObject(parsed)) return {};

  const inputPatch = isPlainObject(parsed.inputPatch) ? parsed.inputPatch : undefined;
  const hookSpecificOutput = isPlainObject(parsed.hookSpecificOutput) ? parsed.hookSpecificOutput : undefined;

  return {
    block: parsed.decision === "block",
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    inputPatch,
    resultPatch: parseResultPatch(parsed.resultPatch),
    additionalContext:
      typeof hookSpecificOutput?.additionalContext === "string" ? hookSpecificOutput.additionalContext : undefined,
  };
}
