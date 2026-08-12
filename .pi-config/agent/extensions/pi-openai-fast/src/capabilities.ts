export const FAST_EXTENSION_CAPABILITIES = [
  "fast-mode",
  "footer-status-feedback",
] as const;

export type FastExtensionCapability = (typeof FAST_EXTENSION_CAPABILITIES)[number];

export const FAST_COMMAND = "fast";
export const FAST_FLAG = "fast";
export const FAST_STATUS_KEY = "pi-openai-fast";
