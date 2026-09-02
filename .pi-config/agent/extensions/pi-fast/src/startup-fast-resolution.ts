import type { FastConfig } from "./fast-config-store.ts";
import type { FastDesiredHandoffReadResult } from "./fast-desired-handoff.ts";

export interface StartupFastDesiredResolutionInput {
  config: Pick<FastConfig, "persistState" | "desiredActive">;
  startupFastOverride: boolean;
  fastDesiredHandoff: FastDesiredHandoffReadResult;
}

export function resolveStartupDesiredActive(input: StartupFastDesiredResolutionInput): boolean {
  if (input.startupFastOverride) {
    return true;
  }

  if (input.fastDesiredHandoff.kind === "valid") {
    return input.fastDesiredHandoff.desiredActive;
  }

  return input.config.persistState ? input.config.desiredActive : false;
}
