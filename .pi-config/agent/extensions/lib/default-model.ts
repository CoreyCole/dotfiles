import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ModelRoute,
  ModelRouteRequest,
} from "@earendil-works/pi-coding-agent";

export const FAST_MODEL = { provider: "xai", id: "fast" } as const;

type ModelSettings = {
  defaultProvider?: string;
  defaultModel?: string;
  enabledModels?: string[];
};

function agentConfigDir(): string {
  return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

function readPiModelSettings(agentDir: string): ModelSettings {
  try {
    return JSON.parse(
      readFileSync(join(agentDir, "settings.json"), "utf8"),
    ) as ModelSettings;
  } catch {
    return {};
  }
}

function exactEnabledModelRef(entry: string): string | undefined {
  const ref = entry.split(":")[0]?.trim();
  if (!ref || !ref.includes("/") || /[*?]/.test(ref)) return undefined;
  return ref;
}

export function isFastModelRef(ref: string): boolean {
  const normalized = ref.trim().toLowerCase();
  return (
    normalized === FAST_MODEL.id ||
    normalized === `${FAST_MODEL.provider}/${FAST_MODEL.id}`
  );
}

export function isFastModel(model: { provider: string; id: string }): boolean {
  return (
    model.provider.toLowerCase() === FAST_MODEL.provider &&
    model.id.toLowerCase() === FAST_MODEL.id
  );
}

/** The model a new Pi session starts on. Not a pinned version. */
export function configuredDefaultModelRef(agentDir = agentConfigDir()): string {
  const settings = readPiModelSettings(agentDir);
  const saved =
    settings.defaultProvider && settings.defaultModel
      ? `${settings.defaultProvider}/${settings.defaultModel}`
      : undefined;
  const enabled = (settings.enabledModels ?? [])
    .filter((entry): entry is string => typeof entry === "string")
    .map(exactEnabledModelRef)
    .filter((entry): entry is string => !!entry);

  if (saved && enabled.includes(saved) && !isFastModelRef(saved)) return saved;
  const enabledPhysical = enabled.find((ref) => !isFastModelRef(ref));
  if (enabledPhysical) return enabledPhysical;
  if (saved && !isFastModelRef(saved)) return saved;

  const provider = process.env.PI_PROVIDER?.trim();
  const model = process.env.PI_MODEL?.trim();
  if (
    provider &&
    model &&
    !model.includes("/") &&
    !isFastModelRef(`${provider}/${model}`)
  ) {
    return `${provider}/${model}`;
  }

  throw new Error(
    "No Pi default model is set. Set defaultProvider and defaultModel in settings.json.",
  );
}

export function routeFastModel(
  request: Pick<
    ModelRouteRequest,
    "reason" | "thinkingLevel" | "previous" | "failed"
  >,
  findModel: (provider: string, id: string) => Model<Api> | undefined,
  defaultRef = configuredDefaultModelRef(),
): ModelRoute {
  const sticky =
    request.failed ??
    (request.reason === "continuation" || request.reason === "retry"
      ? request.previous
      : undefined);
  if (sticky && !isFastModel(sticky.model)) {
    return {
      model: sticky.model,
      thinkingLevel: sticky.thinkingLevel ?? request.thinkingLevel,
    };
  }

  const slash = defaultRef.indexOf("/");
  const model = findModel(
    defaultRef.slice(0, slash),
    defaultRef.slice(slash + 1),
  );
  if (!model || isFastModel(model)) {
    throw new Error(`Pi default model "${defaultRef}" is not available.`);
  }
  return { model, thinkingLevel: request.thinkingLevel };
}
