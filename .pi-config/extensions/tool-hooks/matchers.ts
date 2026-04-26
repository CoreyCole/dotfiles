import type { ClaudeToolName, HookCommandPayload, NormalizedHookRule } from "./types";

const TOOL_NAME_MAP: Record<string, ClaudeToolName> = {
  bash: "Bash",
  read: "Read",
  write: "Write",
  edit: "Edit",
  grep: "Grep",
  find: "Find",
  ls: "Ls",
};

export function toClaudeToolName(piToolName: string): ClaudeToolName | undefined {
  return TOOL_NAME_MAP[piToolName];
}

function matcherParts(matcher?: string): string[] {
  return matcher
    ?.split("|")
    .map((part) => part.trim())
    .filter(Boolean) ?? [];
}

function matchesToolName(matcher: string, payload: HookCommandPayload): boolean {
  if (!payload.tool_name) return false;
  return matcher === payload.tool_name;
}

function matchesPath(matcher: string, payload: HookCommandPayload): boolean {
  const pathValue = payload.tool_input?.path ?? payload.tool_input?.file_path;
  return typeof pathValue === "string" && new RegExp(matcher).test(pathValue);
}

function matchesCommand(matcher: string, payload: HookCommandPayload): boolean {
  const command = payload.tool_input?.command;
  return typeof command === "string" && new RegExp(matcher).test(command);
}

export function matchesHookRule(rule: NormalizedHookRule, payload: HookCommandPayload): boolean {
  const parts = matcherParts(rule.matcher);
  if (parts.length === 0) return true;

  return parts.some((matcher) => {
    if (matchesToolName(matcher, payload)) return true;
    if (matchesPath(matcher, payload)) return true;
    if (matchesCommand(matcher, payload)) return true;
    return false;
  });
}
