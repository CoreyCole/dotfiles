export const PINNED_GROK_CLI_VERSION = "1.0.46";

export function grokCliModelHeaders(modelId: string): Record<string, string> {
  return {
    "x-grok-client-identifier": "grok-shell",
    "x-xai-token-auth": "xai-grok-cli",
    "x-grok-model-override": modelId,
  };
}

export function grokCliVersionHeaders(version = PINNED_GROK_CLI_VERSION): Record<string, string> {
  return {
    "User-Agent": `grok-shell/${version} (linux; x86_64)`,
    "x-grok-client-version": version,
  };
}
