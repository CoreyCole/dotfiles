export const PRIORITY_SERVICE_TIER = "priority";

export interface FastActivationState {
  active: boolean;
}

export type ProviderPayload = Record<string, unknown>;

function isRecordPayload(payload: unknown): payload is ProviderPayload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(payload);
  return prototype === Object.prototype || prototype === null;
}

export class ServiceTierInjector {
  inject(payload: unknown, state: FastActivationState): unknown {
    if (!state.active || !isRecordPayload(payload)) {
      return payload;
    }

    return { ...payload, service_tier: PRIORITY_SERVICE_TIER };
  }
}
