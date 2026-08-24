import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import {
  Box,
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
} from "node:fs";
import { homedir } from "node:os";
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
} from "./cmux.ts";

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
  getSubagentActivityFile,
  readSubagentActivityFile,
  type ActivityReadResult,
  type SubagentActivityState,
} from "./activity.ts";

/** Absolute path to `pi-extension/subagents`. https://github.com/nodejs/node/issues/37845 */
const SUBAGENTS_DIR = dirname(fileURLToPath(import.meta.url));

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
  resumeSessionId: Type.Optional(
    Type.String({
      description:
        "Resume a previous Claude Code session by its ID. Loads the conversation history and continues where it left off. The session ID is returned in details of every claude tool call. Use this to retry cancelled runs or ask follow-up questions.",
    }),
  ),
});

type SubagentSessionMode = "standalone" | "lineage-only" | "fork";

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
  "subagent_resume",
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
      `subagent or resume the session with subagent_resume.${sessionRef}`
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
  claudeSessionId?: string;
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
interface ResolvedPiLaunchProfile {
  sessionFile: string;
  activityFile: string;
  cwdPrefix: string;
  environment: readonly string[];
  arguments: readonly string[];
  selectedSkills: readonly string[];
}

const RESUMABLE_SNAPSHOT_CUSTOM_TYPE =
  "pi-attachable-subagents/resumable-snapshot";

interface ResumableRecordV1 {
  id: string;
  name: string;
  task: string;
  agent?: string;
  firstStartTime: number;
  accumulatedActiveMs: number;
  launchProfile: Readonly<ResolvedPiLaunchProfile>;
}

interface ResumableSnapshotV1 {
  version: 1;
  ownerSessionId: string;
  records: ResumableRecordV1[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function copyLaunchProfile(
  value: unknown,
  fileExists: (path: string) => boolean,
): Readonly<ResolvedPiLaunchProfile> | undefined {
  if (!isPlainObject(value)) return undefined;
  if (
    !isNonemptyString(value.sessionFile) ||
    !isNonemptyString(value.activityFile) ||
    !isNonemptyString(value.cwdPrefix) ||
    !Array.isArray(value.environment) ||
    !value.environment.every((item) => typeof item === "string") ||
    !Array.isArray(value.arguments) ||
    !value.arguments.every((item) => typeof item === "string") ||
    !Array.isArray(value.selectedSkills) ||
    !value.selectedSkills.every((item) => typeof item === "string") ||
    !fileExists(value.sessionFile)
  ) {
    return undefined;
  }

  return Object.freeze({
    sessionFile: value.sessionFile,
    activityFile: value.activityFile,
    cwdPrefix: value.cwdPrefix,
    environment: Object.freeze([...value.environment]),
    arguments: Object.freeze([...value.arguments]),
    selectedSkills: Object.freeze([...value.selectedSkills]),
  });
}

function validateSnapshotEnvelope(
  value: unknown,
): { ownerSessionId: string; records: unknown[] } | undefined {
  if (
    !isPlainObject(value) ||
    value.version !== 1 ||
    !isNonemptyString(value.ownerSessionId) ||
    !Array.isArray(value.records)
  ) {
    return undefined;
  }
  return { ownerSessionId: value.ownerSessionId, records: value.records };
}

function validateResumableRecord(
  value: unknown,
  fileExists: (path: string) => boolean,
): ResumableRecordV1 | undefined {
  if (
    !isPlainObject(value) ||
    !isNonemptyString(value.id) ||
    !isNonemptyString(value.name) ||
    !isNonemptyString(value.task) ||
    (value.agent !== undefined && typeof value.agent !== "string") ||
    typeof value.firstStartTime !== "number" ||
    !Number.isFinite(value.firstStartTime) ||
    value.firstStartTime < 0 ||
    typeof value.accumulatedActiveMs !== "number" ||
    !Number.isFinite(value.accumulatedActiveMs) ||
    value.accumulatedActiveMs < 0
  ) {
    return undefined;
  }
  const launchProfile = copyLaunchProfile(value.launchProfile, fileExists);
  if (!launchProfile) return undefined;

  return {
    id: value.id,
    name: value.name,
    task: value.task,
    ...(value.agent === undefined ? {} : { agent: value.agent }),
    firstStartTime: value.firstStartTime,
    accumulatedActiveMs: value.accumulatedActiveMs,
    launchProfile,
  };
}

function selectActiveBranchSnapshot(
  branch: readonly unknown[],
  ownerSessionId: string,
  fileExists: (path: string) => boolean = existsSync,
): ResumableRecordV1[] {
  for (let index = branch.length - 1; index >= 0; index--) {
    const entry = branch[index];
    if (
      !isPlainObject(entry) ||
      entry.type !== "custom" ||
      entry.customType !== RESUMABLE_SNAPSHOT_CUSTOM_TYPE
    ) {
      continue;
    }
    const envelope = validateSnapshotEnvelope(entry.data);
    if (!envelope) continue;
    if (envelope.ownerSessionId !== ownerSessionId) return [];

    const seenIds = new Set<string>();
    const records: ResumableRecordV1[] = [];
    for (const candidate of envelope.records) {
      const record = validateResumableRecord(candidate, fileExists);
      if (!record || seenIds.has(record.id)) continue;
      seenIds.add(record.id);
      records.push(record);
    }
    return records;
  }
  return [];
}

function restoreSnapshotRecords(
  header: { id?: unknown } | null,
  sessionId: string,
  branch: readonly unknown[],
  fileExists: (path: string) => boolean = existsSync,
): ResumableRecordV1[] {
  if (header?.id !== sessionId) return [];
  return selectActiveBranchSnapshot(branch, sessionId, fileExists);
}

interface PiLaunchRun {
  surface: string;
  promptArguments: readonly string[];
  originalLaunch: boolean;
}

function buildPiLaunchCommand(
  profile: ResolvedPiLaunchProfile,
  run: PiLaunchRun,
): string {
  const environment = [
    ...profile.environment,
    ...(run.originalLaunch && profile.selectedSkills.length > 0
      ? [`PI_SUBAGENT_SKILLS=${shellEscape(profile.selectedSkills.join(","))}`]
      : []),
    `PI_SUBAGENT_SURFACE=${shellEscape(run.surface)}`,
  ];
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
  startTime: number;
  firstStartTime: number;
  accumulatedActiveMs: number;
  processState?: "active" | "resumable";
  runId?: number;
  explicitlyStopped?: boolean;
  shutdownCancelled?: boolean;
  sessionFile: string;
  launchScriptFile?: string;
  activityFile?: string;
  launchProfile?: Readonly<ResolvedPiLaunchProfile>;
  activity?: SubagentActivityState;
  activityRead?: {
    ok: boolean;
    reason?: "missing" | "invalid" | "wrong-id";
    error?: string;
  };
  abortController?: AbortController;
  cli?: string;
  sentinelFile?: string;
  statusState: SubagentStatusState;
}

/** All currently running subagents, keyed by id. */
const runningSubagents = new Map<string, RunningSubagent>();

function serializeResumableSnapshot(
  ownerSessionId: string,
  agents: Iterable<RunningSubagent>,
  excludedId?: string,
): ResumableSnapshotV1 {
  const records: ResumableRecordV1[] = [];
  for (const running of agents) {
    if (
      running.id === excludedId ||
      running.processState !== "resumable" ||
      running.cli === "claude" ||
      !running.launchProfile ||
      !isNonemptyString(running.id) ||
      !isNonemptyString(running.name) ||
      !isNonemptyString(running.task) ||
      !Number.isFinite(running.firstStartTime) ||
      running.firstStartTime < 0 ||
      !Number.isFinite(running.accumulatedActiveMs) ||
      running.accumulatedActiveMs < 0
    ) {
      continue;
    }
    const launchProfile = copyLaunchProfile(running.launchProfile, () => true);
    if (!launchProfile) continue;
    records.push({
      id: running.id,
      name: running.name,
      task: running.task,
      ...(running.agent === undefined ? {} : { agent: running.agent }),
      firstStartTime: running.firstStartTime,
      accumulatedActiveMs: running.accumulatedActiveMs,
      launchProfile: {
        sessionFile: launchProfile.sessionFile,
        activityFile: launchProfile.activityFile,
        cwdPrefix: launchProfile.cwdPrefix,
        environment: [...launchProfile.environment],
        arguments: [...launchProfile.arguments],
        selectedSkills: [...launchProfile.selectedSkills],
      },
    });
  }
  return { version: 1, ownerSessionId, records };
}

const PERSISTENCE_WARNING_PREFIX =
  "Persistence warning: child remains resumable here but is not restart-durable";

function persistenceWarning(error: unknown): string {
  return `${PERSISTENCE_WARNING_PREFIX}: ${error instanceof Error ? error.message : String(error)}`;
}

function completeWakeTransition(actions: {
  persist?: () => void;
  update: () => void;
  wake: (warning?: string) => void;
}): void {
  let warning: string | undefined;
  try {
    actions.persist?.();
  } catch (error) {
    warning = persistenceWarning(error);
  }
  actions.update();
  actions.wake(warning);
}

function commitResumedTransition(actions: {
  persistRemoval: () => void;
  close: () => void;
  commit: () => void;
  startWatcher: () => void;
  update: () => void;
}): { ok: true } | { error: string } {
  try {
    actions.persistRemoval();
  } catch (error) {
    try {
      actions.close();
    } catch {}
    return { error: persistenceWarning(error) };
  }
  actions.commit();
  actions.startWatcher();
  actions.update();
  return { ok: true };
}

function restoreRunningSubagents(
  records: readonly ResumableRecordV1[],
  target: Map<string, RunningSubagent>,
): void {
  for (const record of records) {
    const launchProfile = record.launchProfile;
    target.set(record.id, {
      id: record.id,
      name: record.name,
      task: record.task,
      ...(record.agent === undefined ? {} : { agent: record.agent }),
      surface: "",
      startTime: record.firstStartTime,
      firstStartTime: record.firstStartTime,
      accumulatedActiveMs: record.accumulatedActiveMs,
      processState: "resumable",
      sessionFile: launchProfile.sessionFile,
      activityFile: launchProfile.activityFile,
      launchProfile,
      statusState: createStatusState({
        source: "pi",
        startTimeMs: record.firstStartTime,
      }),
    });
  }
}

function stopTrackedSubagent(
  running: RunningSubagent,
  actions: {
    persistRemoval: () => void;
    close: (surface: string) => void;
    remove: (id: string) => void;
    update: () => void;
  },
): { ok: true } | { error: string } {
  if (running.processState === "resumable") {
    try {
      actions.persistRemoval();
    } catch (error) {
      return { error: persistenceWarning(error) };
    }
  }

  running.explicitlyStopped = true;
  running.runId = (running.runId ?? 1) + 1;
  running.abortController?.abort();
  if (running.processState !== "resumable") {
    try {
      actions.close(running.surface);
    } catch {}
  }
  actions.remove(running.id);
  actions.update();
  return { ok: true };
}

function appendPersistenceWarning(
  content: string,
  warning: string | undefined,
): string {
  return warning ? `${content}\n\n${warning}` : content;
}

function shouldDeliverWatcherNotification(running: RunningSubagent): boolean {
  return (
    running.explicitlyStopped !== true && running.shutdownCancelled !== true
  );
}

function cleanupFailedWatcherRun(running: RunningSubagent): void {
  if (!existsSync(running.sessionFile)) runningSubagents.delete(running.id);
  else running.processState = "resumable";
}

// ── Widget management ──

/** Latest ExtensionContext from session_start, used for widget updates. */
let latestCtx: ExtensionContext | null = null;

/** Interval timer for widget re-renders. */
let widgetInterval: ReturnType<typeof setInterval> | null = null;

/** Interval timer for status transition checks. */
let statusInterval: ReturnType<typeof setInterval> | null = null;

function getActiveRuntimeMs(running: RunningSubagent, now: number): number {
  return running.processState === "resumable"
    ? running.accumulatedActiveMs
    : running.accumulatedActiveMs + Math.max(0, now - running.startTime);
}

function finalizeActiveRun(
  running: RunningSubagent,
  ownedRunId: number,
  now: number,
): boolean {
  if (
    (running.runId ?? 1) !== ownedRunId ||
    running.processState === "resumable"
  ) {
    return false;
  }
  running.accumulatedActiveMs += Math.max(0, now - running.startTime);
  return true;
}

function formatLocalStartTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "??:??";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "??:??";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatElapsedMMSS(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const ACCENT = "\x1b[38;2;77;163;255m";
const RST = "\x1b[0m";

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

function renderSubagentWidgetLines(
  agents: RunningSubagent[],
  width: number,
  now = Date.now(),
): string[] {
  const count = agents.length;
  const active = agents.filter(
    (agent) => agent.processState !== "resumable",
  ).length;
  const title = "Subagents";
  const info = `${count} tracked · ${active} active`;

  const lines: string[] = [borderTop(title, info, width)];

  for (const agent of agents) {
    const elapsed = formatElapsedMMSS(getActiveRuntimeMs(agent, now));
    const agentTag = agent.agent ? ` (${agent.agent})` : "";
    const left = ` ${elapsed}  ${agent.name}${agentTag} `;
    const snapshot = classifyStatus(agent.statusState, now);
    const startLabel = formatLocalStartTime(agent.firstStartTime);
    const status =
      agent.processState === "resumable"
        ? "stopped · resumable"
        : statusConfig.enabled
          ? formatWidgetRightLabel(snapshot).trim()
          : agent.cli === "claude"
            ? "running…"
            : "starting…";
    const right = ` ${status} · ${startLabel} `;

    lines.push(borderLine(left, right, width));
  }

  lines.push(borderBottom(width));
  return lines;
}

function updateWidget() {
  if (!latestCtx?.hasUI) return;

  if (runningSubagents.size === 0) {
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
            Array.from(runningSubagents.values()),
            width,
          );
        },
      };
    },
    { placement: "aboveEditor" },
  );
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
 * manually resumed or user-touched subagent unable to call subagent_done.
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

function observeRunningSubagent(
  running: RunningSubagent,
  observedAt = Date.now(),
) {
  if (running.cli === "claude") return;

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

async function selectHumanTarget(
  agents: RunningSubagent[],
  target: string | undefined,
  select: (title: string, options: string[]) => Promise<string | undefined>,
): Promise<{ running: RunningSubagent } | { error: string } | undefined> {
  const typed = target?.trim();
  if (typed) return resolveRunningTarget(agents, typed);
  if (agents.length === 0) return undefined;
  if (agents.length === 1) return { running: agents[0] };
  const choices = agents.map((running) => ({
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
  if (running.cli === "claude") {
    return {
      content: [
        {
          type: "text" as const,
          text: "Turn-only Escape interrupt is currently supported only for Pi-backed subagents. Claude-backed semantics have not been verified yet.",
        },
      ],
      details: {
        error: "claude interrupt unsupported",
        id: running.id,
        name: running.name,
      },
    };
  }

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
  loadAgentDefaults,
  discoverAgentDefinitions,
  resolveEffectiveSessionMode,
  resolveLaunchBehavior,
  buildSubagentToolAllowlist,
  buildPiPromptArgs,
  buildPiLaunchCommand,
  resolveModelArgument,
  buildSystemPromptArguments,
  buildInitialTask,
  getActiveRuntimeMs,
  finalizeActiveRun,
  formatLocalStartTime,
  formatSubagentTaskCall,
  formatWidgetRightLabel,
  observeRunningSubagent,
  resolveDenyTools,
  resolveAttachTarget,
  resolveRunningTarget,
  selectHumanTarget,
  resolveInterruptTarget,
  requestSubagentInterrupt,
  handleSubagentInterrupt,
  resolveResultPresentation,
  shouldDeliverWatcherNotification,
  appendPersistenceWarning,
  commitResumedTransition,
  completeWakeTransition,
  restoreRunningSubagents,
  restoreSnapshotRecords,
  selectActiveBranchSnapshot,
  serializeResumableSnapshot,
  stopTrackedSubagent,
  createWatcherOwner,
  cleanupFailedWatcherRun,
  validateResumableRecord,
  validateSnapshotEnvelope,
  RESUMABLE_SNAPSHOT_CUSTOM_TYPE,
  runningSubagents,
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
  options?: { surface?: string },
): Promise<RunningSubagent> {
  const startTime = Date.now();
  const id = Math.random().toString(16).slice(2, 10);

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
  const uuid = [
    id,
    Math.random().toString(16).slice(2, 10),
    Math.random().toString(16).slice(2, 10),
    Math.random().toString(16).slice(2, 6),
  ].join("-");
  const subagentSessionFile = join(sessionDir, `${timestamp}_${uuid}.jsonl`);

  // Use pre-created surface (parallel mode) or create a new one.
  // For new surfaces, pause briefly so the shell is ready before sending the command.
  const surfacePreCreated = !!options?.surface;
  const surface = options?.surface ?? createSurface(params.name);
  if (!surfacePreCreated) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, getShellReadyDelayMs()),
    );
  }

  const launchBehavior = resolveLaunchBehavior(params, agentDefs);

  if (launchBehavior.seededSessionMode) {
    seedSubagentSessionFile({
      mode: launchBehavior.seededSessionMode,
      parentSessionFile: sessionFile,
      childSessionFile: subagentSessionFile,
      childCwd: targetCwdForSession,
    });
  }

  const activityFile = getSubagentActivityFile(artifactDir, id);
  mkdirSync(dirname(activityFile), { recursive: true });
  const fullTask = buildInitialTask(params.task);
  const denySet = resolveDenyTools(agentDefs);
  // ── Claude Code CLI path ──
  if (agentDefs?.cli === "claude") {
    const sentinelFile = `/tmp/pi-claude-${id}-done`;
    const pluginDir = join(SUBAGENTS_DIR, "plugin");

    const cmdParts: string[] = [];
    cmdParts.push(`PI_CLAUDE_SENTINEL=${shellEscape(sentinelFile)}`);
    cmdParts.push("claude");
    cmdParts.push("--dangerously-skip-permissions");

    if (existsSync(pluginDir)) {
      cmdParts.push("--plugin-dir", shellEscape(pluginDir));
    }

    if (effectiveModel) {
      cmdParts.push("--model", shellEscape(effectiveModel));
    }

    const sp = params.systemPrompt ?? agentDefs.body;
    if (sp) {
      cmdParts.push("--append-system-prompt", shellEscape(sp));
    }

    if (params.resumeSessionId) {
      cmdParts.push("--resume", shellEscape(params.resumeSessionId));
    }

    // Always pass the task as the prompt — even for resumed sessions,
    // the caller's task is the follow-up instruction.
    cmdParts.push(shellEscape(params.task));

    const cdPrefix = effectiveCwd ? `cd ${shellEscape(effectiveCwd)} && ` : "";
    const command = `${cdPrefix}${cmdParts.join(" ")}; echo '__SUBAGENT_DONE_'$?'__'`;

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

    sendLongCommand(surface, command, {
      scriptPath: launchScriptFile,
      scriptPreamble: [
        `# Claude Code subagent launch script for ${params.name}`,
        `# Generated: ${new Date().toISOString()}`,
        `# Surface: ${surface}`,
      ].join("\n"),
    });

    const running: RunningSubagent = {
      id,
      name: params.name,
      task: params.task,
      agent: params.agent,
      surface,
      startTime,
      firstStartTime: startTime,
      accumulatedActiveMs: 0,
      sessionFile: subagentSessionFile,
      launchScriptFile,
      cli: "claude",
      sentinelFile,
      processState: "active",
      runId: 1,
      statusState: createStatusState({
        source: "claude",
        startTimeMs: startTime,
      }),
    };

    runningSubagents.set(id, running);
    return running;
  }

  // ── Pi CLI path ──

  // Build pi command
  const parts: string[] = ["pi"];
  parts.push("--session", shellEscape(subagentSessionFile));

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

  if (denySet.size > 0) {
    envParts.push(`PI_DENY_TOOLS=${shellEscape([...denySet].join(","))}`);
  }
  envParts.push(`PI_SUBAGENT_NAME=${shellEscape(params.name)}`);
  if (params.agent) {
    envParts.push(`PI_SUBAGENT_AGENT=${shellEscape(params.agent)}`);
  }
  envParts.push(`PI_SUBAGENT_SESSION=${shellEscape(subagentSessionFile)}`);
  envParts.push(`PI_SUBAGENT_ID=${shellEscape(id)}`);
  envParts.push(`PI_SUBAGENT_ACTIVITY_FILE=${shellEscape(activityFile)}`);

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
  const command = buildPiLaunchCommand(launchProfile, {
    surface,
    promptArguments,
    originalLaunch: true,
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
  sendLongCommand(surface, command, {
    scriptPath: launchScriptFile,
    scriptPreamble: [
      `# Subagent launch script for ${params.name}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Session: ${subagentSessionFile}`,
      `# Surface: ${surface}`,
    ].join("\n"),
  });

  const running: RunningSubagent = {
    id,
    name: params.name,
    task: params.task,
    agent: params.agent,
    surface,
    startTime,
    firstStartTime: startTime,
    accumulatedActiveMs: 0,
    sessionFile: subagentSessionFile,
    launchScriptFile,
    activityFile,
    launchProfile,
    processState: "active",
    runId: 1,
    statusState: createStatusState({
      source: "pi",
      startTimeMs: startTime,
    }),
  };

  runningSubagents.set(id, running);
  return running;
}

/**
 * Watch a launched subagent until it exits. Polls for completion, extracts
 * the summary from the session file, cleans up the surface,
 * and removes the entry from runningSubagents.
 */
const CLAUDE_SESSIONS_DIR = join(
  process.env.HOME ?? "/tmp",
  ".pi",
  "agent",
  "sessions",
  "claude-code",
);

function copyClaudeSession(sentinelFile: string): string | null {
  try {
    const transcriptFile = sentinelFile + ".transcript";
    if (!existsSync(transcriptFile)) return null;
    const transcriptPath = readFileSync(transcriptFile, "utf-8").trim();
    if (!transcriptPath || !existsSync(transcriptPath)) return null;
    mkdirSync(CLAUDE_SESSIONS_DIR, { recursive: true });
    const filename =
      transcriptPath.split("/").pop() ?? `claude-${Date.now()}.jsonl`;
    const dest = join(CLAUDE_SESSIONS_DIR, filename);
    copyFileSync(transcriptPath, dest);
    return filename;
  } catch {
    return null;
  }
}

async function watchSubagent(
  running: RunningSubagent,
  signal: AbortSignal,
  ownerSignal: AbortSignal,
): Promise<SubagentResult> {
  const { name, task, surface, startTime, sessionFile } = running;
  const ownedRunId = running.runId ?? 1;

  try {
    const result = await pollForExit(
      surface,
      AbortSignal.any([signal, ownerSignal]),
      {
        interval: 1000,
        sessionFile,
        sentinelFile: running.sentinelFile,
        onTick() {
          observeRunningSubagent(running);
        },
      },
    );

    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    if (running.cli === "claude") {
      // Claude Code result extraction
      let summary = "";

      if (running.sentinelFile) {
        try {
          summary = readFileSync(running.sentinelFile, "utf-8").trim();
        } catch {}
      }

      if (!summary) {
        summary = readScreen(surface, 200)
          .replace(/__SUBAGENT_DONE_\d+__/, "")
          .trimEnd();
      }

      if (!summary) {
        summary =
          result.exitCode !== 0
            ? `Claude Code exited with code ${result.exitCode}`
            : "Claude Code exited without output";
      }

      // Copy Claude session transcript
      let sessionId: string | null = null;
      if (running.sentinelFile) {
        sessionId = copyClaudeSession(running.sentinelFile);
        try {
          unlinkSync(running.sentinelFile);
        } catch {}
        try {
          unlinkSync(running.sentinelFile + ".transcript");
        } catch {}
      }

      closeSurface(surface);
      runningSubagents.delete(running.id);

      return {
        name,
        task,
        summary,
        exitCode: result.exitCode,
        elapsed,
        ...(sessionId ? { claudeSessionId: sessionId } : {}),
      };
    }

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

    if (!finalizeActiveRun(running, ownedRunId, Date.now())) {
      throw new Error("Stale subagent watcher.");
    }
    running.processState = "resumable";
    closeSurface(surface);
    if (result.reason === "done") runningSubagents.delete(running.id);

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
    if (!finalizeActiveRun(running, ownedRunId, Date.now())) throw err;
    try {
      closeSurface(surface);
    } catch {}

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
    // A launch-side infrastructure failure can occur before Pi writes a
    // session. Do not retain a resumable record that cannot be resumed.
    cleanupFailedWatcherRun(running);
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

export default function subagentsExtension(pi: ExtensionAPI) {
  const watcherOwner = createWatcherOwner();
  const ownedRuns = new Set<RunningSubagent>();
  let managerSessionId: string | null = null;

  const persistSnapshot = (excludedId?: string) => {
    if (!managerSessionId) {
      throw new Error("manager session identity is unavailable");
    }
    pi.appendEntry(
      RESUMABLE_SNAPSHOT_CUSTOM_TYPE,
      serializeResumableSnapshot(
        managerSessionId,
        runningSubagents.values(),
        excludedId,
      ),
    );
  };

  // Capture the UI context and restore only the active manager branch.
  pi.on("session_start", (_event, ctx) => {
    latestCtx = ctx;
    runningSubagents.clear();
    const header = ctx.sessionManager.getHeader();
    const currentSessionId = ctx.sessionManager.getSessionId();
    managerSessionId =
      header?.id === currentSessionId ? currentSessionId : null;
    if (managerSessionId) {
      restoreRunningSubagents(
        restoreSnapshotRecords(
          header,
          currentSessionId,
          ctx.sessionManager.getBranch(),
        ),
        runningSubagents,
      );
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
    watcherOwner.abort();
    for (const agent of ownedRuns) {
      agent.shutdownCancelled = true;
      agent.abortController?.abort();
      try {
        closeSurface(agent.surface);
      } catch {}
      if (runningSubagents.get(agent.id) === agent)
        runningSubagents.delete(agent.id);
    }
    ownedRuns.clear();
  });

  // Tools denied via PI_DENY_TOOLS env var (set by parent agent based on frontmatter)
  const deniedTools = new Set(
    (process.env.PI_DENY_TOOLS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const shouldRegister = (name: string) => !deniedTools.has(name);

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
        const running = await launchSubagent(params, ctx);

        // Create a separate AbortController for the watcher
        // (the tool's signal completes when we return)
        const watcherAbort = new AbortController();
        running.abortController = watcherAbort;
        ownedRuns.add(running);

        // Start widget refresh and status supervision when the first agent launches
        startWidgetRefresh();
        startStatusRefresh(pi);

        // Fire-and-forget: start watching in background
        watchSubagent(running, watcherAbort.signal, watcherOwner.signal)
          .then((result) => {
            ownedRuns.delete(running);
            if (!shouldDeliverWatcherNotification(running)) {
              updateWidget();
              return;
            }
            const becameResumable =
              running.processState === "resumable" &&
              runningSubagents.get(running.id) === running;
            completeWakeTransition({
              ...(becameResumable ? { persist: () => persistSnapshot() } : {}),
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
                      ...(result.errorMessage
                        ? { errorMessage: result.errorMessage }
                        : {}),
                      ...(result.claudeSessionId
                        ? { claudeSessionId: result.claudeSessionId }
                        : {}),
                    },
                  },
                  { triggerTurn: true, deliverAs: "steer" },
                );
              },
            });
          })
          .catch((err) => {
            updateWidget();
            if (!shouldDeliverWatcherNotification(running)) return;
            pi.sendMessage(
              {
                customType: "subagent_result",
                content: `Sub-agent "${running.name}" error: ${err?.message ?? String(err)}`,
                display: true,
                details: {
                  name: running.name,
                  task: running.task,
                  error: err?.message,
                },
              },
              { triggerTurn: true, deliverAs: "steer" },
            );
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
    resolveRunningTarget(Array.from(runningSubagents.values()), target);

  const deliverControlledRun = (
    running: RunningSubagent,
    watcherAbort: AbortController,
  ) => {
    watchSubagent(running, watcherAbort.signal, watcherOwner.signal)
      .then((result) => {
        ownedRuns.delete(running);
        if (!shouldDeliverWatcherNotification(running)) {
          updateWidget();
          return;
        }
        const becameResumable =
          running.processState === "resumable" &&
          runningSubagents.get(running.id) === running;
        completeWakeTransition({
          ...(becameResumable ? { persist: () => persistSnapshot() } : {}),
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
                },
              },
              { triggerTurn: true, deliverAs: "steer" },
            );
          },
        });
      })
      .catch((error) => {
        if (shouldDeliverWatcherNotification(running))
          pi.sendMessage(
            {
              customType: "subagent_result",
              content: `Sub-agent "${running.name}" error: ${error instanceof Error ? error.message : String(error)}`,
              display: true,
            },
            { triggerTurn: true, deliverAs: "steer" },
          );
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
    const running = resolved.running;
    if (running.cli === "claude")
      return { error: "Controls support Pi-backed subagents only." };
    if (running.processState !== "resumable") {
      try {
        sendPrompt(running.surface, message);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
      return { running };
    }
    let surface: string | undefined;
    try {
      surface = createSurface(running.name);
      await new Promise<void>((resolve) =>
        setTimeout(resolve, getShellReadyDelayMs()),
      );
      if (!running.launchProfile)
        throw new Error("Subagent has no resolved Pi launch profile.");
      const command = buildPiLaunchCommand(running.launchProfile, {
        surface,
        promptArguments: [message],
        originalLaunch: false,
      });
      sendLongCommand(surface, command);
      const startTime = Date.now();
      const nextRunId = (running.runId ?? 1) + 1;
      const watcherAbort = new AbortController();
      const transition = commitResumedTransition({
        persistRemoval: () => persistSnapshot(running.id),
        close: () => closeSurface(surface!),
        commit() {
          running.surface = surface!;
          running.startTime = startTime;
          running.processState = "active";
          running.runId = nextRunId;
          running.statusState = createStatusState({
            source: "pi",
            startTimeMs: startTime,
          });
          running.abortController = watcherAbort;
          ownedRuns.add(running);
        },
        startWatcher: () => deliverControlledRun(running, watcherAbort),
        update() {
          startWidgetRefresh();
          startStatusRefresh(pi);
          updateWidget();
        },
      });
      if ("error" in transition) return transition;
      return { running };
    } catch (error) {
      if (surface)
        try {
          closeSurface(surface);
        } catch {}
      return { error: error instanceof Error ? error.message : String(error) };
    }
  };

  if (shouldRegister("subagent_steer"))
    pi.registerTool({
      name: "subagent_steer",
      label: "Steer Subagent",
      description: "Send one message to an active or resumable Pi subagent.",
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
              ? { error: result.error }
              : { id: result.running.id },
        };
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
        const running = resolved.running;
        try {
          const peek = inspectSession(running.sessionFile);
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
          const text = `${running.name} [${running.id}]\nState: ${running.processState === "resumable" ? "stopped · resumable" : "active"}\nModel: ${model}\nSession: ${running.sessionFile}\nContext usage: ${usage}\n\n${tail}`;
          return {
            content: [{ type: "text", text }],
            details: { error: "", id: running.id },
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
        "Stop and forget a tracked subagent without waking the manager. The session file is preserved.",
      parameters: Type.Object({ target: Type.String() }),
      async execute(_id, params) {
        const resolved = resolveControlTarget(params.target);
        if ("error" in resolved)
          return {
            content: [{ type: "text", text: resolved.error }],
            details: { error: resolved.error, id: "" },
          };
        const running = resolved.running;
        const stopped = stopTrackedSubagent(running, {
          persistRemoval: () => persistSnapshot(running.id),
          close: closeSurface,
          remove: (id) => runningSubagents.delete(id),
          update: updateWidget,
        });
        const text =
          "error" in stopped
            ? stopped.error
            : `Stopped subagent "${running.name}".`;
        return {
          content: [{ type: "text", text }],
          details: {
            error: "error" in stopped ? stopped.error : "",
            id: running.id,
          },
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
        "List all available subagent definitions. " +
        "Scans project-local .pi/agents/ and global ~/.pi/agent/agents/. " +
        "Project-local agents override global ones with the same name.",
      promptSnippet:
        "List all available subagent definitions. " +
        "Scans project-local .pi/agents/ and global ~/.pi/agent/agents/. " +
        "Project-local agents override global ones with the same name.",
      parameters: Type.Object({}),

      async execute() {
        const list = discoverAgentDefinitions().filter(
          (agent) => !agent.disableModelInvocation,
        );

        if (list.length === 0) {
          return {
            content: [{ type: "text", text: "No subagent definitions found." }],
            details: { agents: [] },
          };
        }

        const lines = list.map((a) => {
          const badge = a.source === "project" ? " (project)" : "";
          const desc = a.description ? ` — ${a.description}` : "";
          const model = a.model ? ` [${a.model}]` : "";
          return `• ${a.name}${badge}${model}${desc}`;
        });

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: { agents: list },
        };
      },

      renderResult(result, _opts, theme) {
        const details = result.details as any;
        const agents = details?.agents ?? [];
        if (agents.length === 0) {
          return new Text(
            theme.fg("dim", "No subagent definitions found."),
            0,
            0,
          );
        }
        const lines = agents.map((a: any) => {
          const badge =
            a.source === "project" ? theme.fg("accent", " (project)") : "";
          const desc = a.description
            ? theme.fg("dim", ` — ${a.description}`)
            : "";
          const model = a.model ? theme.fg("dim", ` [${a.model}]`) : "";
          return `  ${theme.fg("toolTitle", theme.bold(a.name))}${badge}${model}${desc}`;
        });
        return new Text(lines.join("\n"), 0, 0);
      },
    });

  // ── subagent_resume tool ──
  if (shouldRegister("subagent_resume"))
    pi.registerTool({
      name: "subagent_resume",
      label: "Resume Subagent",
      description:
        "Resume a previous sub-agent session in a new multiplexer pane. " +
        "This is a fire-and-forget async tool: the call returns immediately with only an acknowledgement. " +
        "When the resumed sub-agent finishes, the harness AUTOMATICALLY delivers its result as a steer message that wakes you up and starts a new turn — you do not need to do anything to receive it. " +
        "DO NOT write polling loops, sleep/wait commands, tail/watch scripts, or repeatedly read session/log files to detect completion. DO NOT poll for status. All of that is wasted work — the harness handles delivery for you. " +
        "DO NOT fabricate or assume results. After resuming, either end your turn or work on other independent tasks; the harness will wake you when the result is ready. " +
        "Use when a sub-agent was cancelled or needs follow-up work.",
      promptSnippet:
        "Resume a previous sub-agent session in a new multiplexer pane. " +
        "This is a fire-and-forget async tool: the call returns immediately with only an acknowledgement. " +
        "When the resumed sub-agent finishes, the harness AUTOMATICALLY delivers its result as a steer message that wakes you up and starts a new turn — you do not need to do anything to receive it. " +
        "DO NOT write polling loops, sleep/wait commands, tail/watch scripts, or repeatedly read session/log files to detect completion. DO NOT poll for status. All of that is wasted work — the harness handles delivery for you. " +
        "DO NOT fabricate or assume results. After resuming, either end your turn or work on other independent tasks; the harness will wake you when the result is ready. " +
        "Use when a sub-agent was cancelled or needs follow-up work.",
      parameters: Type.Object({
        sessionPath: Type.String({
          description: "Path to the session .jsonl file to resume",
        }),
        name: Type.Optional(
          Type.String({
            description: "Display name for the terminal tab. Default: 'Resume'",
          }),
        ),
        message: Type.Optional(
          Type.String({
            description:
              "Optional message to send after resuming (e.g. follow-up instructions)",
          }),
        ),
      }),

      renderCall(args, theme) {
        const name = args.name ?? "Resume";
        const text =
          "▸ " +
          theme.fg("toolTitle", theme.bold(name)) +
          theme.fg("dim", " — resuming session");
        return new Text(text, 0, 0);
      },

      renderResult(result, _opts, theme) {
        const details = result.details as any;
        const name = details?.name ?? "Resume";

        if (details?.status === "started") {
          return new Text(
            theme.fg("accent", "▸") +
              " " +
              theme.fg("toolTitle", theme.bold(name)) +
              theme.fg("dim", " — resumed"),
            0,
            0,
          );
        }

        // Fallback
        const content = result.content[0];
        const text = content?.type === "text" ? content.text : "";
        return new Text(theme.fg("dim", text), 0, 0);
      },

      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const name = params.name ?? "Resume";
        const startTime = Date.now();
        const id = Math.random().toString(16).slice(2, 10);

        if (!isMuxAvailable()) {
          return muxUnavailableResult();
        }

        if (!existsSync(params.sessionPath)) {
          return {
            content: [
              {
                type: "text",
                text: `Error: session file not found: ${params.sessionPath}`,
              },
            ],
            details: { error: "session not found" },
          };
        }

        // Record entry count before resuming so we can extract new messages
        const entryCountBefore = getNewEntries(params.sessionPath, 0).length;

        const surface = createSurface(name);
        await new Promise<void>((resolve) =>
          setTimeout(resolve, getShellReadyDelayMs()),
        );

        // Build pi resume command
        const parts = ["pi", "--session", shellEscape(params.sessionPath)];

        // Load subagent-done extension so the agent can self-terminate if needed
        const subagentDonePath = join(SUBAGENTS_DIR, "subagent-done.ts");
        parts.push("-e", shellEscape(subagentDonePath));

        const sessionId = ctx.sessionManager.getSessionId();
        const artifactDir = getArtifactDir(
          ctx.sessionManager.getSessionDir(),
          sessionId,
        );
        const activityFile = getSubagentActivityFile(artifactDir, id);
        mkdirSync(dirname(activityFile), { recursive: true });

        let resumeMsgFile: string | undefined;
        if (params.message) {
          const msgTimestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-")
            .slice(0, 19);
          resumeMsgFile = join(
            artifactDir,
            "subagent-resume",
            `${
              name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "") || "resume"
            }-${msgTimestamp}.md`,
          );
          mkdirSync(dirname(resumeMsgFile), { recursive: true });
          writeFileSync(resumeMsgFile, params.message, "utf8");
          parts.push(shellEscape(`@${resumeMsgFile}`));
        }

        // Build env prefix — propagate PI_CODING_AGENT_DIR for config isolation
        const resumeEnvParts: string[] = [];
        if (process.env.PI_CODING_AGENT_DIR) {
          resumeEnvParts.push(
            `PI_CODING_AGENT_DIR=${shellEscape(process.env.PI_CODING_AGENT_DIR)}`,
          );
        }
        resumeEnvParts.push(`PI_SUBAGENT_NAME=${shellEscape(name)}`);
        resumeEnvParts.push(
          `PI_SUBAGENT_SESSION=${shellEscape(params.sessionPath)}`,
        );
        resumeEnvParts.push(`PI_SUBAGENT_ID=${shellEscape(id)}`);
        resumeEnvParts.push(
          `PI_SUBAGENT_ACTIVITY_FILE=${shellEscape(activityFile)}`,
        );
        const launchProfile = Object.freeze({
          sessionFile: params.sessionPath,
          activityFile,
          cwdPrefix: `cd ${shellEscape(ctx.cwd)} && `,
          environment: Object.freeze([...resumeEnvParts]),
          arguments: Object.freeze(
            params.message ? parts.slice(0, -1) : [...parts],
          ),
          selectedSkills: Object.freeze([]),
        });
        const command = buildPiLaunchCommand(launchProfile, {
          surface,
          promptArguments: params.message ? [`@${resumeMsgFile}`] : [],
          originalLaunch: true,
        });
        const launchScriptFile = join(
          artifactDir,
          "subagent-scripts",
          `${
            name
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, "")
              .replace(/\s+/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "") || "resume"
          }-resume-${Date.now()}.sh`,
        );
        sendLongCommand(surface, command, {
          scriptPath: launchScriptFile,
          scriptPreamble: [
            `# Subagent resume script for ${name}`,
            `# Generated: ${new Date().toISOString()}`,
            `# Session: ${params.sessionPath}`,
            `# Surface: ${surface}`,
            ...(resumeMsgFile
              ? [`# Resume message file: ${resumeMsgFile}`]
              : []),
          ].join("\n"),
        });

        // Register as a running subagent for widget tracking
        const running: RunningSubagent = {
          id,
          name,
          task: params.message ?? "resumed session",
          surface,
          startTime,
          firstStartTime: startTime,
          accumulatedActiveMs: 0,
          sessionFile: params.sessionPath,
          launchScriptFile,
          activityFile,
          launchProfile,
          processState: "active",
          runId: 1,
          statusState: createStatusState({
            source: "pi",
            startTimeMs: startTime,
          }),
        };
        runningSubagents.set(id, running);
        startWidgetRefresh();
        startStatusRefresh(pi);

        // Fire-and-forget watcher
        const watcherAbort = new AbortController();
        running.abortController = watcherAbort;
        ownedRuns.add(running);

        watchSubagent(running, watcherAbort.signal, watcherOwner.signal)
          .then((result) => {
            ownedRuns.delete(running);
            if (!shouldDeliverWatcherNotification(running)) {
              updateWidget();
              return;
            }
            const becameResumable =
              running.processState === "resumable" &&
              runningSubagents.get(running.id) === running;
            completeWakeTransition({
              ...(becameResumable ? { persist: () => persistSnapshot() } : {}),
              update: updateWidget,
              wake(warning) {
                if (result.ping) {
                  const sessionRef = `\n\nSession: ${params.sessionPath}\nResume: pi --session ${params.sessionPath}`;
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
                        sessionFile: params.sessionPath,
                      },
                    },
                    { triggerTurn: true, deliverAs: "steer" },
                  );
                  return;
                }

                const allEntries = getNewEntries(
                  params.sessionPath,
                  entryCountBefore,
                );
                const summary =
                  findLastAssistantMessage(allEntries) ??
                  (result.errorMessage
                    ? `Subagent error: ${result.errorMessage}`
                    : result.exitCode !== 0
                      ? `Resumed session exited with code ${result.exitCode}`
                      : "Resumed session exited without new output");
                const presentation = resolveResultPresentation(
                  { ...result, summary, sessionFile: params.sessionPath },
                  name,
                );

                pi.sendMessage(
                  {
                    customType: "subagent_result",
                    content: appendPersistenceWarning(presentation, warning),
                    display: true,
                    details: {
                      name,
                      task: params.message ?? "resumed session",
                      exitCode: result.exitCode,
                      elapsed: result.elapsed,
                      sessionFile: params.sessionPath,
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
            updateWidget();
            if (!shouldDeliverWatcherNotification(running)) return;
            pi.sendMessage(
              {
                customType: "subagent_result",
                content: `Resume error: ${err?.message ?? String(err)}`,
                display: true,
                details: { name, error: err?.message },
              },
              { triggerTurn: true, deliverAs: "steer" },
            );
          });

        return {
          content: [{ type: "text", text: `Session "${name}" resumed.` }],
          details: {
            id,
            name,
            sessionPath: params.sessionPath,
            launchScriptFile,
            status: "started",
          },
        };
      },
    });

  pi.registerCommand("steer", {
    description:
      "Steer an active or resumable subagent: /steer [target] [message]",
    handler: async (args, ctx) => {
      const [typedTarget = "", ...words] = args.trim().split(/\s+/);
      const selected = await selectHumanTarget(
        Array.from(runningSubagents.values()),
        typedTarget,
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
      let message = words.join(" ");
      if (!message)
        message =
          (await ctx.ui.input("Steer message", "Message for the subagent")) ??
          "";
      const result = await steer(selected.running.id, message, ctx);
      ctx.ui.notify(
        "error" in result
          ? result.error
          : `Steered subagent "${result.running.name}".`,
        "error" in result ? "error" : "info",
      );
    },
  });

  pi.registerCommand("stop", {
    description: "Stop and forget a subagent: /stop [target]",
    handler: async (args, ctx) => {
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
      const stopped = stopTrackedSubagent(running, {
        persistRemoval: () => persistSnapshot(running.id),
        close: closeSurface,
        remove: (id) => runningSubagents.delete(id),
        update: updateWidget,
      });
      ctx.ui.notify(
        "error" in stopped
          ? stopped.error
          : `Stopped subagent "${running.name}".`,
        "error" in stopped ? "error" : "info",
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
      if (running.processState === "resumable") {
        ctx.ui.notify(
          `Subagent "${running.name}" is stopped and resumable. Use /steer ${running.id} <message>.`,
          "info",
        );
        return;
      }
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
    description: "Detach this tmux subagent into a background window",
    handler: async (_args, ctx) => {
      const id = process.env.PI_SUBAGENT_ID;
      const surface = process.env.PI_SUBAGENT_SURFACE;
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
      if (process.env.TMUX_PANE !== surface) {
        ctx.ui.notify(
          `Refusing to detach: current pane ${process.env.TMUX_PANE ?? "(unknown)"} does not match subagent pane ${surface}.`,
          "error",
        );
        return;
      }
      try {
        detachTmuxPane(surface);
        ctx.ui.notify(
          `Detached subagent ${id} into a background tmux window.`,
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
