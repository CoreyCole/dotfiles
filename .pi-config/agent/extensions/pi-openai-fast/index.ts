import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPiOpenAIFast } from "./src/extension-lifecycle.ts";

export {
  FAST_COMMAND,
  FAST_EXTENSION_CAPABILITIES,
  FAST_FLAG,
  FAST_STATUS_KEY,
} from "./src/capabilities.ts";
export type { FastExtensionCapability } from "./src/capabilities.ts";
export { registerPiOpenAIFast } from "./src/extension-lifecycle.ts";

export default function piOpenAIFast(pi: ExtensionAPI): void {
  registerPiOpenAIFast(pi);
}
