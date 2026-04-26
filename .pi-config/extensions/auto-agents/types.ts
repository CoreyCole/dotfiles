export interface AutoAgentsStateEntry {
  path: string;
  hash: string;
  loadedAt: string;
  triggerPath: string;
}

export interface AutoAgentsStateSnapshot {
  byPath: Map<string, AutoAgentsStateEntry>;
}

export interface ResolvedReadTarget {
  requestedPath: string;
  absolutePath: string;
}

export interface AgentsCandidate {
  path: string;
  hash: string;
}

export interface AutoAgentsReadDetails {
  autoAgents?: {
    loaded: AutoAgentsStateEntry[];
    skipped: string[];
  };
}
