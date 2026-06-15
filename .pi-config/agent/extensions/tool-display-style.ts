export const TOOL_DISPLAY = {
  dim: (text: string) => `\x1b[90m${text}\x1b[39m`,
  path: (text: string) => `\x1b[36m${text}\x1b[39m`,
  filename: (text: string) => `\x1b[33m${text}\x1b[39m`,
  lineNumber: (text: string) => `\x1b[35m${text}\x1b[39m`,
  border: (text: string) => `\x1b[90m${text}\x1b[39m`,
} as const;

export default function toolDisplayStyleExtension() {
  // Shared style constants for local extensions. This file lives in the
  // auto-discovered extensions directory, so it must export a valid factory.
}
