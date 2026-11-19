export interface FastModelIdentity {
  provider: unknown;
  id: unknown;
}

export function fastModelKey(
  model: FastModelIdentity | undefined,
): string | undefined {
  if (
    !model ||
    typeof model.provider !== "string" ||
    typeof model.id !== "string"
  ) {
    return undefined;
  }

  return `${model.provider}/${model.id}`;
}

function matchesSupportedModel(entry: string, currentKey: string): boolean {
  if (!entry.endsWith("*")) {
    return entry === currentKey;
  }

  const prefix = entry.slice(0, -1);
  return prefix.length > 0 && currentKey.startsWith(prefix);
}

export function isSupportedFastModel(
  model: FastModelIdentity | undefined,
  supportedModels: ReadonlySet<string>,
): boolean {
  const currentKey = fastModelKey(model);
  if (currentKey === undefined) {
    return false;
  }

  for (const entry of supportedModels) {
    if (matchesSupportedModel(entry, currentKey)) {
      return true;
    }
  }

  return false;
}
