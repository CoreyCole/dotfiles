export interface FastModelIdentity {
  provider: unknown;
  id: unknown;
}

export function fastModelKey(model: FastModelIdentity | undefined): string | undefined {
  if (!model || typeof model.provider !== "string" || typeof model.id !== "string") {
    return undefined;
  }

  return `${model.provider}/${model.id}`;
}

export function isSupportedFastModel(
  model: FastModelIdentity | undefined,
  supportedModels: ReadonlySet<string>,
): boolean {
  const currentKey = fastModelKey(model);
  return currentKey !== undefined && supportedModels.has(currentKey);
}
