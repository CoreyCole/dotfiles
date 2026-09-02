import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import {
  Box,
  Key,
  Text,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  isMuxAvailable,
  muxSetupHint,
  createSurface,
  sendLongCommand,
  pollForExit,
  closeSurface,
  getMuxBackend,
  sendEscape,
  sendPrompt,
  validatePrompt,
  shellEscape,
  renameCurrentTab,
  renameWorkspace,
  readScreen,
  attachTmuxPane,
  detachTmuxPane,
  createTmuxHiddenSurface,
  destroyTmuxHiddenOwner,
  tmuxHiddenSessionName,
  type TmuxHiddenOwner,
} from "./cmux.ts";

import {
  PERSISTENT_STATUS_CUSTOM_TYPE,
  createDelegatorLivenessCoordinator,
  delegatorLiveness,
  type DelegatorLivenessCoordinator,
} from "./subagent-done.ts";
import {
  findLastAssistantMessage,
  inspectSession,
  getNewEntries,
  seedSubagentSessionFile,
} from "./session.ts";
import {
  type StatusSnapshot,
  type SubagentStatusState,
  advanceStatusState,
  capStatusLines,
  classifyStatus,
  createStatusState,
  forceStatusAfterInterrupt,
  formatStatusAggregate,
  formatTransitionLine,
  observeStatus,
  loadStatusConfig,
} from "./status.ts";
import {
  requestStatsSidecarPath,
  type RequestStatsAggregate,
  validateRequestStatsAggregate,
} from "../request-stats.ts";
import {
  getSubagentActivityFile,
  readSubagentActivityFile,
  type ActivityReadResult,
  type SubagentActivityState,
} from "./activity.ts";

/** Absolute path to `pi-extension/subagents`. https://github.com/nodejs/node/issues/37845 */
const SUBAGENTS_DIR = dirname(fileURLToPath(import.meta.url));
const FAST_DESIRED_HANDOFF_ENV = "PI_FAST_DESIRED";
const AUTO_EXIT_ENV = "PI_SUBAGENT_AUTO_EXIT";

function buildChildAutoExitEnvironment(autoExit: boolean): string {
  return `${AUTO_EXIT_ENV}=${shellEscape(String(autoExit))}`;
}

function buildChildHandoffEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  const fastDesired = env[FAST_DESIRED_HANDOFF_ENV];
  return fastDesired === "1" || fastDesired === "0"
    ? [`${FAST_DESIRED_HANDOFF_ENV}=${shellEscape(fastDesired)}`]
    : [];
}

// Survive /reload: clear timers and abort poll loops from the previous module load.
// /reload re-imports this file, giving fresh module-level state, but closures from
// the old module keep running. See https://github.com/HazAT/pi-interactive-subagents/issues/5
const WIDGET_INTERVAL_KEY = Symbol.for("pi-subagents/widget-interval");
const STATUS_INTERVAL_KEY = Symbol.for("pi-subagents/status-interval");
{
  const prevInterval = (globalThis as any)[WIDGET_INTERVAL_KEY];
  if (prevInterval) {
    clearInterval(prevInterval);
    (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
  }
  const prevStatusInterval = (globalThis as any)[STATUS_INTERVAL_KEY];
  if (prevStatusInterval) {
    clearInterval(prevStatusInterval);
    (globalThis as any)[STATUS_INTERVAL_KEY] = null;
  }
}

function createWatcherOwner() {
  const controller = new AbortController();
  let shutdown = false;
  return {
    signal: controller.signal,
    get shutdown() {
      return shutdown;
    },
    abort() {
      shutdown = true;
      controller.abort();
    },
  };
}

const SubagentParams = Type.Object({
  name: Type.String({ description: "Display name for the subagent" }),
  task: Type.String({ description: "Task/prompt for the sub-agent" }),
  agent: Type.Optional(
    Type.String({
      description:
        "Agent name to load defaults from (e.g. 'worker', 'scout', 'reviewer'). Reads ~/.pi/agent/agents/<name>.md for model, tools, skills.",
    }),
  ),
  systemPrompt: Type.Optional(
    Type.String({
      description: "Appended to system prompt (role instructions)",
    }),
  ),
  model: Type.Optional(
    Type.String({ description: "Model override (overrides agent default)" }),
  ),
  skills: Type.Optional(
    Type.String({
      description:
        "Comma-separated skill names whose complete SKILL.md instructions are loaded into the child's first turn (overrides agent default)",
    }),
  ),
  files: Type.Optional(
    Type.Array(
      Type.String({
        description:
          "Text or image file path to load into the child's first turn; relative paths resolve from the child cwd",
      }),
    ),
  ),
  tools: Type.Optional(
    Type.String({
      description: "Comma-separated tools (overrides agent default)",
    }),
  ),
  cwd: Type.Optional(
    Type.String({
      description:
        "Working directory for the sub-agent. The agent starts in this folder and picks up its local .pi/ config, CLAUDE.md, skills, and extensions. Use for role-specific subfolders.",
    }),
  ),
  fork: Type.Optional(
    Type.Boolean({
      description:
        "Force the full-context fork mode for this spawn. The sub-agent inherits the current session conversation, overriding any agent frontmatter session-mode.",
    }),
  ),
  autoExit: Type.Optional(
    Type.Boolean({
      description:
        "Whether the child exits after an ordinary settlement. Defaults to true.",
    }),
  ),
});

type SubagentSessionMode = "standalone" | "lineage-only" | "fork";

function resolveAutoExit(
  params: Pick<Static<typeof SubagentParams>, "autoExit">,
): boolean {
  return params.autoExit ?? true;
}

interface AgentDefaults {
  model?: string;
  tools?: string;
  skills?: string;
  thinking?: string;
  denyTools?: string;
  spawning?: boolean;
  systemPromptMode?: "append" | "replace";
  sessionMode?: SubagentSessionMode;
  cwd?: string;
  cli?: string;
  body?: string;
  disableModelInvocation?: boolean;
}

type AgentSource = "global" | "project";

interface AgentDefinition extends AgentDefaults {
  name: string;
  description?: string;
  disableModelInvocation: boolean;
}

interface ListedAgentDefinition extends AgentDefinition {
  source: AgentSource;
}

/** Tools that are gated by `spawning: false` */
const SPAWNING_TOOLS = new Set([
  "subagent",
  "subagent_interrupt",
  "subagents_list",
]);

/**
 * Resolve the effective set of denied tool names from agent defaults.
 * `spawning: false` expands to all SPAWNING_TOOLS.
 * `deny-tools` adds individual tool names on top.
 */
function resolveDenyTools(agentDefs: AgentDefaults | null): Set<string> {
  const denied = new Set<string>();
  if (!agentDefs) return denied;

  // spawning: false → deny all spawning tools
  if (agentDefs.spawning === false) {
    for (const t of SPAWNING_TOOLS) denied.add(t);
  }

  // deny-tools: explicit list
  if (agentDefs.denyTools) {
    for (const t of agentDefs.denyTools
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      denied.add(t);
    }
  }

  return denied;
}

/** Resolve the global agent config directory, respecting PI_CODING_AGENT_DIR. */
function getAgentConfigDir(): string {
  return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

function getFrontmatterValue(
  frontmatter: string,
  key: string,
): string | undefined {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  return value != null ? value === "true" : undefined;
}

function parseSessionMode(
  value: string | undefined,
): SubagentSessionMode | undefined {
  if (value === "standalone" || value === "lineage-only" || value === "fork") {
    return value;
  }
  return undefined;
}

function parseAgentDefinition(
  content: string,
  fallbackName: string,
): AgentDefinition | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = content.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();
  const systemPromptMode = getFrontmatterValue(frontmatter, "system-prompt");

  return {
    name: getFrontmatterValue(frontmatter, "name") ?? fallbackName,
    description: getFrontmatterValue(frontmatter, "description"),
    model: getFrontmatterValue(frontmatter, "model"),
    tools: getFrontmatterValue(frontmatter, "tools"),
    systemPromptMode:
      systemPromptMode === "replace"
        ? "replace"
        : systemPromptMode === "append"
          ? "append"
          : undefined,
    skills:
      getFrontmatterValue(frontmatter, "skill") ??
      getFrontmatterValue(frontmatter, "skills"),
    thinking: getFrontmatterValue(frontmatter, "thinking"),
    denyTools: getFrontmatterValue(frontmatter, "deny-tools"),
    spawning: parseOptionalBoolean(
      getFrontmatterValue(frontmatter, "spawning"),
    ),
    sessionMode: parseSessionMode(
      getFrontmatterValue(frontmatter, "session-mode"),
    ),
    cwd: getFrontmatterValue(frontmatter, "cwd"),
    cli: getFrontmatterValue(frontmatter, "cli"),
    body: body || undefined,
    disableModelInvocation:
      getFrontmatterValue(
        frontmatter,
        "disable-model-invocation",
      )?.toLowerCase() === "true",
  };
}

function discoverAgentDefinitions(): ListedAgentDefinition[] {
  const agents = new Map<string, ListedAgentDefinition>();
  const dirs: Array<{ path: string; source: AgentSource }> = [
    { path: join(getAgentConfigDir(), "agents"), source: "global" },
    { path: join(process.cwd(), ".pi", "agents"), source: "project" },
  ];

  for (const { path: dir, source } of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((entry) =>
      entry.endsWith(".md"),
    )) {
      const parsed = parseAgentDefinition(
        readFileSync(join(dir, file), "utf8"),
        file.replace(/\.md$/, ""),
      );
      if (!parsed) continue;
      agents.set(parsed.name, { ...parsed, source });
    }
  }

  return [...agents.values()];
}

function resolveSubagentPaths(
  params: Static<typeof SubagentParams>,
  agentDefs: AgentDefaults | null,
): {
  effectiveCwd: string | null;
  localAgentDir: string | null;
  effectiveAgentDir: string;
} {
  const rawCwd = params.cwd ?? agentDefs?.cwd ?? null;
  const cwdIsFromAgent = !params.cwd && agentDefs?.cwd != null;
  const cwdBase = cwdIsFromAgent ? getAgentConfigDir() : process.cwd();
  const effectiveCwd = rawCwd
    ? rawCwd.startsWith("/")
      ? rawCwd
      : join(cwdBase, rawCwd)
    : null;
  const localAgentDir = effectiveCwd
    ? join(effectiveCwd, ".pi", "agent")
    : null;
  const effectiveAgentDir =
    localAgentDir && existsSync(localAgentDir)
      ? localAgentDir
      : getAgentConfigDir();
  return { effectiveCwd, localAgentDir, effectiveAgentDir };
}

function getDefaultSessionDirFor(cwd: string, agentDir: string): string {
  const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  const sessionDir = join(agentDir, "sessions", safePath);
  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
  }
  return sessionDir;
}

function resolveEffectiveSessionMode(
  params: Static<typeof SubagentParams>,
  agentDefs: AgentDefaults | null,
): SubagentSessionMode {
  if (params.fork) return "fork";
  return agentDefs?.sessionMode ?? "standalone";
}

function resolveLaunchBehavior(
  params: Static<typeof SubagentParams>,
  agentDefs: AgentDefaults | null,
): {
  sessionMode: SubagentSessionMode;
  seededSessionMode: "lineage-only" | "fork" | null;
  inheritsConversationContext: boolean;
  taskDelivery: "direct" | "artifact";
} {
  const sessionMode = resolveEffectiveSessionMode(params, agentDefs);
  const inheritsConversationContext = sessionMode === "fork";
  return {
    sessionMode,
    seededSessionMode: sessionMode === "standalone" ? null : sessionMode,
    inheritsConversationContext,
    taskDelivery: inheritsConversationContext ? "direct" : "artifact",
  };
}

function loadAgentDefaults(agentName: string): AgentDefaults | null {
  const configDir = getAgentConfigDir();
  const paths = [
    join(process.cwd(), ".pi", "agents", `${agentName}.md`),
    join(configDir, "agents", `${agentName}.md`),
  ];

  for (const p of paths) {
    if (!existsSync(p)) continue;
    const parsed = parseAgentDefinition(readFileSync(p, "utf8"), agentName);
    if (parsed) return parsed;
  }

  return null;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/**
 * Wait long enough for a freshly created pane to finish shell startup.
 *
 * Some environments do extra shell-init work before the prompt is ready
 * (for example direnv/devenv), so the delay is configurable for users who hit
 * dropped commands. Keep the historical default at 500ms.
 */
function getShellReadyDelayMs(): number {
  const raw = process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 500;
}

function muxUnavailableResult() {
  return {
    content: [
      {
        type: "text" as const,
        text: `Subagents require a supported terminal multiplexer. ${muxSetupHint()}`,
      },
    ],
    details: { error: "mux not available" },
  };
}

/**
 * Build the internal artifact directory path for the current session.
 * Used by the subagents extension to stash task files, system prompts, and
 * launch scripts for sub-agents. Path convention:
 *   <sessionDir>/artifacts/<session-id>/
 */
function getArtifactDir(sessionDir: string, sessionId: string): string {
  return join(sessionDir, "artifacts", sessionId);
}

const statusConfig = loadStatusConfig();

function formatWidgetRightLabel(snapshot: StatusSnapshot): string {
  if (snapshot.kind === "starting") return " starting… ";
  if (snapshot.kind === "running") return ` running ${snapshot.elapsedText} `;
  if (snapshot.kind === "active") {
    const label = snapshot.activityLabel ?? snapshot.activeScope;
    const duration = snapshot.activeDurationText
      ? ` ${snapshot.activeDurationText}`
      : "";
    return label ? ` active · ${label}${duration} ` : " active ";
  }
  if (snapshot.kind === "waiting") {
    const duration = snapshot.waitingDurationText
      ? ` ${snapshot.waitingDurationText}`
      : "";
    const detail = snapshot.statusLabel ? ` · ${snapshot.statusLabel}` : "";
    return ` waiting${duration}${detail} `;
  }

  const detail = snapshot.statusLabel ? ` · ${snapshot.statusLabel}` : "";
  const duration = snapshot.snapshotProblemText
    ? ` ${snapshot.snapshotProblemText}`
    : "";
  return ` stalled${detail}${duration} `;
}

function formatWidgetStatusMarker(snapshot: StatusSnapshot): string {
  return snapshot.kind === "active" && snapshot.activeScope === "streaming"
    ? "🟢"
    : "🟡";
}

function resolveResultPresentation(
  result: Pick<
    SubagentResult,
    "exitCode" | "elapsed" | "summary" | "sessionFile" | "errorMessage"
  >,
  name: string,
): string {
  const sessionRef = result.sessionFile
    ? `\n\nSession: ${result.sessionFile}\nResume: pi --session ${result.sessionFile}`
    : "";

  if (result.errorMessage) {
    // Auto-retry exhausted or other agent-loop error. The subagent did not
    // produce a usable result — surface the underlying provider/network
    // failure so the orchestrator can decide whether to retry, resume, or
    // change approach instead of silently treating the run as completed.
    return (
      `Sub-agent "${name}" failed after ${formatElapsed(result.elapsed)} ` +
      `(provider/agent error — auto-retry exhausted).\n\n` +
      `Error: ${result.errorMessage}\n\n` +
      `The subagent did not produce a result. You can retry by spawning a new ` +
      `subagent or steer the durable child session again.${sessionRef}`
    );
  }

  return result.exitCode !== 0
    ? `Sub-agent "${name}" failed (exit code ${result.exitCode}).\n\n${result.summary}${sessionRef}`
    : `Sub-agent "${name}" completed (${formatElapsed(result.elapsed)}).\n\n${result.summary}${sessionRef}`;
}

/**
 * Result from running a single subagent.
 */
interface SubagentResult {
  name: string;
  task: string;
  summary: string;
  sessionFile?: string;
  exitCode: number;
  elapsed: number;
  error?: string;
  /** Provider/agent error message when auto-retry exhausted (overload, rate limit, etc.). */
  errorMessage?: string;
  ping?: { name: string; message: string };
  reason?: "done" | "ping" | "settlement" | "sentinel" | "error";
}

/**
 * State for a launched (but not yet completed) subagent.
 */
interface PiLaunchProfile {
  sessionFile: string;
  activityFile: string;
  cwdPrefix: string;
  environment: readonly string[];
  arguments: readonly string[];
  selectedSkills: readonly string[];
}

const RESUMABLE_SNAPSHOT_CUSTOM_TYPE =
  "pi-attachable-subagents/resumable-snapshot";
const CHILD_SESSION_CUSTOM_TYPE = "pi-attachable-subagents/child";

interface ChildSession {
  managerSessionId: string;
  childSessionId: string;
  name: string;
  agent?: string;
  cwd: string;
  autoExit?: boolean;
  startedAt?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
function validateChildSession(value: unknown): ChildSession | undefined {
  if (
    !isPlainObject(value) ||
    value.version !== 1 ||
    !isNonemptyString(value.managerSessionId) ||
    !isNonemptyString(value.childSessionId) ||
    !isNonemptyString(value.name) ||
    !isNonemptyString(value.cwd) ||
    (value.agent !== undefined && !isNonemptyString(value.agent)) ||
    (value.autoExit !== undefined && typeof value.autoExit !== "boolean")
  )
    return undefined;
  return {
    managerSessionId: value.managerSessionId,
    childSessionId: value.childSessionId,
    name: value.name,
    ...(value.agent === undefined ? {} : { agent: value.agent }),
    cwd: value.cwd,
    autoExit: value.autoExit ?? true,
    ...(typeof value.startedAt === "number" && Number.isFinite(value.startedAt)
      ? { startedAt: value.startedAt }
      : {}),
  };
}
function replayChildCatalog(
  header: { id?: unknown } | null,
  managerSessionId: string,
  branch: readonly unknown[],
): Map<string, ChildSession> {
  const catalog = new Map<string, ChildSession>();
  if (header?.id !== managerSessionId) return catalog;
  for (const entry of branch) {
    if (
      !isPlainObject(entry) ||
      entry.type !== "custom" ||
      entry.customType !== CHILD_SESSION_CUSTOM_TYPE
    )
      continue;
    const child = validateChildSession(entry.data);
    if (
      child &&
      child.managerSessionId === managerSessionId &&
      !catalog.has(child.childSessionId)
    )
      catalog.set(child.childSessionId, {
        ...child,
        ...(child.startedAt === undefined &&
        typeof entry.timestamp === "string" &&
        Number.isFinite(Date.parse(entry.timestamp))
          ? { startedAt: Date.parse(entry.timestamp) }
          : {}),
      });
  }
  return catalog;
}
const NATIVE_SESSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nativeSessionId(sessionFile: string): string | undefined {
  try {
    const header = JSON.parse(
      readFileSync(sessionFile, "utf8").split("\n", 1)[0],
    );
    return header?.type === "session" &&
      isNonemptyString(header.id) &&
      NATIVE_SESSION_ID.test(header.id) &&
      isNonemptyString(header.cwd)
      ? header.id
      : undefined;
  } catch {
    return undefined;
  }
}
/** Narrow one-way reader for pre-registry snapshots. It never writes snapshots. */
function migrateLegacySnapshots(
  header: { id?: unknown } | null,
  managerSessionId: string,
  branch: readonly unknown[],
  existing: ReadonlyMap<string, ChildSession>,
): ChildSession[] {
  if (header?.id !== managerSessionId) return [];
  const recovered = new Map<string, ChildSession>();
  for (const entry of branch) {
    if (
      !isPlainObject(entry) ||
      entry.type !== "custom" ||
      entry.customType !== RESUMABLE_SNAPSHOT_CUSTOM_TYPE ||
      !isPlainObject(entry.data) ||
      entry.data.version !== 1 ||
      entry.data.ownerSessionId !== managerSessionId ||
      !Array.isArray(entry.data.records)
    )
      continue;
    for (const record of entry.data.records) {
      if (
        !isPlainObject(record) ||
        !isNonemptyString(record.name) ||
        !isPlainObject(record.launchProfile) ||
        !isNonemptyString(record.launchProfile.sessionFile)
      )
        continue;
      const sessionFile = record.launchProfile.sessionFile;
      const childSessionId = nativeSessionId(sessionFile);
      if (
        !childSessionId ||
        existing.has(childSessionId) ||
        recovered.has(childSessionId)
      )
        continue;
      try {
        const childHeader = JSON.parse(
          readFileSync(sessionFile, "utf8").split("\n", 1)[0],
        );
        if (isNonemptyString(childHeader.cwd))
          recovered.set(childSessionId, {
            managerSessionId,
            childSessionId,
            name: record.name,
            ...(isNonemptyString(record.agent) ? { agent: record.agent } : {}),
            cwd: childHeader.cwd,
            autoExit: true,
            ...(typeof childHeader.timestamp === "string" &&
            Number.isFinite(Date.parse(childHeader.timestamp))
              ? { startedAt: Date.parse(childHeader.timestamp) }
              : {}),
          });
      } catch {}
    }
  }
  return [...recovered.values()];
}
/** Recover only actual historical manager-side subagent entries. */
function migrateHistoricalToolResults(
  header: { id?: unknown } | null,
  managerSessionId: string,
  branch: readonly unknown[],
  existing: ReadonlyMap<string, ChildSession>,
): ChildSession[] {
  if (header?.id !== managerSessionId) return [];
  const recovered = new Map<string, ChildSession>();
  const add = (details: unknown) => {
    if (
      !isPlainObject(details) ||
      !isNonemptyString(details.sessionFile) ||
      !isNonemptyString(details.name)
    )
      return;
    const childSessionId = nativeSessionId(details.sessionFile);
    if (
      !childSessionId ||
      childSessionId === managerSessionId ||
      existing.has(childSessionId) ||
      recovered.has(childSessionId)
    )
      return;
    try {
      const childHeader = JSON.parse(
        readFileSync(details.sessionFile, "utf8").split("\n", 1)[0],
      );
      recovered.set(childSessionId, {
        managerSessionId,
        childSessionId,
        name: details.name,
        ...(isNonemptyString(details.agent) ? { agent: details.agent } : {}),
        cwd: childHeader.cwd,
        autoExit: true,
        ...(typeof childHeader.timestamp === "string" &&
        Number.isFinite(Date.parse(childHeader.timestamp))
          ? { startedAt: Date.parse(childHeader.timestamp) }
          : {}),
      });
    } catch {}
  };

  for (const entry of branch) {
    if (!isPlainObject(entry)) continue;
    if (
      entry.type === "custom_message" &&
      (entry.customType === "subagent_result" ||
        entry.customType === "subagent_ping")
    ) {
      add(entry.details);
      continue;
    }
    if (
      entry.type === "message" &&
      isPlainObject(entry.message) &&
      entry.message.role === "toolResult" &&
      entry.message.toolName === "subagent" &&
      isPlainObject(entry.message.details) &&
      entry.message.details.status === "started"
    )
      add(entry.message.details);
  }
  return [...recovered.values()];
}
interface PiLaunchRun {
  surface: string;
  promptArguments: readonly string[];
  originalLaunch: boolean;
  tmuxHiddenSession?: string;
}
function buildPiLaunchCommand(
  profile: PiLaunchProfile,
  run: PiLaunchRun,
): string {
  const environment = [
    ...profile.environment,
    `PI_SUBAGENT_SKILLS=${shellEscape(run.originalLaunch ? profile.selectedSkills.join(",") : "")}`,
    `PI_SUBAGENT_SURFACE=${shellEscape(run.surface)}`,
  ];
  if (run.tmuxHiddenSession)
    environment.push(
      `PI_SUBAGENT_TMUX_HIDDEN_SESSION=${shellEscape(run.tmuxHiddenSession)}`,
    );
  const command =
    `${profile.cwdPrefix}${environment.join(" ")} ${profile.arguments.join(" ")} ${run.promptArguments.map(shellEscape).join(" ")}`.trim();
  return `${command}; echo '__SUBAGENT_DONE_'$?'__'`;
}
interface RunningSubagent {
  id: string;
  name: string;
  task: string;
  agent?: string;
  surface: string;
  tmuxHiddenOwner?: TmuxHiddenOwner;
  startTime: number;
  sessionFile: string;
  launchScriptFile?: string;
  activityFile?: string;
  launchProfile?: PiLaunchProfile;
  activity?: SubagentActivityState;
  activityRead?: {
    ok: boolean;
    reason?: "missing" | "invalid" | "wrong-id";
    error?: string;
  };
  abortController?: AbortController;
  explicitlyStopped?: boolean;
  shutdownCancelled?: boolean;
  statusState: SubagentStatusState;
  statusEntryCursor: number;
  displayModel?: string;
  displayProvider?: string;
  displayTps?: number;
  requestStatsSignature?: string;
  requestStatsCheckedAt?: number;
  requestStatsSelection?: string;
  requestStatsAggregate?: RequestStatsAggregate;
  deliveryId?: string;
}
const runningSubagents = new Map<string, RunningSubagent>();
const startingSubagents = new Map<string, symbol>();
const childrenBySessionId = new Map<string, ChildSession>();

export interface ExtensionLifecycle {
  watcherOwner: ReturnType<typeof createWatcherOwner>;
  ownedRuns: Set<RunningSubagent>;
  ownedStartReservations: Map<string, symbol>;
  ownedDeliveryIds: Set<string>;
  tmuxHiddenOwner?: TmuxHiddenOwner;
}

function createExtensionLifecycle(): ExtensionLifecycle {
  return {
    watcherOwner: createWatcherOwner(),
    ownedRuns: new Set(),
    ownedStartReservations: new Map(),
    ownedDeliveryIds: new Set(),
  };
}

function createLifecycleSurface(
  lifecycle: ExtensionLifecycle,
  name: string,
  parentPiSessionId: string,
): string {
  if (getMuxBackend() === "tmux") {
    const created = createTmuxHiddenSurface(
      name,
      parentPiSessionId,
      lifecycle.tmuxHiddenOwner,
    );
    lifecycle.tmuxHiddenOwner = created.owner;
    return created.surface;
  }
  return createSurface(name);
}

function releaseTmuxHiddenOwnerIfIdle(
  lifecycle: ExtensionLifecycle,
  destroy: (owner: TmuxHiddenOwner) => void = destroyTmuxHiddenOwner,
): void {
  if (lifecycle.ownedRuns.size > 0) return;
  const owner = lifecycle.tmuxHiddenOwner;
  if (!owner) return;
  destroy(owner);
  lifecycle.tmuxHiddenOwner = undefined;
}

function registerLaunchedDelivery(
  running: RunningSubagent,
  lifecycle: ExtensionLifecycle,
  coordinator: DelegatorLivenessCoordinator = delegatorLiveness,
): string {
  const deliveryId = running.deliveryId ?? randomUUID();
  running.deliveryId = deliveryId;
  coordinator.registerRunning(deliveryId);
  lifecycle.ownedDeliveryIds.add(deliveryId);
  return deliveryId;
}

type LaunchStage = "seed" | "registration" | "surface" | "dispatch";

function formatLaunchFailure(
  stage: LaunchStage,
  registered: boolean,
  error: unknown,
): Error {
  const detail = error instanceof Error ? error.message : String(error);
  const state = registered
    ? "is registered but idle/not running"
    : "was not registered and cannot be steered";
  return new Error(`Child launch ${stage} failed; child ${state}: ${detail}`);
}

async function runLaunchLifecycle(params: {
  seed: () => void;
  appendRegistration: () => void;
  createSurface: () => string;
  dispatch: (surface: string) => void | Promise<void>;
  closeSurface: (surface: string) => void;
  onStage?: (stage: LaunchStage, registered: boolean) => void;
}): Promise<string> {
  let registered = false;
  let stage: LaunchStage = "seed";
  try {
    params.onStage?.(stage, registered);
    params.seed();
    stage = "registration";
    params.onStage?.(stage, registered);
    params.appendRegistration();
    registered = true;
    stage = "surface";
    params.onStage?.(stage, registered);
    const surface = params.createSurface();
    try {
      stage = "dispatch";
      params.onStage?.(stage, registered);
      await params.dispatch(surface);
      return surface;
    } catch (error) {
      try {
        params.closeSurface(surface);
      } catch {}
      throw formatLaunchFailure(stage, registered, error);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Child launch "))
      throw error;
    throw formatLaunchFailure(stage, registered, error);
  }
}

function removeActiveRun(
  activeRuns: Map<string, RunningSubagent>,
  running: RunningSubagent,
  close: (surface: string) => void = closeSurface,
): void {
  close(running.surface);
  if (activeRuns.get(running.id) === running) activeRuns.delete(running.id);
}

function stopActiveRun(
  activeRuns: Map<string, RunningSubagent>,
  running: RunningSubagent,
  close: (surface: string) => void = closeSurface,
  coordinator: DelegatorLivenessCoordinator = delegatorLiveness,
): void {
  if (running.deliveryId) coordinator.cancel(running.deliveryId);
  running.explicitlyStopped = true;
  running.abortController?.abort();
  removeActiveRun(activeRuns, running, close);
}

function shutdownLifecycle(
  lifecycle: ExtensionLifecycle,
  activeRuns: Map<string, RunningSubagent>,
  close: (surface: string) => void = closeSurface,
  startingRuns: Map<string, symbol> = startingSubagents,
  coordinator: DelegatorLivenessCoordinator = delegatorLiveness,
  destroyTmuxOwner: (owner: TmuxHiddenOwner) => void = destroyTmuxHiddenOwner,
): void {
  for (const deliveryId of lifecycle.ownedDeliveryIds)
    coordinator.cancel(deliveryId);
  lifecycle.ownedDeliveryIds.clear();
  lifecycle.watcherOwner.abort();
  for (const [
    childSessionId,
    reservation,
  ] of lifecycle.ownedStartReservations) {
    if (startingRuns.get(childSessionId) === reservation)
      startingRuns.delete(childSessionId);
  }
  lifecycle.ownedStartReservations.clear();
  const failures: unknown[] = [];
  for (const running of [...lifecycle.ownedRuns]) {
    running.shutdownCancelled = true;
    running.abortController?.abort();
    try {
      removeActiveRun(activeRuns, running, close);
      lifecycle.ownedRuns.delete(running);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0)
    throw new AggregateError(failures, "Failed to close subagent surfaces");
  releaseTmuxHiddenOwnerIfIdle(lifecycle, destroyTmuxOwner);
}

function shouldDeliverWatcherNotification(running: RunningSubagent): boolean {
  return !running.explicitlyStopped && !running.shutdownCancelled;
}
function drainPersistentStatuses(
  running: RunningSubagent,
  deliver: (status: { kind: "status" | "error"; report: string }) => void,
): void {
  if (!existsSync(running.sessionFile)) return;
  const entries = getNewEntries(running.sessionFile, running.statusEntryCursor);
  running.statusEntryCursor += entries.length;
  for (const entry of entries) {
    if (
      entry.type !== "custom" ||
      (entry as { customType?: unknown }).customType !==
        PERSISTENT_STATUS_CUSTOM_TYPE
    )
      continue;
    const data = (entry as { data?: unknown }).data;
    if (
      !isPlainObject(data) ||
      data.version !== 1 ||
      data.childSessionId !== running.id
    )
      continue;
    if (
      (data.kind !== "status" && data.kind !== "error") ||
      !isNonemptyString(data.report)
    )
      continue;
    deliver({ kind: data.kind, report: data.report });
  }
}
function cleanupFailedWatcherRun(running: RunningSubagent): void {
  runningSubagents.delete(running.id);
}
function appendPersistenceWarning(
  content: string,
  _warning: string | undefined,
): string {
  return content;
}
function completeWakeTransition(
  actions: {
    deliveryId?: string;
    update: () => void;
    wake: (warning?: string) => void;
  },
  coordinator: DelegatorLivenessCoordinator = delegatorLiveness,
): boolean {
  if (actions.deliveryId && !coordinator.beginWake(actions.deliveryId))
    return false;
  actions.update();
  actions.wake();
  if (actions.deliveryId) coordinator.markDelivered(actions.deliveryId);
  return true;
}

// ── Widget management ──

/** Latest ExtensionContext from session_start, used for widget updates. */
let latestCtx: ExtensionContext | null = null;

/** Interval timer for widget re-renders. */
let widgetInterval: ReturnType<typeof setInterval> | null = null;

/** Interval timer for status transition checks. */
let statusInterval: ReturnType<typeof setInterval> | null = null;

let showStoppedChildren = false;

function getActiveRuntimeMs(running: RunningSubagent, now: number): number {
  return Math.max(0, now - running.startTime);
}

function formatLocalStartTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "??:??";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "??:??";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatLocalCatalogStartTime(
  timestamp: number,
  now = Date.now(),
): string {
  if (!Number.isFinite(timestamp)) return "??? ?? ??:??";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "??? ?? ??:??";
  const current = new Date(now);
  if (Number.isNaN(current.getTime())) return "??? ?? ??:??";
  if (
    date.getFullYear() === current.getFullYear() &&
    date.getMonth() === current.getMonth() &&
    date.getDate() === current.getDate()
  )
    return formatLocalStartTime(timestamp);
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][date.getMonth()];
  return `${month} ${date.getDate()} ${formatLocalStartTime(timestamp)}`;
}

function formatElapsedMMSS(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const ACCENT = "\x1b[38;2;77;163;255m";
const RST = "\x1b[0m";
const STOPPED_CHILDREN_SHORTCUT = Key.ctrlAlt("s");
const STOPPED_CHILDREN_KEY_LABEL = "Ctrl+Alt+S";

/**
 * Build a bordered content line: │left          right│
 * Left content is truncated if needed, right is preserved, padded to fill width.
 */
function borderLine(left: string, right: string, width: number): string {
  if (width <= 0) return "";
  if (width === 1) return `${ACCENT}│${RST}`;

  // width = total visible chars for the whole line including │ and │
  const contentWidth = Math.max(0, width - 2); // space inside the two │ chars
  const rightVis = visibleWidth(right);

  // If the status chunk alone is too wide, prefer preserving it in compact form
  // rather than overflowing the terminal.
  if (rightVis >= contentWidth) {
    const truncRight = truncateToWidth(right, contentWidth);
    const rightPad = Math.max(0, contentWidth - visibleWidth(truncRight));
    return `${ACCENT}│${RST}${truncRight}${" ".repeat(rightPad)}${ACCENT}│${RST}`;
  }

  const maxLeft = Math.max(0, contentWidth - rightVis);
  const truncLeft = truncateToWidth(left, maxLeft);
  const leftVis = visibleWidth(truncLeft);
  const pad = Math.max(0, contentWidth - leftVis - rightVis);
  return `${ACCENT}│${RST}${truncLeft}${" ".repeat(pad)}${right}${ACCENT}│${RST}`;
}

/**
 * Build the bordered top line: ╭─ Title ──── info ─╮
 * All chars are accounted for within `width`.
 */
function borderTop(title: string, info: string, width: number): string {
  if (width <= 0) return "";
  if (width === 1) return `${ACCENT}╭${RST}`;

  // ╭─ Title ───...─── info ─╮
  // overhead: ╭─ (2) + space around title (2) + space around info (2) + ─╮ (2) = but we simplify
  const inner = Math.max(0, width - 2); // inside ╭ and ╮
  const titlePart = `─ ${title} `;
  const infoPart = ` ${info} ─`;
  const fillLen = Math.max(0, inner - titlePart.length - infoPart.length);
  const fill = "─".repeat(fillLen);
  const content = `${titlePart}${fill}${infoPart}`
    .slice(0, inner)
    .padEnd(inner, "─");
  return `${ACCENT}╭${content}╮${RST}`;
}

/**
 * Build the bordered bottom line: ╰──────────────────╯
 */
function borderBottom(width: number): string {
  if (width <= 0) return "";
  if (width === 1) return `${ACCENT}╰${RST}`;

  const inner = Math.max(0, width - 2);
  return `${ACCENT}╰${"─".repeat(inner)}╯${RST}`;
}

function sortChildCatalog(children: Iterable<ChildSession>): ChildSession[] {
  return [...children].sort(
    (left, right) =>
      (right.startedAt ?? 0) - (left.startedAt ?? 0) ||
      right.childSessionId.localeCompare(left.childSessionId),
  );
}

function renderSubagentWidgetLines(
  children: ChildSession[],
  activeRuns: ReadonlyMap<string, RunningSubagent>,
  width: number,
  now = Date.now(),
  showStopped = false,
): string[] {
  const orderedChildren = sortChildCatalog(children);
  const activeCount = orderedChildren.filter((child) =>
    activeRuns.has(child.childSessionId),
  ).length;
  const stoppedCount = orderedChildren.length - activeCount;
  let info: string;
  if (stoppedCount === 0) {
    info = `${orderedChildren.length} tracked · ${activeCount} active`;
  } else if (showStopped) {
    info = `${orderedChildren.length} tracked · ${activeCount} active · ${STOPPED_CHILDREN_KEY_LABEL} hide stopped`;
  } else if (activeCount === 0) {
    info = `${stoppedCount} stopped · ${STOPPED_CHILDREN_KEY_LABEL} show`;
  } else {
    info = `${activeCount} active · ${stoppedCount} stopped · ${STOPPED_CHILDREN_KEY_LABEL} show`;
  }
  const lines: string[] = [borderTop("Subagents", info, width)];

  for (const child of orderedChildren) {
    const running = activeRuns.get(child.childSessionId);
    if (!running && !showStopped) continue;
    const agentTag = child.agent ? ` (${child.agent})` : "";
    const startedAt = child.startedAt ?? 0;
    const left = ` ${child.name}${agentTag} `;
    const status = running
      ? formatWidgetStatusMarker(classifyStatus(running.statusState, now))
      : "🔴";
    const right = running
      ? ` ${status} ${formatLocalCatalogStartTime(startedAt, now)}  ${formatElapsedMMSS(getActiveRuntimeMs(running, now))}  ${running.displayModel ?? "—"}  ${running.displayTps == null ? "—" : `${running.displayTps.toFixed(1)} tok/s`} `
      : ` ${status} ${formatLocalCatalogStartTime(startedAt, now)} `;
    lines.push(borderLine(left, right, width));
  }

  lines.push(borderBottom(width));
  return lines;
}

function updateWidget() {
  if (!latestCtx?.hasUI) return;

  if (childrenBySessionId.size === 0) {
    latestCtx.ui.setWidget("subagent-status", undefined);
    if (widgetInterval) {
      clearInterval(widgetInterval);
      widgetInterval = null;
      (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
    }
    return;
  }

  latestCtx.ui.setWidget(
    "subagent-status",
    (_tui: any, _theme: any) => {
      return {
        invalidate() {},
        render(width: number) {
          return renderSubagentWidgetLines(
            Array.from(childrenBySessionId.values()),
            runningSubagents,
            width,
            Date.now(),
            showStoppedChildren,
          );
        },
      };
    },
    { placement: "aboveEditor" },
  );
  if (runningSubagents.size === 0 && widgetInterval) {
    clearInterval(widgetInterval);
    widgetInterval = null;
    (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
  }
}

/**
 * Build the positional prompt args for a Pi CLI subagent launch.
 *
 * In artifact-backed launches (lineage-only, standalone), Pi's buildInitialMessage()
 * concatenates @file content with messages[0] into one initial prompt. That breaks
 * /skill: expansion because the message no longer starts with "/skill:". Only
 * messages[1..] are sent as separate follow-up prompts where /skill: is recognized.
 *
 * When there are skill prompts AND artifact-backed delivery, we prepend an empty
 * first positional message so that /skill: args land in messages[1..] and arrive
 * as standalone prompts in the child session.
 */
const SUBAGENT_CONTROL_TOOLS = ["caller_ping", "subagent_done"] as const;

/**
 * Build the child --tools allowlist.
 *
 * Pi 0.70+ applies --tools to built-in, extension, and custom tools. If a
 * subagent definition restricts tools to e.g. "read,bash,write", the child
 * control tools from subagent-done.ts would otherwise be hidden, leaving a
 * manually resumed or user-touched subagent unable to call its control tools.
 */
function buildSubagentToolAllowlist(effectiveTools?: string): string | null {
  const requested = (effectiveTools ?? "")
    .split(",")
    .map((tool) => tool.trim())
    .filter(Boolean);

  if (requested.length === 0) return null;

  const allow = new Set(requested);
  for (const tool of SUBAGENT_CONTROL_TOOLS) {
    allow.add(tool);
  }

  return [...allow].join(",");
}

function formatSubagentSteerCall(
  target: string,
  message: string,
  expanded: boolean,
) {
  return {
    target: target.trim() || "(unknown)",
    ...formatSubagentTaskCall(message, expanded),
  };
}

function formatSubagentTaskCall(task: string, expanded: boolean) {
  const lines = task.split("\n");
  if (expanded) {
    return { body: task, lineCount: lines.length, expandable: false };
  }

  const firstLine = lines.find((line) => line.trim()) ?? "";
  const clipped = firstLine.length > 100;
  return {
    body: clipped ? firstLine.slice(0, 100) + "…" : firstLine,
    lineCount: lines.length,
    expandable: clipped || lines.length > 1,
  };
}

const PI_REASONING_SUFFIXES = new Set([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

function resolveModelArgument(
  explicitModel?: string,
  agentModel?: string,
  agentThinking?: string,
): string | undefined {
  if (explicitModel) return explicitModel;
  if (!agentModel) return undefined;
  const suffix = agentModel.slice(agentModel.lastIndexOf(":") + 1);
  if (PI_REASONING_SUFFIXES.has(suffix)) return agentModel;
  return agentThinking ? `${agentModel}:${agentThinking}` : agentModel;
}

function buildSystemPromptArguments(params: {
  agentBodyPath?: string;
  agentMode?: "append" | "replace";
  callerPromptPath?: string;
}): string[] {
  const result: string[] = [];
  if (params.agentBodyPath) {
    result.push(
      params.agentMode === "replace"
        ? "--system-prompt"
        : "--append-system-prompt",
      shellEscape(params.agentBodyPath),
    );
  }
  if (params.callerPromptPath) {
    result.push("--append-system-prompt", shellEscape(params.callerPromptPath));
  }
  return result;
}

function buildInitialTask(task: string): string {
  return [
    "Complete your task autonomously. If blocked, call caller_ping. When finished, call subagent_done. Automatic settlement is only a fallback.",
    task,
    "Your FINAL assistant message should summarize what you accomplished.",
  ].join("\n\n");
}

function buildPiPromptArgs(params: {
  files?: string[];
  taskArg: string;
}): string[] {
  const fileArgs = (params.files ?? []).map((path) =>
    path.startsWith("@") ? path : `@${path}`,
  );
  return [...fileArgs, params.taskArg];
}

function activityLabel(activity: SubagentActivityState): string | undefined {
  if (activity.phase !== "active") return undefined;
  if (activity.activeScope === "tool") return activity.toolName ?? "tool";
  if (activity.activeScope === "provider") return "provider";
  if (activity.activeScope === "streaming") return "streaming";
  return activity.activeScope;
}

function refreshDisplaySnapshot(
  running: RunningSubagent,
  now = Date.now(),
  stateDir?: string,
): void {
  let peek: ReturnType<typeof inspectSession> | undefined;
  try {
    peek = inspectSession(running.sessionFile);
    running.displayProvider = peek.provider;
    running.displayModel = peek.model ?? running.displayModel;
  } catch {}

  const provider = peek?.provider;
  const model = peek?.model;
  const selection = provider && model ? `${provider}\u0000${model}` : undefined;
  const updateRate = () => {
    const bucket = running.requestStatsAggregate?.buckets.find(
      (candidate) =>
        candidate.provider === provider && candidate.model === model,
    );
    running.displayTps =
      bucket && bucket.generationMs > 0
        ? bucket.outputTokens / (bucket.generationMs / 1000)
        : undefined;
  };
  if (selection !== running.requestStatsSelection) {
    running.requestStatsSelection = selection;
    updateRate();
  }
  if (!provider || !model) return;

  // The renderer only consumes this memory snapshot. Both watcher and status
  // observations share this per-run one-second cadence.
  if (
    running.requestStatsCheckedAt !== undefined &&
    now - running.requestStatsCheckedAt < 1000
  )
    return;
  running.requestStatsCheckedAt = now;
  try {
    const file = requestStatsSidecarPath(running.id, stateDir);
    const metadata = statSync(file);
    const signature = `${metadata.mtimeMs}:${metadata.size}`;
    if (signature === running.requestStatsSignature) return;
    running.requestStatsSignature = signature;
    running.requestStatsAggregate = validateRequestStatsAggregate(
      JSON.parse(readFileSync(file, "utf8")),
      running.id,
    );
    updateRate();
  } catch {
    running.requestStatsSignature = undefined;
    running.requestStatsAggregate = undefined;
    running.displayTps = undefined;
  }
}

function observeRunningSubagent(
  running: RunningSubagent,
  observedAt = Date.now(),
) {
  refreshDisplaySnapshot(running, observedAt);
  const activityFile = running.activityFile;
  const read: ActivityReadResult = activityFile
    ? readSubagentActivityFile(activityFile, running.id)
    : { ok: false, reason: "missing" };

  running.activityRead = read.ok
    ? { ok: true }
    : { ok: false, reason: read.reason, error: read.error };

  if (read.ok) {
    running.activity = read.activity;
    running.statusState = observeStatus(
      running.statusState,
      {
        snapshot: "present",
        updatedAt: read.activity.updatedAt,
        sequence: read.activity.sequence,
        phase: read.activity.phase,
        active: read.activity.phase === "active",
        activeScope: read.activity.activeScope,
        activeSince: read.activity.activeSince,
        waitingSince: read.activity.waitingSince,
        latestEvent: read.activity.latestEvent,
        activityLabel: activityLabel(read.activity),
      },
      observedAt,
    );
    return;
  }

  running.statusState = observeStatus(
    running.statusState,
    {
      snapshot: read.reason,
      snapshotError: read.error,
    },
    observedAt,
  );
}

function resolveCatalogTarget(
  children: ChildSession[],
  query: string,
): { child: ChildSession } | { error: string } {
  const requested = query.trim();
  const exact = children.find((child) => child.childSessionId === requested);
  if (exact) return { child: exact };
  const matches = children.filter(
    (child) =>
      child.childSessionId.startsWith(requested) || child.name === requested,
  );
  if (matches.length === 1) return { child: matches[0] };
  if (matches.length === 0)
    return { error: `No child session matches "${requested}".` };
  return {
    error: `Ambiguous child session "${requested}". Matches: ${matches.map((child) => `${child.name} [${child.childSessionId}]`).join(", ")}`,
  };
}

function findChildSessionFile(child: ChildSession): string | undefined {
  const agentDir = existsSync(join(child.cwd, ".pi", "agent"))
    ? join(child.cwd, ".pi", "agent")
    : getAgentConfigDir();
  const dir = getDefaultSessionDirFor(child.cwd, agentDir);
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".jsonl")) continue;
      const path = join(dir, file);
      if (nativeSessionId(path) === child.childSessionId) return path;
    }
  } catch {}
  return undefined;
}

type SteerDecision =
  | { kind: "active"; running: RunningSubagent }
  | { kind: "starting" }
  | { kind: "idle" };

function resolveSteerDecision(
  activeRuns: Map<string, RunningSubagent>,
  startingRuns: ReadonlyMap<string, symbol>,
  child: ChildSession,
): SteerDecision {
  const running = activeRuns.get(child.childSessionId);
  if (running) return { kind: "active", running };
  return startingRuns.has(child.childSessionId)
    ? { kind: "starting" }
    : { kind: "idle" };
}

type IdleStartResult =
  | { kind: "active"; running: RunningSubagent }
  | { kind: "starting" }
  | { kind: "cancelled" };

/**
 * Reserve an idle child before its first asynchronous launch operation.
 * Concurrent steering receives `starting`; its message is not delivered.
 */
async function startIdleChild(params: {
  activeRuns: Map<string, RunningSubagent>;
  startingRuns: Map<string, symbol>;
  lifecycle: ExtensionLifecycle;
  child: ChildSession;
  start: () => Promise<RunningSubagent>;
  close?: (surface: string) => void;
}): Promise<IdleStartResult> {
  const decision = resolveSteerDecision(
    params.activeRuns,
    params.startingRuns,
    params.child,
  );
  if (decision.kind !== "idle") return decision;

  const reservation = Symbol(params.child.childSessionId);
  params.startingRuns.set(params.child.childSessionId, reservation);
  params.lifecycle.ownedStartReservations.set(
    params.child.childSessionId,
    reservation,
  );
  const release = () => {
    if (params.startingRuns.get(params.child.childSessionId) === reservation)
      params.startingRuns.delete(params.child.childSessionId);
    if (
      params.lifecycle.ownedStartReservations.get(
        params.child.childSessionId,
      ) === reservation
    )
      params.lifecycle.ownedStartReservations.delete(
        params.child.childSessionId,
      );
  };
  try {
    const running = await params.start();
    if (params.startingRuns.get(params.child.childSessionId) !== reservation) {
      try {
        (params.close ?? closeSurface)(running.surface);
      } catch {}
      return { kind: "cancelled" };
    }
    params.activeRuns.set(running.id, running);
    release();
    return { kind: "active", running };
  } catch (error) {
    release();
    throw error;
  }
}

function cancelIdleStart(
  startingRuns: Map<string, symbol>,
  lifecycle: ExtensionLifecycle,
  childSessionId: string,
): boolean {
  const reservation = lifecycle.ownedStartReservations.get(childSessionId);
  if (!reservation) return false;
  if (startingRuns.get(childSessionId) === reservation)
    startingRuns.delete(childSessionId);
  lifecycle.ownedStartReservations.delete(childSessionId);
  return true;
}

function buildIdleLaunchProfile(params: {
  child: ChildSession;
  sessionFile: string;
  activityFile: string;
  agentDir: string;
  agentDefs: AgentDefaults | null;
  promptDir: string;
}): PiLaunchProfile {
  const { child, sessionFile, activityFile, agentDir, agentDefs, promptDir } =
    params;
  const parts = [
    "pi",
    "--session",
    shellEscape(child.childSessionId),
    "--session-dir",
    shellEscape(getDefaultSessionDirFor(child.cwd, agentDir)),
    "-e",
    shellEscape(join(SUBAGENTS_DIR, "subagent-done.ts")),
  ];
  const model = resolveModelArgument(
    undefined,
    agentDefs?.model,
    agentDefs?.thinking,
  );
  if (model) parts.push("--model", shellEscape(model));
  if (agentDefs?.body) {
    mkdirSync(promptDir, { recursive: true });
    const rolePrompt = join(promptDir, `${child.childSessionId}-agent.md`);
    writeFileSync(rolePrompt, agentDefs.body, "utf8");
    parts.push(
      ...buildSystemPromptArguments({
        agentBodyPath: rolePrompt,
        agentMode: agentDefs.systemPromptMode,
      }),
    );
  }
  const toolAllowlist = buildSubagentToolAllowlist(agentDefs?.tools);
  if (toolAllowlist) parts.push("--tools", shellEscape(toolAllowlist));
  const environment = [
    `PI_CODING_AGENT_DIR=${shellEscape(agentDir)}`,
    ...buildChildHandoffEnvironment(),
    `PI_SUBAGENT_NAME=${shellEscape(child.name)}`,
    `PI_SUBAGENT_SESSION=${shellEscape(sessionFile)}`,
    `PI_SUBAGENT_ID=${shellEscape(child.childSessionId)}`,
    `PI_SUBAGENT_ACTIVITY_FILE=${shellEscape(activityFile)}`,
    buildChildAutoExitEnvironment(child.autoExit ?? true),
  ];
  environment.push(`PI_SUBAGENT_AGENT=${shellEscape(child.agent ?? "")}`);
  const denySet = resolveDenyTools(agentDefs);
  environment.push(`PI_DENY_TOOLS=${shellEscape([...denySet].join(","))}`);
  return {
    sessionFile,
    activityFile,
    cwdPrefix: `cd ${shellEscape(child.cwd)} && `,
    environment,
    arguments: parts,
    selectedSkills: [],
  };
}

function resolveRunningTarget(
  agents: RunningSubagent[],
  query: string,
): { running: RunningSubagent } | { error: string } {
  const requested = query.trim();
  const exactId = agents.find((running) => running.id === requested);
  if (exactId) return { running: exactId };

  const matches = agents.filter(
    (running) => running.id.startsWith(requested) || running.name === requested,
  );
  if (matches.length === 1) return { running: matches[0] };
  if (matches.length === 0)
    return { error: `No running subagent matches "${requested}".` };

  return {
    error: `Ambiguous subagent "${requested}". Matches: ${matches.map((running) => `${running.name} [${running.id}]`).join(", ")}`,
  };
}

const resolveAttachTarget = resolveRunningTarget;

async function selectHumanCatalogTarget(
  children: ChildSession[],
  select: (title: string, options: string[]) => Promise<string | undefined>,
): Promise<ChildSession | undefined> {
  const orderedChildren = sortChildCatalog(children);
  if (orderedChildren.length === 0) return undefined;
  if (orderedChildren.length === 1) return orderedChildren[0];
  const options = orderedChildren.map(
    (child) =>
      `${child.name} · ${child.agent ?? "unconfigured"} · ${child.childSessionId.slice(0, 8)}`,
  );
  const selected = await select("Select a child session", options);
  return selected ? orderedChildren[options.indexOf(selected)] : undefined;
}

async function selectHumanTarget(
  agents: RunningSubagent[],
  target: string | undefined,
  select: (title: string, options: string[]) => Promise<string | undefined>,
  catalog: ReadonlyMap<string, ChildSession> = childrenBySessionId,
): Promise<{ running: RunningSubagent } | { error: string } | undefined> {
  const typed = target?.trim();
  if (typed) return resolveRunningTarget(agents, typed);
  if (agents.length === 0) return undefined;
  const orderedAgents = sortChildCatalog(
    agents.map((running) => {
      const child = catalog.get(running.id);
      return child
        ? { ...child, startedAt: child.startedAt ?? running.startTime }
        : {
            managerSessionId: "",
            childSessionId: running.id,
            name: running.name,
            cwd: "",
            startedAt: running.startTime,
          };
    }),
  ).map(
    (child) => agents.find((running) => running.id === child.childSessionId)!,
  );
  if (orderedAgents.length === 1) return { running: orderedAgents[0] };
  const choices = orderedAgents.map((running) => ({
    label: `${running.name} · ${running.agent ?? "unconfigured"} · ${running.id.slice(0, 8)}`,
    running,
  }));
  const selected = await select(
    "Select a subagent",
    choices.map((choice) => choice.label),
  );
  if (!selected) return undefined;
  return {
    running: choices.find((choice) => choice.label === selected)!.running,
  };
}

function resolveInterruptTarget(params: {
  id?: string;
  name?: string;
}): { running: RunningSubagent } | { error: string } {
  const requestedId = params.id?.trim();
  if (requestedId) {
    const running = runningSubagents.get(requestedId);
    return running
      ? { running }
      : { error: `No running subagent with id "${requestedId}".` };
  }

  const requestedName = params.name?.trim();
  if (!requestedName) {
    return { error: "Provide a running subagent id or exact display name." };
  }

  const matches = Array.from(runningSubagents.values()).filter(
    (running) => running.name === requestedName,
  );
  if (matches.length === 1) return { running: matches[0] };
  if (matches.length === 0) {
    return { error: `No running subagent named "${requestedName}".` };
  }

  const candidates = matches
    .map((running) => `${running.name} [${running.id}]`)
    .join(", ");
  return {
    error: `Ambiguous subagent name "${requestedName}". Matches: ${candidates}`,
  };
}

function requestSubagentInterrupt(
  running: RunningSubagent,
  sendEscapeKey: (surface: string) => void = sendEscape,
): { ok: true } | { error: string } {
  try {
    sendEscapeKey(running.surface);
    return { ok: true };
  } catch (error: any) {
    const backend = getMuxBackend() ?? "unknown";
    return {
      error:
        `Failed to send Escape to subagent "${running.name}" via ${backend}: ` +
        `${error?.message ?? String(error)}`,
    };
  }
}

function handleSubagentInterrupt(
  params: { id?: string; name?: string },
  sendEscapeKey: (surface: string) => void = sendEscape,
) {
  const resolved = resolveInterruptTarget(params);
  if ("error" in resolved) {
    return {
      content: [{ type: "text" as const, text: resolved.error }],
      details: { error: resolved.error },
    };
  }

  const running = resolved.running;

  const now = Date.now();
  observeRunningSubagent(running, now);

  const interruption = requestSubagentInterrupt(running, sendEscapeKey);
  if ("error" in interruption) {
    return {
      content: [{ type: "text" as const, text: interruption.error }],
      details: {
        error: interruption.error,
        id: running.id,
        name: running.name,
      },
    };
  }

  running.statusState = forceStatusAfterInterrupt(running.statusState, now);
  updateWidget();

  return {
    content: [
      {
        type: "text" as const,
        text: `Interrupt requested for subagent "${running.name}".`,
      },
    ],
    details: {
      id: running.id,
      name: running.name,
      status: "interrupt_requested",
    },
  };
}

function startStatusRefresh(pi: ExtensionAPI) {
  if (!statusConfig.enabled || statusInterval) return;

  statusInterval = setInterval(() => {
    if (runningSubagents.size === 0) {
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
        (globalThis as any)[STATUS_INTERVAL_KEY] = null;
      }
      return;
    }

    const transitionLines: string[] = [];
    const now = Date.now();
    let shouldRefreshWidget = false;

    for (const running of runningSubagents.values()) {
      observeRunningSubagent(running, now);
      const { nextState, snapshot, transition } = advanceStatusState(
        running.statusState,
        now,
      );
      if (nextState.currentKind !== running.statusState.currentKind) {
        shouldRefreshWidget = true;
      }
      running.statusState = nextState;

      if (transition) {
        transitionLines.push(
          formatTransitionLine(running.name, snapshot, transition),
        );
      }
    }

    if (shouldRefreshWidget) updateWidget();

    if (transitionLines.length > 0) {
      const capped = capStatusLines(transitionLines, statusConfig.lineLimit);
      pi.sendMessage(
        {
          customType: "subagent_status",
          content: formatStatusAggregate(
            transitionLines,
            statusConfig.lineLimit,
          ),
          display: true,
          details: { lines: capped.visibleLines, overflow: capped.overflow },
        },
        { triggerTurn: true, deliverAs: "steer" },
      );
    }
  }, 1000);

  (globalThis as any)[STATUS_INTERVAL_KEY] = statusInterval;
}

export const __test__ = {
  borderLine,
  getShellReadyDelayMs,
  renderSubagentWidgetLines,
  sortChildCatalog,
  loadAgentDefaults,
  discoverAgentDefinitions,
  resolveEffectiveSessionMode,
  resolveLaunchBehavior,
  resolveAutoExit,
  buildSubagentToolAllowlist,
  buildPiPromptArgs,
  buildPiLaunchCommand,
  buildChildHandoffEnvironment,
  buildChildAutoExitEnvironment,
  resolveModelArgument,
  buildSystemPromptArguments,
  buildInitialTask,
  formatLocalStartTime,
  formatLocalCatalogStartTime,
  formatSubagentTaskCall,
  formatSubagentSteerCall,
  formatWidgetRightLabel,
  formatWidgetStatusMarker,
  observeRunningSubagent,
  refreshDisplaySnapshot,
  resolveDenyTools,
  resolveAttachTarget,
  resolveCatalogTarget,
  findChildSessionFile,
  resolveSteerDecision,
  startIdleChild,
  cancelIdleStart,
  buildIdleLaunchProfile,
  resolveRunningTarget,
  selectHumanCatalogTarget,
  selectHumanTarget,
  resolveInterruptTarget,
  requestSubagentInterrupt,
  handleSubagentInterrupt,
  resolveResultPresentation,
  shouldDeliverWatcherNotification,
  cleanupFailedWatcherRun,
  createWatcherOwner,
  createExtensionLifecycle,
  createLifecycleSurface,
  releaseTmuxHiddenOwnerIfIdle,
  tmuxHiddenSessionName,
  registerLaunchedDelivery,
  runLaunchLifecycle,
  formatLaunchFailure,
  removeActiveRun,
  stopActiveRun,
  shutdownLifecycle,
  completeWakeTransition,
  createDelegatorLivenessCoordinator,
  delegatorLiveness,
  CHILD_SESSION_CUSTOM_TYPE,
  validateChildSession,
  replayChildCatalog,
  migrateLegacySnapshots,
  migrateHistoricalToolResults,
  nativeSessionId,
  childrenBySessionId,
  runningSubagents,
  startingSubagents,
  drainPersistentStatuses,
  formatElapsed,
};

function startWidgetRefresh() {
  if (widgetInterval) return;
  updateWidget(); // immediate first render
  widgetInterval = setInterval(() => {
    updateWidget();
  }, 1000);
  (globalThis as any)[WIDGET_INTERVAL_KEY] = widgetInterval;
}

/**
 * Launch a subagent: creates the multiplexer pane, builds the command, and
 * sends it. Returns a RunningSubagent — does NOT poll.
 *
 * Call watchSubagent() on the returned object to observe completion.
 */
async function launchSubagent(
  params: Static<typeof SubagentParams>,
  ctx: {
    sessionManager: {
      getSessionFile(): string | null | undefined;
      getSessionId(): string;
      getSessionDir(): string;
    };
    cwd: string;
  },
  options?: {
    surface?: string;
    registerChild?: (child: ChildSession) => void;
    lifecycle?: ExtensionLifecycle;
  },
): Promise<RunningSubagent> {
  const startTime = Date.now();
  // This is the only manager-facing identity. Never manufacture a runtime ID.
  const id = randomUUID();
  const autoExit = resolveAutoExit(params);

  const agentDefs = params.agent ? loadAgentDefaults(params.agent) : null;
  const effectiveModel = resolveModelArgument(
    params.model,
    agentDefs?.model,
    agentDefs?.thinking,
  );
  const effectiveTools = params.tools ?? agentDefs?.tools;
  const effectiveSkills = (params.skills ?? agentDefs?.skills ?? "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile) throw new Error("No session file");
  const sessionId = ctx.sessionManager.getSessionId();
  const artifactDir = getArtifactDir(
    ctx.sessionManager.getSessionDir(),
    sessionId,
  );

  const { effectiveCwd, effectiveAgentDir } = resolveSubagentPaths(
    params,
    agentDefs,
  );
  const targetCwdForSession = effectiveCwd ?? ctx.cwd;
  const sessionDir = getDefaultSessionDirFor(
    targetCwdForSession,
    effectiveAgentDir,
  );

  // Generate a deterministic session file path for this subagent.
  // This eliminates race conditions when multiple agents launch simultaneously —
  // each agent knows exactly which file is theirs.
  const timestamp =
    new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23) + "Z";
  const subagentSessionFile = join(sessionDir, `${timestamp}_${id}.jsonl`);

  const launchBehavior = resolveLaunchBehavior(params, agentDefs);

  const activityFile = getSubagentActivityFile(artifactDir, id);
  mkdirSync(dirname(activityFile), { recursive: true });
  const fullTask = buildInitialTask(params.task);
  const denySet = resolveDenyTools(agentDefs);
  // ── Pi CLI path ──

  // Build pi command
  const parts: string[] = ["pi"];
  parts.push(
    "--session",
    shellEscape(id),
    "--session-dir",
    shellEscape(sessionDir),
  );

  const subagentDonePath = join(SUBAGENTS_DIR, "subagent-done.ts");
  parts.push("-e", shellEscape(subagentDonePath));

  if (effectiveModel) parts.push("--model", shellEscape(effectiveModel));

  const promptTimestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const promptSafeName =
    params.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "subagent";
  const promptDir = join(artifactDir, "context");
  mkdirSync(promptDir, { recursive: true });
  let agentBodyPath: string | undefined;
  let callerPromptPath: string | undefined;
  if (agentDefs?.body) {
    agentBodyPath = join(
      promptDir,
      `${promptSafeName}-agent-${promptTimestamp}.md`,
    );
    writeFileSync(agentBodyPath, agentDefs.body, "utf8");
  }
  if (params.systemPrompt) {
    callerPromptPath = join(
      promptDir,
      `${promptSafeName}-caller-${promptTimestamp}.md`,
    );
    writeFileSync(callerPromptPath, params.systemPrompt, "utf8");
  }
  parts.push(
    ...buildSystemPromptArguments({
      agentBodyPath,
      agentMode: agentDefs?.systemPromptMode,
      callerPromptPath,
    }),
  );

  const toolAllowlist = buildSubagentToolAllowlist(effectiveTools);
  if (toolAllowlist) {
    parts.push("--tools", shellEscape(toolAllowlist));
  }

  // Build env prefix: denied tools + subagent identity + config dir propagation
  const envParts: string[] = [];

  envParts.push(`PI_CODING_AGENT_DIR=${shellEscape(effectiveAgentDir)}`);
  envParts.push(...buildChildHandoffEnvironment());

  envParts.push(`PI_DENY_TOOLS=${shellEscape([...denySet].join(","))}`);
  envParts.push(`PI_SUBAGENT_NAME=${shellEscape(params.name)}`);
  envParts.push(`PI_SUBAGENT_AGENT=${shellEscape(params.agent ?? "")}`);
  envParts.push(`PI_SUBAGENT_SESSION=${shellEscape(subagentSessionFile)}`);
  envParts.push(`PI_SUBAGENT_ID=${shellEscape(id)}`);
  envParts.push(`PI_SUBAGENT_ACTIVITY_FILE=${shellEscape(activityFile)}`);
  envParts.push(buildChildAutoExitEnvironment(autoExit));

  // Pass task and context files in one initial turn. Requested skills are
  // expanded by subagent-done.ts during that turn's input event.
  // Only full-context fork mode gets a direct task argument because it already
  // inherits the parent conversation. Blank-session modes use artifact-backed
  // handoff so the wrapper instructions arrive as the initial user message.
  let taskArg: string;
  if (launchBehavior.taskDelivery === "direct") {
    taskArg = fullTask;
  } else {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const safeName = params.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // strip everything except alphanumeric, spaces, hyphens
      .replace(/\s+/g, "-") // spaces to hyphens
      .replace(/-+/g, "-") // collapse multiple hyphens
      .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
    const artifactName = `context/${safeName || "subagent"}-${timestamp}.md`;
    const artifactPath = join(artifactDir, artifactName);
    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, fullTask, "utf8");
    taskArg = `@${artifactPath}`;
  }

  const promptArguments = buildPiPromptArgs({
    files: params.files,
    taskArg,
  });

  // Resolve cwd — param overrides agent default, supports absolute and relative paths.
  // This was already computed above so session placement, PI_CODING_AGENT_DIR, and cd agree.
  const cdPrefix = `cd ${shellEscape(targetCwdForSession)} && `;
  const launchProfile = Object.freeze({
    sessionFile: subagentSessionFile,
    activityFile,
    cwdPrefix: cdPrefix,
    environment: Object.freeze([...envParts]),
    arguments: Object.freeze([...parts]),
    selectedSkills: Object.freeze([...effectiveSkills]),
  });
  const launchScriptName = `${
    (params.name || "subagent")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "subagent"
  }-${id}.sh`;
  const launchScriptFile = join(
    artifactDir,
    "subagent-scripts",
    launchScriptName,
  );

  // Materialize and register durable identity before any multiplexer operation.
  // A later pane or dispatch failure leaves this valid child idle in the catalog.
  const surfacePreCreated = !!options?.surface;
  let surface: string;
  try {
    surface = await runLaunchLifecycle({
      seed: () =>
        seedSubagentSessionFile({
          mode: launchBehavior.seededSessionMode ?? "lineage-only",
          parentSessionFile: sessionFile,
          childSessionFile: subagentSessionFile,
          childCwd: targetCwdForSession,
          childSessionId: id,
        }),
      appendRegistration: () =>
        options?.registerChild?.({
          managerSessionId: ctx.sessionManager.getSessionId(),
          childSessionId: id,
          name: params.name,
          ...(params.agent ? { agent: params.agent } : {}),
          cwd: targetCwdForSession,
          autoExit,
          startedAt: startTime,
        }),
      createSurface: () =>
        options?.surface ??
        (options?.lifecycle
          ? createLifecycleSurface(options.lifecycle, params.name, sessionId)
          : createSurface(params.name)),
      dispatch: async (createdSurface) => {
        if (!surfacePreCreated) {
          await new Promise<void>((resolve) =>
            setTimeout(resolve, getShellReadyDelayMs()),
          );
        }
        sendLongCommand(
          createdSurface,
          buildPiLaunchCommand(launchProfile, {
            surface: createdSurface,
            promptArguments,
            originalLaunch: true,
            tmuxHiddenSession: options?.lifecycle?.tmuxHiddenOwner?.sessionName,
          }),
          {
            scriptPath: launchScriptFile,
            scriptPreamble: [
              `# Subagent launch script for ${params.name}`,
              `# Generated: ${new Date().toISOString()}`,
              `# Session: ${subagentSessionFile}`,
              `# Surface: ${createdSurface}`,
            ].join("\n"),
          },
        );
      },
      closeSurface,
    });
  } catch (error) {
    throw error;
  }

  const running: RunningSubagent = {
    id,
    name: params.name,
    task: params.task,
    agent: params.agent,
    displayModel: effectiveModel?.split("/").pop()?.split(":")[0],
    surface,
    tmuxHiddenOwner: options?.lifecycle?.tmuxHiddenOwner,
    startTime,
    sessionFile: subagentSessionFile,
    launchScriptFile,
    activityFile,
    launchProfile,
    statusState: createStatusState({
      source: "pi",
      startTimeMs: startTime,
    }),
    statusEntryCursor: getNewEntries(subagentSessionFile, 0).length,
  };

  runningSubagents.set(id, running);
  return running;
}

/**
 * Watch a launched subagent until it exits. Polls for completion, extracts
 * the summary from the session file, cleans up the surface,
 * and removes the entry from runningSubagents.
 */
async function watchSubagent(
  running: RunningSubagent,
  signal: AbortSignal,
  ownerSignal: AbortSignal,
  onStatus?: (status: { kind: "status" | "error"; report: string }) => void,
): Promise<SubagentResult> {
  const { name, task, surface, startTime, sessionFile } = running;

  try {
    const result = await pollForExit(
      surface,
      AbortSignal.any([signal, ownerSignal]),
      {
        interval: 1000,
        sessionFile,
        onTick() {
          observeRunningSubagent(running);
          if (onStatus) drainPersistentStatuses(running, onStatus);
        },
      },
    );

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (onStatus) drainPersistentStatuses(running, onStatus);

    // Pi subagent result extraction
    let summary: string;
    if (existsSync(sessionFile)) {
      const allEntries = getNewEntries(sessionFile, 0);
      summary =
        findLastAssistantMessage(allEntries) ??
        (result.errorMessage
          ? `Subagent error: ${result.errorMessage}`
          : result.exitCode !== 0
            ? `Sub-agent exited with code ${result.exitCode}`
            : "Sub-agent exited without output");
    } else {
      summary = result.errorMessage
        ? `Subagent error: ${result.errorMessage}`
        : result.exitCode !== 0
          ? `Sub-agent exited with code ${result.exitCode}`
          : "Sub-agent exited without output";
    }

    if (running.deliveryId)
      delegatorLiveness.markPendingDelivery(running.deliveryId);
    removeActiveRun(runningSubagents, running);
    // A completed turn ends only this process. The durable catalog entry remains.

    return {
      name,
      task,
      summary,
      sessionFile,
      reason: result.reason,
      exitCode: result.exitCode,
      elapsed,
      ping: result.ping,
      ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    };
  } catch (err: any) {
    if (running.deliveryId)
      delegatorLiveness.markPendingDelivery(running.deliveryId);
    removeActiveRun(runningSubagents, running);

    if (signal.aborted || ownerSignal.aborted) {
      return {
        name,
        task,
        summary: "Subagent cancelled.",
        exitCode: 1,
        elapsed: Math.floor((Date.now() - startTime) / 1000),
        error: "cancelled",
        sessionFile,
      };
    }
    // A launch-side infrastructure failure removes only transient active state.
    // The durable child registration remains available for inspection.
    return {
      name,
      task,
      summary: `Subagent error: ${err?.message ?? String(err)}`,
      exitCode: 1,
      elapsed: Math.floor((Date.now() - startTime) / 1000),
      error: err?.message ?? String(err),
    };
  }
}

export default function subagentsExtension(
  pi: ExtensionAPI,
  lifecycle: ExtensionLifecycle = createExtensionLifecycle(),
) {
  const { watcherOwner, ownedRuns } = lifecycle;
  let managerSessionId: string | null = null;

  // Capture the UI context and restore only the active manager branch.
  pi.on("session_start", (_event, ctx) => {
    latestCtx = ctx;
    showStoppedChildren = false;
    runningSubagents.clear();
    childrenBySessionId.clear();
    const header = ctx.sessionManager.getHeader();
    const currentSessionId = ctx.sessionManager.getSessionId();
    managerSessionId =
      header?.id === currentSessionId ? currentSessionId : null;
    if (managerSessionId) {
      const branch = ctx.sessionManager.getBranch();
      for (const [id, child] of replayChildCatalog(
        header,
        currentSessionId,
        branch,
      ))
        childrenBySessionId.set(id, child);
      // Compatibility migration deliberately recovers only extant native Pi
      // session headers; old process state is not carried forward.
      for (const child of [
        ...migrateLegacySnapshots(
          header,
          currentSessionId,
          branch,
          childrenBySessionId,
        ),
        ...migrateHistoricalToolResults(
          header,
          currentSessionId,
          branch,
          childrenBySessionId,
        ),
      ]) {
        if (childrenBySessionId.has(child.childSessionId)) continue;
        pi.appendEntry(CHILD_SESSION_CUSTOM_TYPE, { version: 1, ...child });
        childrenBySessionId.set(child.childSessionId, child);
      }
    }
    if (runningSubagents.size > 0) startWidgetRefresh();
    else updateWidget();
  });

  // Clean up on session shutdown
  pi.on("session_shutdown", (_event, _ctx) => {
    managerSessionId = null;
    if (widgetInterval) {
      clearInterval(widgetInterval);
      widgetInterval = null;
      (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
    }
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
      (globalThis as any)[STATUS_INTERVAL_KEY] = null;
    }
    shutdownLifecycle(lifecycle, runningSubagents);
  });

  // Tools denied via PI_DENY_TOOLS env var (set by parent agent based on frontmatter)
  const deniedTools = new Set(
    (process.env.PI_DENY_TOOLS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const shouldRegister = (name: string) => !deniedTools.has(name);

  pi.registerShortcut(STOPPED_CHILDREN_SHORTCUT, {
    description: "Show or hide stopped subagents",
    handler: () => {
      showStoppedChildren = !showStoppedChildren;
      updateWidget();
    },
  });

  const deliverPersistentStatus = (
    running: RunningSubagent,
    status: { kind: "status" | "error"; report: string },
  ) => {
    pi.sendMessage(
      {
        customType: "subagent_status",
        content: `Sub-agent "${running.name}" ${status.kind}:\n\n${status.report}`,
        display: true,
        details: { childSessionId: running.id, ...status },
      },
      { triggerTurn: true, deliverAs: "steer" },
    );
  };

  // ── subagent tool ──
  if (shouldRegister("subagent"))
    pi.registerTool({
      name: "subagent",
      label: "Subagent",
      description:
        "Spawn a sub-agent in a dedicated terminal multiplexer pane. " +
        "This is a fire-and-forget async tool: the call returns immediately with only an acknowledgement. " +
        "When the sub-agent finishes, the harness AUTOMATICALLY delivers its result as a steer message that wakes you up and starts a new turn — you do not need to do anything to receive it. " +
        "DO NOT write polling loops, sleep/wait commands, tail/watch scripts, or repeatedly read session/log files to detect completion. DO NOT call subagents_list or any other tool to 'check' status. All of that is wasted work — the harness handles delivery for you. " +
        "DO NOT fabricate, assume, or summarize results after calling this tool. " +
        "After spawning, either end your turn immediately, or work on other independent tasks (including spawning more subagents in parallel). The harness will wake you with the result when it is ready.",
      promptSnippet:
        "Spawn a sub-agent in a dedicated terminal multiplexer pane. " +
        "This is a fire-and-forget async tool: the call returns immediately with only an acknowledgement. " +
        "When the sub-agent finishes, the harness AUTOMATICALLY delivers its result as a steer message that wakes you up and starts a new turn — you do not need to do anything to receive it. " +
        "DO NOT write polling loops, sleep/wait commands, tail/watch scripts, or repeatedly read session/log files to detect completion. DO NOT call subagents_list or any other tool to 'check' status. All of that is wasted work — the harness handles delivery for you. " +
        "DO NOT fabricate, assume, or summarize results after calling this tool. " +
        "After spawning, either end your turn immediately, or work on other independent tasks (including spawning more subagents in parallel). The harness will wake you with the result when it is ready.",
      parameters: SubagentParams,

      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        // Prevent self-spawning (e.g. planner spawning another planner)
        const currentAgent = process.env.PI_SUBAGENT_AGENT;
        if (params.agent && currentAgent && params.agent === currentAgent) {
          return {
            content: [
              {
                type: "text",
                text: `You are the ${currentAgent} agent — do not start another ${currentAgent}. You were spawned to do this work yourself. Complete the task directly.`,
              },
            ],
            details: { error: "self-spawn blocked" },
          };
        }

        // Validate prerequisites
        if (!isMuxAvailable()) {
          return muxUnavailableResult();
        }

        if (!ctx.sessionManager.getSessionFile()) {
          return {
            content: [
              {
                type: "text",
                text: "Error: no session file. Start pi with a persistent session to use subagents.",
              },
            ],
            details: { error: "no session file" },
          };
        }

        // Launch the subagent (creates pane, sends command)
        const running = await launchSubagent(params, ctx, {
          lifecycle,
          registerChild(child) {
            if (!managerSessionId)
              throw new Error("manager session identity is unavailable");
            if (childrenBySessionId.has(child.childSessionId)) return;
            pi.appendEntry(CHILD_SESSION_CUSTOM_TYPE, { version: 1, ...child });
            childrenBySessionId.set(child.childSessionId, child);
          },
        });
        registerLaunchedDelivery(running, lifecycle);

        // Create a separate AbortController for the watcher
        // (the tool's signal completes when we return)
        const watcherAbort = new AbortController();
        running.abortController = watcherAbort;
        ownedRuns.add(running);

        // Start widget refresh and status supervision when the first agent launches
        startWidgetRefresh();
        startStatusRefresh(pi);

        // Fire-and-forget: start watching in background
        watchSubagent(
          running,
          watcherAbort.signal,
          watcherOwner.signal,
          (status) => deliverPersistentStatus(running, status),
        )
          .then((result) => {
            ownedRuns.delete(running);
            releaseTmuxHiddenOwnerIfIdle(lifecycle);
            if (!shouldDeliverWatcherNotification(running)) {
              updateWidget();
              return;
            }
            completeWakeTransition({
              deliveryId: running.deliveryId,
              update: updateWidget,
              wake(warning) {
                if (result.ping) {
                  const sessionRef = `\n\nSession: ${result.sessionFile}\nResume: pi --session ${result.sessionFile}`;
                  pi.sendMessage(
                    {
                      customType: "subagent_ping",
                      content: appendPersistenceWarning(
                        `Sub-agent "${result.ping.name}" needs help (${formatElapsed(result.elapsed)}):\n\n${result.ping.message}${sessionRef}`,
                        warning,
                      ),
                      display: true,
                      details: {
                        name: result.ping.name,
                        message: result.ping.message,
                        agent: running.agent,
                        sessionFile: result.sessionFile,
                        deliveryId: running.deliveryId,
                      },
                    },
                    { triggerTurn: true, deliverAs: "steer" },
                  );
                  return;
                }

                const presentation = resolveResultPresentation(
                  result,
                  running.name,
                );
                pi.sendMessage(
                  {
                    customType: "subagent_result",
                    content: appendPersistenceWarning(presentation, warning),
                    display: true,
                    details: {
                      name: running.name,
                      task: running.task,
                      agent: running.agent,
                      exitCode: result.exitCode,
                      elapsed: result.elapsed,
                      sessionFile: result.sessionFile,
                      deliveryId: running.deliveryId,
                      ...(result.errorMessage
                        ? { errorMessage: result.errorMessage }
                        : {}),
                    },
                  },
                  { triggerTurn: true, deliverAs: "steer" },
                );
              },
            });
          })
          .catch((err) => {
            if (!shouldDeliverWatcherNotification(running)) {
              updateWidget();
              return;
            }
            completeWakeTransition({
              deliveryId: running.deliveryId,
              update: updateWidget,
              wake() {
                pi.sendMessage(
                  {
                    customType: "subagent_result",
                    content: `Sub-agent "${running.name}" error: ${err?.message ?? String(err)}`,
                    display: true,
                    details: {
                      name: running.name,
                      task: running.task,
                      error: err?.message,
                      deliveryId: running.deliveryId,
                    },
                  },
                  { triggerTurn: true, deliverAs: "steer" },
                );
              },
            });
          });

        // Return immediately
        return {
          content: [
            {
              type: "text",
              text:
                `Sub-agent "${params.name}" launched and is now running in the background. ` +
                `Do NOT generate or assume any results — you have no idea what the sub-agent will do or produce. ` +
                `The results will be delivered to you automatically as a steer message when the sub-agent finishes. ` +
                `Until then, move on to other work or tell the user you're waiting.`,
            },
          ],
          details: {
            id: running.id,
            name: params.name,
            task: params.task,
            agent: params.agent,
            sessionFile: running.sessionFile,
            launchScriptFile: running.launchScriptFile,
            status: "started",
          },
        };
      },

      renderCall(args, theme, context) {
        const partialArgs = args as Record<string, unknown>;
        const name =
          typeof partialArgs.name === "string" && partialArgs.name
            ? partialArgs.name
            : "(unnamed)";
        const task =
          typeof partialArgs.task === "string" ? partialArgs.task : "";
        const agent =
          typeof partialArgs.agent === "string" && partialArgs.agent
            ? theme.fg("dim", ` (${partialArgs.agent})`)
            : "";
        const cwdHint =
          typeof partialArgs.cwd === "string" && partialArgs.cwd
            ? theme.fg("dim", ` in ${partialArgs.cwd}`)
            : "";
        let text =
          "▸ " + theme.fg("toolTitle", theme.bold(name)) + agent + cwdHint;

        if (task) {
          const taskCall = formatSubagentTaskCall(task, context.expanded);
          if (taskCall.body) {
            text += "\n" + theme.fg("toolOutput", taskCall.body);
          }
          if (!context.expanded && taskCall.lineCount > 1) {
            text += theme.fg("muted", ` (${taskCall.lineCount} lines)`);
          }
          if (taskCall.expandable) {
            text += theme.fg("muted", " (Ctrl+O to expand)");
          }
        }

        return new Text(text, 0, 0);
      },

      renderResult(result, _opts, theme) {
        const details = result.details as any;
        const name = details?.name ?? "(unnamed)";

        // "Started" result — tool returned immediately
        if (details?.status === "started") {
          return new Text(
            theme.fg("accent", "▸") +
              " " +
              theme.fg("toolTitle", theme.bold(name)) +
              theme.fg("dim", " — started"),
            0,
            0,
          );
        }

        // Fallback (shouldn't happen)
        const content = result.content[0];
        const text = content?.type === "text" ? content.text : "";
        return new Text(theme.fg("dim", text), 0, 0);
      },
    });

  const resolveControlTarget = (target: string) =>
    resolveCatalogTarget(Array.from(childrenBySessionId.values()), target);

  const deliverControlledRun = (
    running: RunningSubagent,
    watcherAbort: AbortController,
  ) => {
    watchSubagent(running, watcherAbort.signal, watcherOwner.signal, (status) =>
      deliverPersistentStatus(running, status),
    )
      .then((result) => {
        ownedRuns.delete(running);
        releaseTmuxHiddenOwnerIfIdle(lifecycle);
        if (!shouldDeliverWatcherNotification(running)) {
          updateWidget();
          return;
        }
        completeWakeTransition({
          deliveryId: running.deliveryId,
          update: updateWidget,
          wake(warning) {
            const content = result.ping
              ? `Sub-agent "${result.ping.name}" needs help (${formatElapsed(result.elapsed)}):\n\n${result.ping.message}\n\nSession: ${running.sessionFile}`
              : resolveResultPresentation(result, running.name);
            pi.sendMessage(
              {
                customType: result.ping ? "subagent_ping" : "subagent_result",
                content: appendPersistenceWarning(content, warning),
                display: true,
                details: {
                  name: running.name,
                  sessionFile: running.sessionFile,
                  reason: result.reason,
                  deliveryId: running.deliveryId,
                },
              },
              { triggerTurn: true, deliverAs: "steer" },
            );
          },
        });
      })
      .catch((error) => {
        if (!shouldDeliverWatcherNotification(running)) return;
        completeWakeTransition({
          deliveryId: running.deliveryId,
          update: updateWidget,
          wake() {
            pi.sendMessage(
              {
                customType: "subagent_result",
                content: `Sub-agent "${running.name}" error: ${error instanceof Error ? error.message : String(error)}`,
                display: true,
                details: { deliveryId: running.deliveryId },
              },
              { triggerTurn: true, deliverAs: "steer" },
            );
          },
        });
      });
  };

  const steer = async (
    target: string,
    message: string,
    ctx: ExtensionContext,
  ) => {
    try {
      validatePrompt(message);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
    const resolved = resolveControlTarget(target);
    if ("error" in resolved) return resolved;
    const child = resolved.child;
    const decision = resolveSteerDecision(
      runningSubagents,
      startingSubagents,
      child,
    );
    if (decision.kind === "active") {
      try {
        sendPrompt(decision.running.surface, message);
        return { running: decision.running };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    if (decision.kind === "starting") {
      return {
        error: `Subagent "${child.name}" is already starting; the new message was not sent. Retry after it becomes active.`,
      };
    }

    try {
      const result = await startIdleChild({
        activeRuns: runningSubagents,
        startingRuns: startingSubagents,
        lifecycle,
        child,
        async start() {
          const sessionFile = findChildSessionFile(child);
          if (!sessionFile)
            throw new Error(
              `Child session "${child.name}" is unavailable: native session ${child.childSessionId} was not found.`,
            );
          const agentDefs = child.agent ? loadAgentDefaults(child.agent) : null;
          if (child.agent && !agentDefs)
            throw new Error(
              `Child session "${child.name}" requires named agent "${child.agent}", which no longer exists.`,
            );
          const agentDir = existsSync(join(child.cwd, ".pi", "agent"))
            ? join(child.cwd, ".pi", "agent")
            : getAgentConfigDir();
          const activityFile = getSubagentActivityFile(
            getArtifactDir(
              ctx.sessionManager.getSessionDir(),
              ctx.sessionManager.getSessionId(),
            ),
            child.childSessionId,
          );
          mkdirSync(dirname(activityFile), { recursive: true });
          let surface: string | undefined;
          try {
            surface = createLifecycleSurface(
              lifecycle,
              child.name,
              ctx.sessionManager.getSessionId(),
            );
            await new Promise<void>((resolve) =>
              setTimeout(resolve, getShellReadyDelayMs()),
            );
            const promptDir = join(
              getArtifactDir(
                ctx.sessionManager.getSessionDir(),
                ctx.sessionManager.getSessionId(),
              ),
              "context",
            );
            const profile = buildIdleLaunchProfile({
              child,
              sessionFile,
              activityFile,
              agentDir,
              agentDefs,
              promptDir,
            });
            sendLongCommand(
              surface,
              buildPiLaunchCommand(profile, {
                surface,
                promptArguments: [message],
                originalLaunch: false,
                tmuxHiddenSession: lifecycle.tmuxHiddenOwner?.sessionName,
              }),
            );
            const startTime = Date.now();
            const watcherAbort = new AbortController();
            return {
              id: child.childSessionId,
              name: child.name,
              task: message,
              ...(child.agent ? { agent: child.agent } : {}),
              displayModel: resolveModelArgument(
                undefined,
                agentDefs?.model,
                agentDefs?.thinking,
              )
                ?.split("/")
                .pop()
                ?.split(":")[0],
              surface,
              tmuxHiddenOwner: lifecycle.tmuxHiddenOwner,
              startTime,
              sessionFile,
              activityFile,
              launchProfile: profile,
              abortController: watcherAbort,
              statusState: createStatusState({
                source: "pi",
                startTimeMs: startTime,
              }),
              statusEntryCursor: getNewEntries(sessionFile, 0).length,
            };
          } catch (error) {
            if (surface)
              try {
                closeSurface(surface);
              } catch {}
            throw error;
          }
        },
      });
      if (result.kind === "starting")
        return {
          error: `Subagent "${child.name}" is already starting; the new message was not sent. Retry after it becomes active.`,
        };
      if (result.kind === "cancelled")
        return { error: `Subagent "${child.name}" start was cancelled.` };
      const running = result.running;
      const watcherAbort = running.abortController!;
      registerLaunchedDelivery(running, lifecycle);
      ownedRuns.add(running);
      deliverControlledRun(running, watcherAbort);
      startWidgetRefresh();
      startStatusRefresh(pi);
      updateWidget();
      return { running };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  };

  if (shouldRegister("subagent_steer"))
    pi.registerTool({
      name: "subagent_steer",
      label: "Steer Subagent",
      description: "Send one message to an active or idle child session.",
      parameters: Type.Object({
        target: Type.String(),
        message: Type.String(),
      }),
      async execute(_id, params, _signal, _update, ctx) {
        const result = await steer(params.target, params.message, ctx);
        const text =
          "error" in result
            ? result.error
            : `Steered subagent "${result.running.name}".`;
        return {
          content: [{ type: "text", text }],
          details:
            "error" in result
              ? { target: params.target, status: "error", error: result.error }
              : {
                  id: result.running.id,
                  target: params.target,
                  name: result.running.name,
                  status: "steered",
                },
        };
      },
      renderCall(args, theme, context) {
        const call = formatSubagentSteerCall(
          typeof args.target === "string" ? args.target : "",
          typeof args.message === "string" ? args.message : "",
          context.expanded,
        );
        let text =
          "▸ " +
          theme.fg("toolTitle", theme.bold(call.target)) +
          theme.fg("dim", " — steer");
        if (call.body) text += "\n" + theme.fg("toolOutput", call.body);
        if (!context.expanded && call.lineCount > 1)
          text += theme.fg("muted", ` (${call.lineCount} lines)`);
        if (call.expandable) text += theme.fg("muted", " (Ctrl+O to expand)");
        return new Text(text, 0, 0);
      },
      renderResult(result, _opts, theme) {
        const details = result.details as {
          target?: string;
          name?: string;
          status?: string;
          error?: string;
        };
        const target = details?.name ?? details?.target ?? "subagent";
        const failed = details?.status === "error";
        return new Text(
          theme.fg("accent", "▸") +
            " " +
            theme.fg("toolTitle", theme.bold(target)) +
            theme.fg("dim", failed ? " — steer failed" : " — steered"),
          0,
          0,
        );
      },
    });

  if (shouldRegister("subagent_peek"))
    pi.registerTool({
      name: "subagent_peek",
      label: "Peek Subagent",
      description:
        "Show active-context messages and exact persisted usage for a tracked subagent.",
      parameters: Type.Object({ target: Type.String() }),
      async execute(_id, params, _signal, _update, ctx) {
        const resolved = resolveControlTarget(params.target);
        if ("error" in resolved)
          return {
            content: [{ type: "text", text: resolved.error }],
            details: { error: resolved.error, id: "" },
          };
        const child = resolved.child;
        const running = runningSubagents.get(child.childSessionId);
        const sessionFile = running?.sessionFile ?? findChildSessionFile(child);
        if (!sessionFile) {
          const text = `Child session "${child.name}" is unavailable: native session ${child.childSessionId} was not found.`;
          return {
            content: [{ type: "text" as const, text }],
            details: { error: text, id: child.childSessionId },
          };
        }
        try {
          const peek = inspectSession(sessionFile);
          const model =
            peek.provider && peek.model
              ? `${peek.provider}/${peek.model}`
              : "unknown";
          const registryModel =
            peek.provider && peek.model
              ? ctx.modelRegistry.find(peek.provider, peek.model)
              : undefined;
          const usage =
            peek.totalTokens && registryModel?.contextWindow
              ? `${peek.totalTokens}/${registryModel.contextWindow} tokens (${((peek.totalTokens / registryModel.contextWindow) * 100).toFixed(1)}%, exact)`
              : "unknown";
          const tail = peek.messages.length
            ? peek.messages
                .map((message) => `${message.role}: ${message.text}`)
                .join("\n\n")
            : "(no active-context messages)";
          const text = `${child.name} [${child.childSessionId}]\nState: ${running ? "active" : "idle"}\nModel: ${model}\nSession: ${sessionFile}\nContext usage: ${usage}\n\n${tail}`;
          return {
            content: [{ type: "text", text }],
            details: { error: "", id: child.childSessionId },
          };
        } catch (error) {
          const text = `Could not peek subagent: ${error instanceof Error ? error.message : String(error)}`;
          return {
            content: [{ type: "text", text }],
            details: { error: text, id: "" },
          };
        }
      },
    });

  if (shouldRegister("subagent_stop"))
    pi.registerTool({
      name: "subagent_stop",
      label: "Stop Subagent",
      description:
        "Stop only an active subagent process without waking the manager. The durable child session is retained.",
      parameters: Type.Object({ target: Type.String() }),
      async execute(_id, params) {
        const resolved = resolveControlTarget(params.target);
        if ("error" in resolved)
          return {
            content: [{ type: "text", text: resolved.error }],
            details: { error: resolved.error, id: "" },
          };
        const child = resolved.child;
        const running = runningSubagents.get(child.childSessionId);
        if (!running) {
          const starting = cancelIdleStart(
            startingSubagents,
            lifecycle,
            child.childSessionId,
          );
          return {
            content: [
              {
                type: "text" as const,
                text: starting
                  ? `Stopped starting subagent "${child.name}"; history was retained.`
                  : `Subagent "${child.name}" is already idle; history was retained.`,
              },
            ],
            details: { error: "", id: child.childSessionId },
          };
        }
        stopActiveRun(runningSubagents, running);
        updateWidget();
        return {
          content: [
            {
              type: "text" as const,
              text: `Stopped active subagent "${child.name}"; history was retained.`,
            },
          ],
          details: { error: "", id: child.childSessionId },
        };
      },
    });

  // ── subagent_interrupt tool ──
  if (shouldRegister("subagent_interrupt"))
    pi.registerTool({
      name: "subagent_interrupt",
      label: "Interrupt Subagent",
      description:
        "Send Escape to the active turn of a currently running Pi-backed subagent. " +
        "The child pane, session, watcher, and running entry remain alive; this returns only a local acknowledgement " +
        "and does not emit a subagent_result solely because of this request.",
      promptSnippet:
        "Send Escape to the active turn of a currently running Pi-backed subagent. " +
        "The child pane, session, watcher, and running entry remain alive; this returns only a local acknowledgement " +
        "and does not emit a subagent_result solely because of this request.",
      parameters: Type.Object({
        id: Type.Optional(
          Type.String({ description: "Exact running subagent id" }),
        ),
        name: Type.Optional(
          Type.String({ description: "Exact running subagent display name" }),
        ),
      }),

      async execute(_toolCallId, params) {
        const result = handleSubagentInterrupt(params);
        return {
          content: result.content,
          details: result.details as Record<string, string | undefined>,
        };
      },

      renderCall(args, theme) {
        const target = args.id ? `${args.id}` : (args.name ?? "(unknown)");
        return new Text(
          theme.fg("accent", "▸") +
            " " +
            theme.fg("toolTitle", theme.bold(target)) +
            theme.fg("dim", " — interrupt turn"),
          0,
          0,
        );
      },

      renderResult(result, _opts, theme) {
        const details = result.details as any;
        if (details?.status === "interrupt_requested") {
          return new Text(
            theme.fg("accent", "▸") +
              " " +
              theme.fg(
                "toolTitle",
                theme.bold(details.name ?? details.id ?? "subagent"),
              ) +
              theme.fg("dim", " — interrupt requested"),
            0,
            0,
          );
        }

        const content = result.content[0];
        const text = content?.type === "text" ? content.text : "";
        return new Text(theme.fg("dim", text), 0, 0);
      },
    });

  // ── subagents_list tool ──
  if (shouldRegister("subagents_list"))
    pi.registerTool({
      name: "subagents_list",
      label: "List Subagents",
      description:
        "List every durable child session owned by this manager branch.",
      promptSnippet:
        "List every durable child session owned by this manager branch.",
      parameters: Type.Object({}),

      async execute() {
        const children = sortChildCatalog(childrenBySessionId.values()).map(
          (child) => ({
            ...child,
            status: runningSubagents.has(child.childSessionId)
              ? "active"
              : findChildSessionFile(child)
                ? "idle"
                : "unavailable",
          }),
        );
        if (children.length === 0)
          return {
            content: [{ type: "text", text: "No child sessions registered." }],
            details: { agents: [] },
          };
        return {
          content: [
            {
              type: "text",
              text: children
                .map(
                  (child) =>
                    `• ${child.childSessionId} — ${child.name} (${child.status})`,
                )
                .join("\n"),
            },
          ],
          details: { agents: children },
        };
      },

      renderResult(result, _opts, theme) {
        const details = result.details as any;
        const agents = details?.agents ?? [];
        if (agents.length === 0) {
          return new Text(
            theme.fg("dim", "No child sessions registered."),
            0,
            0,
          );
        }
        const lines = agents.map(
          (a: any) =>
            `  ${theme.fg("toolTitle", theme.bold(a.name))} ${theme.fg("dim", `[${a.childSessionId}] · ${a.status}`)}`,
        );
        return new Text(lines.join("\n"), 0, 0);
      },
    });

  pi.registerCommand("steer", {
    description:
      "Steer an active or idle child session: /steer [target] [message]",
    handler: async (args, ctx) => {
      const [typedTarget = "", ...words] = args.trim().split(/\s+/);
      if (typedTarget) {
        const result = await steer(
          typedTarget,
          words.join(" ") ||
            ((await ctx.ui.input(
              "Steer message",
              "Message for the subagent",
            )) ??
              ""),
          ctx,
        );
        ctx.ui.notify(
          "error" in result
            ? result.error
            : `Steered subagent "${result.running.name}".`,
          "error" in result ? "error" : "info",
        );
        return;
      }
      const selected = await selectHumanCatalogTarget(
        Array.from(childrenBySessionId.values()),
        (title, options) => ctx.ui.select(title, options),
      );
      if (!selected) {
        if (childrenBySessionId.size === 0)
          ctx.ui.notify("No child sessions are registered.", "info");
        return;
      }
      let message = words.join(" ");
      if (!message)
        message =
          (await ctx.ui.input("Steer message", "Message for the subagent")) ??
          "";
      const result = await steer(selected.childSessionId, message, ctx);
      ctx.ui.notify(
        "error" in result
          ? result.error
          : `Steered subagent "${result.running.name}".`,
        "error" in result ? "error" : "info",
      );
    },
  });

  pi.registerCommand("stop", {
    description:
      "Stop an active subagent process while retaining its history: /stop [target]",
    handler: async (args, ctx) => {
      if (args.trim()) {
        const resolved = resolveCatalogTarget(
          Array.from(childrenBySessionId.values()),
          args,
        );
        if ("error" in resolved) {
          ctx.ui.notify(resolved.error, "error");
          return;
        }
        const active = runningSubagents.get(resolved.child.childSessionId);
        if (!active) {
          const starting = cancelIdleStart(
            startingSubagents,
            lifecycle,
            resolved.child.childSessionId,
          );
          ctx.ui.notify(
            starting
              ? `Stopped starting subagent "${resolved.child.name}"; history was retained.`
              : `Subagent "${resolved.child.name}" is already idle; history was retained.`,
            "info",
          );
          return;
        }
        stopActiveRun(runningSubagents, active);
        updateWidget();
        ctx.ui.notify(
          `Stopped active subagent "${active.name}"; history was retained.`,
          "info",
        );
        return;
      }
      const selected = await selectHumanTarget(
        Array.from(runningSubagents.values()),
        args,
        (title, options) => ctx.ui.select(title, options),
      );
      if (!selected) {
        if (runningSubagents.size === 0)
          ctx.ui.notify("No subagents are running.", "info");
        return;
      }
      if ("error" in selected) {
        ctx.ui.notify(selected.error, "error");
        return;
      }
      const running = selected.running;
      stopActiveRun(runningSubagents, running);
      updateWidget();
      ctx.ui.notify(
        `Stopped active subagent "${running.name}"; history was retained.`,
        "info",
      );
    },
  });

  pi.registerCommand("attach", {
    description: "Attach a running tmux subagent: /attach [id-prefix-or-name]",
    handler: async (args, ctx) => {
      const managerPane = process.env.TMUX_PANE;
      if (getMuxBackend() !== "tmux" || !managerPane) {
        ctx.ui.notify("/attach requires tmux.", "error");
        return;
      }
      const catalogTarget = args.trim()
        ? resolveCatalogTarget(Array.from(childrenBySessionId.values()), args)
        : undefined;
      if (catalogTarget && "error" in catalogTarget) {
        ctx.ui.notify(catalogTarget.error, "error");
        return;
      }
      if (
        catalogTarget &&
        !runningSubagents.has(catalogTarget.child.childSessionId)
      ) {
        ctx.ui.notify(
          `Subagent "${catalogTarget.child.name}" is idle. Steer it first: /steer ${catalogTarget.child.childSessionId} <message>.`,
          "info",
        );
        return;
      }
      const selected = await selectHumanTarget(
        Array.from(runningSubagents.values()),
        args,
        (title, options) => ctx.ui.select(title, options),
      );
      if (!selected) {
        if (runningSubagents.size === 0)
          ctx.ui.notify("No subagents are running.", "info");
        return;
      }
      if ("error" in selected) {
        ctx.ui.notify(selected.error, "error");
        return;
      }
      const running = selected.running;
      try {
        const result = attachTmuxPane(running.surface, managerPane);
        ctx.ui.notify(
          `${result === "moved" ? "Attached" : "Focused"} subagent "${running.name}".`,
          "info",
        );
      } catch (error) {
        ctx.ui.notify(
          `Could not attach subagent: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    },
  });

  pi.registerCommand("detach", {
    description: "Detach this tmux subagent into its hidden owner session",
    handler: async (_args, ctx) => {
      const id = process.env.PI_SUBAGENT_ID;
      const surface = process.env.PI_SUBAGENT_SURFACE;
      const hiddenSession = process.env.PI_SUBAGENT_TMUX_HIDDEN_SESSION;
      if (!id || !surface) {
        ctx.ui.notify(
          "/detach is available only inside a subagent session.",
          "error",
        );
        return;
      }
      if (getMuxBackend() !== "tmux") {
        ctx.ui.notify("/detach requires tmux.", "error");
        return;
      }
      if (!hiddenSession) {
        ctx.ui.notify("/detach requires a hidden tmux owner session.", "error");
        return;
      }
      if (process.env.TMUX_PANE !== surface) {
        ctx.ui.notify(
          `Refusing to detach: current pane ${process.env.TMUX_PANE ?? "(unknown)"} does not match subagent pane ${surface}.`,
          "error",
        );
        return;
      }
      try {
        detachTmuxPane(
          surface,
          { sessionName: hiddenSession, keeperPaneId: "" },
          process.env.PI_SUBAGENT_NAME || id,
        );
        ctx.ui.notify(
          `Detached subagent ${id} into hidden tmux session ${hiddenSession}.`,
          "info",
        );
      } catch (error) {
        ctx.ui.notify(
          `Could not detach subagent: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    },
  });

  // /iterate command — fork the session into a subagent
  pi.registerCommand("iterate", {
    description:
      "Fork session into a subagent for focused work (bugfixes, iteration)",
    handler: async (args, _ctx) => {
      const task = args.trim() || "";
      const toolCall = task
        ? `Use subagent to fork a session. fork: true, name: "Iterate", task: ${JSON.stringify(task)}`
        : `Use subagent to fork a session. fork: true, name: "Iterate", task: "The user wants to do some hands-on work. Help them with whatever they need."`;
      pi.sendUserMessage(toolCall);
    },
  });

  // /subagent command — spawn a subagent by name
  pi.registerCommand("subagent", {
    description: "Spawn a subagent: /subagent <agent> <task>",
    handler: async (args, ctx) => {
      const trimmed = args.trim();
      if (!trimmed) {
        ctx.ui.notify("Usage: /subagent <agent> [task]", "warning");
        return;
      }

      const spaceIdx = trimmed.indexOf(" ");
      const agentName = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
      const task = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

      const defs = loadAgentDefaults(agentName);
      if (!defs) {
        ctx.ui.notify(
          `Agent "${agentName}" not found in ~/.pi/agent/agents/ or .pi/agents/`,
          "error",
        );
        return;
      }

      const taskText =
        task || `You are the ${agentName} agent. Wait for instructions.`;
      const displayName = agentName[0].toUpperCase() + agentName.slice(1);
      const toolCall = `Use subagent with agent: "${agentName}", name: "${displayName}", task: ${JSON.stringify(taskText)}`;
      pi.sendUserMessage(toolCall);
    },
  });

  // ── subagent_result message renderer ──
  pi.registerMessageRenderer("subagent_result", (message, options, theme) => {
    const details = message.details as any;
    if (!details) return undefined;

    return {
      invalidate() {},
      render(width: number): string[] {
        const name = details.name ?? "subagent";
        const exitCode = details.exitCode ?? 0;
        const errorMessage =
          typeof details.errorMessage === "string" ? details.errorMessage : "";
        const failed = exitCode !== 0 || !!errorMessage;
        const elapsed =
          details.elapsed != null ? formatElapsed(details.elapsed) : "?";
        const bgFn = failed
          ? (text: string) => theme.bg("toolErrorBg", text)
          : (text: string) => theme.bg("toolSuccessBg", text);
        const icon = failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
        const status = errorMessage
          ? "failed (provider/agent error)"
          : failed
            ? `failed (exit ${exitCode})`
            : "completed";
        const agentTag = details.agent
          ? theme.fg("dim", ` (${details.agent})`)
          : "";

        const header = `${icon} ${theme.fg("toolTitle", theme.bold(name))}${agentTag} ${theme.fg("dim", "—")} ${status} ${theme.fg("dim", `(${elapsed})`)}`;
        const rawContent =
          typeof message.content === "string" ? message.content : "";

        // Clean summary (remove session ref and leading label for display)
        const summary = rawContent
          .replace(/\n\nSession: .+\nResume: .+$/, "")
          .replace(`Sub-agent "${name}" completed (${elapsed}).\n\n`, "")
          .replace(
            `Sub-agent "${name}" failed (exit code ${exitCode}).\n\n`,
            "",
          )
          .replace(
            new RegExp(
              `^Sub-agent "${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" failed after ${elapsed} \\(provider/agent error — auto-retry exhausted\\)\\.\\n\\n`,
            ),
            "",
          );

        // Build content for the box
        const contentLines = [header];

        if (options.expanded) {
          // Full view: complete summary + session info
          if (summary) {
            for (const line of summary.split("\n")) {
              contentLines.push(line.slice(0, width - 6));
            }
          }
          if (details.sessionFile) {
            contentLines.push("");
            contentLines.push(
              theme.fg("dim", `Session: ${details.sessionFile}`),
            );
            contentLines.push(
              theme.fg("dim", `Resume:  pi --session ${details.sessionFile}`),
            );
          }
        } else {
          // Collapsed: preview + expand hint
          if (summary) {
            const previewLines = summary.split("\n").slice(0, 5);
            for (const line of previewLines) {
              contentLines.push(theme.fg("dim", line.slice(0, width - 6)));
            }
            const totalLines = summary.split("\n").length;
            if (totalLines > 5) {
              contentLines.push(
                theme.fg("muted", `… ${totalLines - 5} more lines`),
              );
            }
          }
          contentLines.push(
            theme.fg("muted", keyHint("app.tools.expand", "to expand")),
          );
        }

        // Render via Box for background + padding, with blank line above for separation
        const box = new Box(1, 1, bgFn);
        box.addChild(new Text(contentLines.join("\n"), 0, 0));
        return ["", ...box.render(width)];
      },
    };
  });

  // ── subagent_status message renderer ──
  pi.registerMessageRenderer("subagent_status", (message, options, theme) => {
    const details = message.details as any;
    const lines = Array.isArray(details?.lines) ? details.lines : [];
    const overflow =
      typeof details?.overflow === "number" ? details.overflow : 0;
    if (lines.length === 0 && overflow === 0) return undefined;

    return {
      invalidate() {},
      render(width: number): string[] {
        const lineWidth = Math.max(0, width - 6);
        const contentLines = [
          `${theme.fg("accent", "•")} ${theme.fg("toolTitle", theme.bold("Subagent status"))}`,
          ...lines.map((line: string) =>
            theme.fg("dim", truncateToWidth(line, lineWidth)),
          ),
        ];

        if (overflow > 0) {
          contentLines.push(theme.fg("muted", `+${overflow} more running.`));
        }
        if (!options.expanded) {
          contentLines.push(
            theme.fg("muted", keyHint("app.tools.expand", "to expand")),
          );
        }

        const box = new Box(1, 1, (text: string) =>
          theme.bg("customMessageBg", text),
        );
        box.addChild(new Text(contentLines.join("\n"), 0, 0));
        return ["", ...box.render(width)];
      },
    };
  });

  // ── subagent_ping message renderer ──
  pi.registerMessageRenderer("subagent_ping", (message, options, theme) => {
    const details = message.details as any;
    if (!details) return undefined;

    return {
      invalidate() {},
      render(width: number): string[] {
        const name = details.name ?? "subagent";
        const agentTag = details.agent
          ? theme.fg("dim", ` (${details.agent})`)
          : "";
        const bgFn = (text: string) => theme.bg("toolSuccessBg", text);

        const icon = theme.fg("accent", "?");
        const header = `${icon} ${theme.fg("toolTitle", theme.bold(name))}${agentTag} ${theme.fg("dim", "— needs help")}`;

        const contentLines = [header];

        if (options.expanded) {
          contentLines.push("");
          contentLines.push(details.message ?? "");
          if (details.sessionFile) {
            contentLines.push("");
            contentLines.push(
              theme.fg("dim", `Session: ${details.sessionFile}`),
            );
          }
        } else {
          const preview = (details.message ?? "")
            .split("\n")[0]
            .slice(0, width - 10);
          contentLines.push(theme.fg("dim", preview));
          contentLines.push(
            theme.fg("muted", keyHint("app.tools.expand", "to expand")),
          );
        }

        const box = new Box(1, 1, bgFn);
        box.addChild(new Text(contentLines.join("\n"), 0, 0));
        return ["", ...box.render(width)];
      },
    };
  });

  // /plan command — start the full planning workflow
  pi.registerCommand("plan", {
    description: "Start a planning session: /plan <what to build>",
    handler: async (args, ctx) => {
      const task = args.trim();
      if (!task) {
        ctx.ui.notify("Usage: /plan <what to build>", "warning");
        return;
      }

      // Rename workspace and tab to show this is a planning session
      if (isMuxAvailable()) {
        try {
          const label = task.length > 40 ? task.slice(0, 40) + "..." : task;
          renameWorkspace(`🎯 ${label}`);
          renameCurrentTab(`🎯 Plan: ${label}`);
        } catch {
          // non-critical -- do not block the plan
        }
      }

      // Load the plan skill from the subagents extension directory
      const planSkillPath = join(SUBAGENTS_DIR, "plan-skill.md");
      let content = readFileSync(planSkillPath, "utf8");
      content = content.replace(/^---\n[\s\S]*?\n---\n*/, "");
      pi.sendUserMessage(
        `<skill name="plan" location="${planSkillPath}">\n${content.trim()}\n</skill>\n\n${task}`,
      );
    },
  });
}
// test
