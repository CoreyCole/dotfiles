import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AgentsCandidate, AutoAgentsStateEntry, AutoAgentsStateSnapshot } from "./types";

export const AUTO_AGENTS_STATE_TYPE = "auto-agents-state";

function isStateEntry(value: unknown): value is AutoAgentsStateEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<AutoAgentsStateEntry>;
  return (
    typeof entry.path === "string" &&
    typeof entry.hash === "string" &&
    typeof entry.loadedAt === "string" &&
    typeof entry.triggerPath === "string"
  );
}

export function restoreAutoAgentsState(ctx: ExtensionContext): AutoAgentsStateSnapshot {
  const byPath = new Map<string, AutoAgentsStateEntry>();

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "custom" || entry.customType !== AUTO_AGENTS_STATE_TYPE) continue;
    if (isStateEntry(entry.data)) byPath.set(entry.data.path, entry.data);
  }

  return { byPath };
}

export function shouldReadAgentsFile(state: AutoAgentsStateSnapshot, candidate: AgentsCandidate): boolean {
  return state.byPath.get(candidate.path)?.hash !== candidate.hash;
}

export function rememberAgentsFile(
  state: AutoAgentsStateSnapshot,
  entry: AutoAgentsStateEntry,
  appendEntry: (customType: string, data?: unknown) => void,
) {
  state.byPath.set(entry.path, entry);
  appendEntry(AUTO_AGENTS_STATE_TYPE, entry);
}
