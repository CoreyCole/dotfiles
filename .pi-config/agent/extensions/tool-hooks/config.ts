import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ClaudeHookCommand,
  ClaudeHookEventName,
  ClaudeHooksConfigFile,
  ClaudeHookMatcherGroup,
  NormalizedHookRule,
} from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;
const SUPPORTED_EVENTS: ClaudeHookEventName[] = [
  "SessionStart",
  "PreToolUse",
  "PostToolUse",
  "Stop",
];

function assertObject(
  value: unknown,
  message: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function assertCommand(
  hook: ClaudeHookCommand,
  event: ClaudeHookEventName,
  groupIndex: number,
  hookIndex: number,
) {
  assertObject(
    hook,
    `tool-hooks: ${event}[${groupIndex}].hooks[${hookIndex}] must be an object`,
  );

  if (hook.type !== "command") {
    throw new Error(
      `tool-hooks: ${event}[${groupIndex}].hooks[${hookIndex}] only supports type=command in v1`,
    );
  }
  if (!hook.command?.trim()) {
    throw new Error(
      `tool-hooks: ${event}[${groupIndex}].hooks[${hookIndex}] requires a non-empty command`,
    );
  }
  if (
    hook.timeout !== undefined &&
    (typeof hook.timeout !== "number" || !Number.isFinite(hook.timeout))
  ) {
    throw new Error(
      `tool-hooks: ${event}[${groupIndex}].hooks[${hookIndex}] timeout must be a finite number`,
    );
  }
}

function assertGroup(
  group: ClaudeHookMatcherGroup,
  event: ClaudeHookEventName,
  groupIndex: number,
) {
  assertObject(group, `tool-hooks: ${event}[${groupIndex}] must be an object`);

  if (group.matcher !== undefined && typeof group.matcher !== "string") {
    throw new Error(
      `tool-hooks: ${event}[${groupIndex}].matcher must be a string when provided`,
    );
  }
  if (!Array.isArray(group.hooks) || group.hooks.length === 0) {
    throw new Error(
      `tool-hooks: ${event}[${groupIndex}] must contain at least one hook`,
    );
  }
}

export function validateToolHooksConfig(input: unknown): ClaudeHooksConfigFile {
  assertObject(input, "tool-hooks: expected { hooks: { ... } }");
  if (!("hooks" in input)) {
    throw new Error("tool-hooks: expected { hooks: { ... } }");
  }

  const hooksValue = input.hooks;
  assertObject(hooksValue, "tool-hooks: hooks must be an object");

  for (const event of Object.keys(hooksValue)) {
    if (!SUPPORTED_EVENTS.includes(event as ClaudeHookEventName)) {
      throw new Error(`tool-hooks: unsupported event ${event}`);
    }
    if (!Array.isArray(hooksValue[event])) {
      throw new Error(
        `tool-hooks: ${event} must be an array of matcher groups`,
      );
    }
  }

  const hooks = hooksValue as ClaudeHooksConfigFile["hooks"];

  for (const event of SUPPORTED_EVENTS) {
    const groups = hooks[event] ?? [];
    groups.forEach((group, groupIndex) => {
      assertGroup(group, event, groupIndex);
      group.hooks.forEach((hook, hookIndex) =>
        assertCommand(hook, event, groupIndex, hookIndex),
      );
    });
  }

  return { hooks };
}

export function normalizeToolHooksConfig(
  file: ClaudeHooksConfigFile,
): NormalizedHookRule[] {
  const normalized: NormalizedHookRule[] = [];

  for (const event of SUPPORTED_EVENTS) {
    const groups = file.hooks[event] ?? [];
    groups.forEach((group, groupIndex) => {
      group.hooks.forEach((hook, hookIndex) => {
        normalized.push({
          id: `${event}:${groupIndex}:${hookIndex}`,
          event,
          matcher: group.matcher?.trim() || undefined,
          command: hook.command,
          async: Boolean(hook.async),
          timeoutMs:
            hook.timeout === undefined
              ? DEFAULT_TIMEOUT_MS
              : Math.max(1, hook.timeout) * 1000,
        });
      });
    });
  }

  return normalized;
}

export function loadToolHooksConfigFromObject(
  input: unknown,
): NormalizedHookRule[] {
  return normalizeToolHooksConfig(validateToolHooksConfig(input));
}

export function loadToolHooksConfig(configPath: string): NormalizedHookRule[] {
  const absolutePath = resolve(configPath);
  const parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  return loadToolHooksConfigFromObject(parsed);
}
