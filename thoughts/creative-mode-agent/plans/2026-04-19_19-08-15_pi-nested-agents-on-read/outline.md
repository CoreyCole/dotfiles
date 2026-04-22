---
date: 2026-04-19T19:47:10-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: c17853f152992d191be230bfa7558b4cc80d0771
branch: feat/cctl-contrib-export-local-v2
repository: dotfiles
stage: outline
ticket: "Auto-load nested AGENTS.md / CLAUDE.md on read"
plan_dir: "thoughts/creative-mode-agent/plans/2026-04-19_19-08-15_pi-nested-agents-on-read"
---

# Outline: Auto-load nested AGENTS.md / CLAUDE.md on read

## Overview

Add a global pi extension under `.pi-config/extensions/` that watches successful `read` tool results. When the agent reads a file inside the session cwd, the extension will walk from that file’s directory up to the session cwd, choose `AGENTS.md` if present or `CLAUDE.md` otherwise for each directory, and inject only newly encountered files into context.

The dedupe source of truth should be the active conversation context, not a permanent side log. The extension will rebuild its loaded-path set from the startup context files pi already loads plus hidden custom messages emitted by this extension that are still present on the current branch. That keeps `/tree` and compaction aligned with the actual active context.

## Type Definitions

```ts
const AUTO_CONTEXT_MESSAGE_TYPE = "path-context:auto-load";

type ContextFileName = "AGENTS.md" | "CLAUDE.md";

interface ContextFileRef {
  path: string;
  name: ContextFileName;
}

interface ContextFile extends ContextFileRef {
  content: string;
}

interface AutoContextMessageDetails {
  targetPath: string;
  paths: string[];
}

function resolveReadTarget(rawPath: string, cwd: string): string;
function pickContextFile(dir: string): ContextFileRef | null;
function isWithinSessionRoot(targetPath: string, cwd: string): boolean;

function collectStartupContextPaths(cwd: string, agentDir: string): string[];
function rebuildLoadedPaths(ctx: ExtensionContext): Set<string>;

function discoverNestedContextFiles(
  targetPath: string,
  cwd: string,
  loadedPaths: Set<string>,
): ContextFile[];

function formatAutoContextMessage(
  targetPath: string,
  files: ContextFile[],
): string;
```

## Package / File Structure

- `.pi-config/extensions/path-context.ts` (new)

No `settings.json` change is needed because global extensions in `~/.pi/agent/extensions/` are auto-discovered and reloadable via `/reload`.

## API Surface

```ts
export default function (pi: ExtensionAPI) {
  pi.on("session_start", ...);
  pi.on("session_tree", ...);
  pi.on("session_compact", ...);
  pi.on("tool_result", ...);
}
```

```ts
pi.sendMessage(
  {
    customType: AUTO_CONTEXT_MESSAGE_TYPE,
    content: formatAutoContextMessage(targetPath, files),
    display: false,
    details: {
      targetPath,
      paths: files.map((file) => file.path),
    },
  },
  { deliverAs: "steer" },
);
```

## Slices

### Slice 1: Add discovery and loaded-path reconstruction helpers

**Files:**
- `.pi-config/extensions/path-context.ts` (new)

```ts
function pickContextFile(dir: string): ContextFileRef | null;
function collectStartupContextPaths(cwd: string, agentDir: string): string[];
function rebuildLoadedPaths(ctx: ExtensionContext): Set<string>;
function resolveReadTarget(rawPath: string, cwd: string): string;
function isWithinSessionRoot(targetPath: string, cwd: string): boolean;
```

This slice establishes the rules that everything else depends on:
- `AGENTS.md` wins over `CLAUDE.md` within the same directory.
- Startup-loaded context files are treated as already present.
- The loaded-path set is rebuilt on `session_start`, `session_tree`, and `session_compact`.
- Reconstruction scans this extension’s prior hidden custom messages on the active branch via `details.paths`.
- Path normalization strips a leading `@`, expands `~`, and resolves relative to `ctx.cwd`.

**Test checkpoint:** After `/reload`, reading a file under the project root does not reload the root `AGENTS.md` that pi already loaded at startup.

### Slice 2: Inject newly discovered nested context after successful reads

**Files:**
- `.pi-config/extensions/path-context.ts` (same file)

```ts
function discoverNestedContextFiles(
  targetPath: string,
  cwd: string,
  loadedPaths: Set<string>,
): ContextFile[];

function formatAutoContextMessage(
  targetPath: string,
  files: ContextFile[],
): string;

async function handleReadResult(
  event: ToolResultEvent,
  ctx: ExtensionContext,
): Promise<void>;
```

This slice adds the actual runtime behavior:
- Only react to successful `read` tool results.
- Only inspect files inside the session cwd.
- Walk from `dirname(targetPath)` up to `ctx.cwd`.
- Skip any file path already in the loaded set.
- Skip loading the target file itself when the agent explicitly reads `AGENTS.md` or `CLAUDE.md`.
- Add newly discovered paths to the in-memory set before any async send to avoid duplicate queueing from parallel reads.
- Inject all newly found files as one hidden custom message so they participate in the next LLM turn without cluttering the transcript.
- Optionally show a short UI notification listing which nested context files were auto-loaded.

**Test checkpoint:** In a fixture such as:
- `proj/AGENTS.md`
- `proj/src/AGENTS.md`
- `proj/src/nested/CLAUDE.md`
- `proj/src/nested/file.ts`

reading `src/nested/file.ts` loads only:
- `src/AGENTS.md`
- `src/nested/CLAUDE.md`

and does not reload `proj/AGENTS.md`. Reading the same file again produces no second load.

### Slice 3: Make loaded-path behavior follow active branch and compaction state

**Files:**
- `.pi-config/extensions/path-context.ts` (same file)

```ts
function rebuildLoadedPaths(ctx: ExtensionContext): Set<string>;
```

This slice keeps the dedupe semantics correct over time:
- After `/tree`, the loaded set must reflect the new branch rather than stale in-memory state.
- After compaction, the loaded set must reflect whichever hidden auto-context messages remain in active context.
- The source of truth stays branch-visible context plus startup context, not `pi.appendEntry()`.

**Test checkpoint:**
1. Read a nested file once so the extension auto-loads path-specific context.
2. Use `/tree` to jump back to a point before that hidden auto-context message existed.
3. Read the same nested file again.
4. The nested context files load once again, proving the set was rebuilt from active branch state rather than stale memory.

## Out of Scope

- Changing pi core `DefaultResourceLoader`
- Changing startup header rendering to list dynamically loaded nested context files
- Loading other convention resources such as `.cursorrules`, `.clinerules`, `.claude/rules/*`, or `.cursor/rules/*`
- Backfilling context for files that were read earlier in the session before this extension was loaded
- Adding package/distribution work beyond the local auto-discovered extension
