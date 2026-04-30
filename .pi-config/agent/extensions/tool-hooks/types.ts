export type ClaudeHookEventName =
  | "SessionStart"
  | "PreToolUse"
  | "PostToolUse"
  | "Stop";

export type ClaudeToolName =
  | "Bash"
  | "Read"
  | "Write"
  | "Edit"
  | "Grep"
  | "Find"
  | "Ls";

export interface ClaudeHooksConfigFile {
  hooks: Partial<Record<ClaudeHookEventName, ClaudeHookMatcherGroup[]>>;
}

export interface ClaudeHookMatcherGroup {
  matcher?: string;
  hooks: ClaudeHookCommand[];
}

export interface ClaudeHookCommand {
  type: "command";
  command: string;
  async?: boolean;
  timeout?: number;
}

export interface NormalizedHookRule {
  id: string;
  event: ClaudeHookEventName;
  matcher?: string;
  command: string;
  async: boolean;
  timeoutMs: number;
}

export interface HookCommandPayload {
  session_id: string;
  transcript_path: string | null;
  cwd: string;
  hook_event_name: ClaudeHookEventName;
  tool_name?: ClaudeToolName;
  tool_input?: Record<string, unknown>;
  tool_response?: {
    content: unknown;
    details?: unknown;
    isError?: boolean;
  };
  tool_use_id?: string;
  duration_ms?: number;
  source?: "startup" | "resume" | "clear" | "compact";
  model?: string;
  pi_event: string;
}

export interface HookCommandJsonResult {
  decision?: "block";
  reason?: string;
  inputPatch?: Record<string, unknown>;
  resultPatch?: {
    content?: unknown;
    details?: Record<string, unknown>;
    isError?: boolean;
  };
  hookSpecificOutput?: {
    hookEventName?: ClaudeHookEventName;
    additionalContext?: string;
  };
}

export interface HookExecutionResult {
  block?: boolean;
  reason?: string;
  additionalContext?: string;
  // Shallow input patches are filtered to keys that already exist on the original tool input.
  inputPatch?: Record<string, unknown>;
  // Result patches are filtered to Pi's supported tool-result mutation keys.
  resultPatch?: {
    content?: unknown;
    details?: Record<string, unknown>;
    isError?: boolean;
  };
}
