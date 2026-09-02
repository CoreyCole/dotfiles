import { fastModelKey, isSupportedFastModel, type FastModelIdentity } from "./supported-models.ts";

export interface FastStateEngineOptions {
  desiredActive: boolean;
  supportedModels: readonly string[];
  currentModel?: FastModelIdentity | undefined;
  startupFastOverride?: boolean | undefined;
}

export interface FastStateSnapshot {
  desiredActive: boolean;
  active: boolean;
  currentModelKey: string | undefined;
}

export type RequestedFastInactiveReason = "no-model" | "unsupported-model";

export interface RequestedFastInactiveEvent {
  kind: "requested-fast-inactive";
  reason: RequestedFastInactiveReason;
  currentModelKey: string | undefined;
}

export type FastStateTransitionEvent = RequestedFastInactiveEvent;

export interface FastStateTransition {
  previous: FastStateSnapshot;
  current: FastStateSnapshot;
  events: readonly FastStateTransitionEvent[];
}

export interface FastStateUpdate {
  desiredActive?: boolean | undefined;
  currentModel?: FastModelIdentity | undefined;
  supportedModels?: readonly string[] | undefined;
  startupFastOverride?: boolean | undefined;
}

function hasOwnField<T extends object>(value: T, field: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function inactiveReason(snapshot: FastStateSnapshot): RequestedFastInactiveReason | undefined {
  if (!snapshot.desiredActive || snapshot.active) {
    return undefined;
  }

  return snapshot.currentModelKey === undefined ? "no-model" : "unsupported-model";
}

function transitionEvents(previous: FastStateSnapshot, current: FastStateSnapshot): readonly FastStateTransitionEvent[] {
  const currentInactiveReason = inactiveReason(current);
  const wasRequestedInactive = inactiveReason(previous) !== undefined;

  if (currentInactiveReason === undefined || wasRequestedInactive) {
    return [];
  }

  return [
    {
      kind: "requested-fast-inactive",
      reason: currentInactiveReason,
      currentModelKey: current.currentModelKey,
    },
  ];
}

export class FastStateEngine {
  private desiredActive: boolean;
  private currentModel: FastModelIdentity | undefined;
  private supportedModels: ReadonlySet<string>;

  constructor(options: FastStateEngineOptions) {
    this.desiredActive = options.startupFastOverride === true ? true : options.desiredActive;
    this.currentModel = options.currentModel;
    this.supportedModels = new Set(options.supportedModels);
  }

  snapshot(): FastStateSnapshot {
    return {
      desiredActive: this.desiredActive,
      active: this.desiredActive && isSupportedFastModel(this.currentModel, this.supportedModels),
      currentModelKey: fastModelKey(this.currentModel),
    };
  }

  transition(update: FastStateUpdate): FastStateTransition {
    const previous = this.snapshot();

    if (hasOwnField(update, "desiredActive")) {
      this.desiredActive = update.desiredActive === true;
    }

    if (update.startupFastOverride === true) {
      this.desiredActive = true;
    }

    if (hasOwnField(update, "currentModel")) {
      this.currentModel = update.currentModel;
    }

    if (hasOwnField(update, "supportedModels")) {
      this.supportedModels = new Set(update.supportedModels ?? []);
    }

    const current = this.snapshot();
    return { previous, current, events: transitionEvents(previous, current) };
  }

  setDesiredActive(desiredActive: boolean): FastStateSnapshot {
    return this.transition({ desiredActive }).current;
  }

  toggleDesiredActive(): FastStateSnapshot {
    return this.setDesiredActive(!this.desiredActive);
  }

  setCurrentModel(model: FastModelIdentity | undefined): FastStateSnapshot {
    return this.transition({ currentModel: model }).current;
  }

  setSupportedModels(supportedModels: readonly string[]): FastStateSnapshot {
    return this.transition({ supportedModels }).current;
  }
}
