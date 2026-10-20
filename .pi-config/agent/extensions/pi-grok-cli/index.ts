import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerGrokCli } from "./src/provider/register.ts";

export { registerGrokCli } from "./src/provider/register.ts";

export default function piGrokCli(pi: ExtensionAPI): void {
  registerGrokCli(pi);
}
