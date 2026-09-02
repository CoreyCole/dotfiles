export const PRIORITY_SERVICE_TIER = "priority";

export interface FastActivationState {
  active: boolean;
}

export interface FastRequestModel {
  api: unknown;
  id: unknown;
}

export type ProviderPayload = Record<string, unknown>;

const SUPPORTED_FAST_APIS = new Set([
  "openai-completions",
  "openai-responses",
  "openai-codex-responses",
]);

function isRecordPayload(payload: unknown): payload is ProviderPayload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(payload);
  return prototype === Object.prototype || prototype === null;
}

export class ServiceTierInjector {
  inject(payload: unknown, state: FastActivationState, model: FastRequestModel | undefined): unknown {
    if (
      !state.active ||
      !isRecordPayload(payload) ||
      typeof model?.api !== "string" ||
      typeof model.id !== "string" ||
      !SUPPORTED_FAST_APIS.has(model.api) ||
      payload.model !== model.id ||
      Object.hasOwn(payload, "service_tier")
    ) {
      return payload;
    }

    return { ...payload, service_tier: PRIORITY_SERVICE_TIER };
  }
}
