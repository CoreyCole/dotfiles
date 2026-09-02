import { parseFastCommandArgs } from "./fast-command-parser.ts";
import type { FastConfig } from "./fast-config-store.ts";
import type { FastStateEngine, FastStateSnapshot, FastStateTransition } from "./fast-state-engine.ts";
import type { FastModelIdentity } from "./supported-models.ts";

export const FAST_COMMAND_USAGE = "Usage: /fast";
export const FAST_COMMAND_SAVE_FAILED_MESSAGE =
  "Could not save Fast Mode preference; the config update was not saved.";

export type FastCommandNoticeType = "info" | "warning" | "error";

export interface FastCommandDependencies {
  stateEngine: FastStateEngine;
  config: Pick<FastConfig, "persistState">;
  currentModel?: FastModelIdentity | undefined;
  saveDesiredActive(desiredActive: boolean): Promise<boolean>;
  writeFastDesiredHandoff(desiredActive: boolean): void;
  notify(message: string, type: FastCommandNoticeType): void;
}

export type FastCommandResult =
  | {
      kind: "usage";
      state: FastStateSnapshot;
      persisted: false;
    }
  | {
      kind: "toggled";
      state: FastStateSnapshot;
      transition: FastStateTransition;
      persisted: boolean;
    };

export async function executeFastCommand(args: string, dependencies: FastCommandDependencies): Promise<FastCommandResult> {
  const parsed = parseFastCommandArgs(args);

  if (parsed.kind === "usage") {
    dependencies.notify(FAST_COMMAND_USAGE, "error");
    return { kind: "usage", state: dependencies.stateEngine.snapshot(), persisted: false };
  }

  const nextDesiredActive = !dependencies.stateEngine.snapshot().desiredActive;
  const transition = dependencies.stateEngine.transition({
    currentModel: dependencies.currentModel,
    desiredActive: nextDesiredActive,
  });
  const state = transition.current;
  dependencies.writeFastDesiredHandoff(state.desiredActive);

  if (dependencies.config.persistState) {
    const persisted = await dependencies.saveDesiredActive(state.desiredActive);
    if (!persisted) {
      dependencies.notify(FAST_COMMAND_SAVE_FAILED_MESSAGE, "warning");
    }
    return { kind: "toggled", state, transition, persisted };
  }

  return { kind: "toggled", state, transition, persisted: false };
}
