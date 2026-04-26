import { spawn } from "node:child_process";
import type { HookCommandPayload, HookExecutionResult, HookCommandJsonResult, NormalizedHookRule } from "./types";

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

export function parseHookOutput(result: CommandRunResult): HookExecutionResult {
  if (result.exitCode === 2) {
    return { block: true, reason: result.stderr || "blocked by hook" };
  }

  if (result.exitCode !== 0) {
    return {};
  }

  if (!result.stdout) return {};

  const parsed = JSON.parse(result.stdout) as HookCommandJsonResult;

  return {
    block: parsed.decision === "block",
    reason: parsed.reason,
    inputPatch: parsed.inputPatch,
    resultPatch: parsed.resultPatch,
    additionalContext: parsed.hookSpecificOutput?.additionalContext,
  };
}
