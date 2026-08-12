import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { FAST_FLAG } from "./capabilities.ts";

export type StartupFastOverrideRegistrationAPI = Pick<ExtensionAPI, "registerFlag">;
export type StartupFastOverrideReaderAPI = Pick<ExtensionAPI, "getFlag">;

export function registerStartupFastOverrideFlag(pi: StartupFastOverrideRegistrationAPI): void {
  pi.registerFlag(FAST_FLAG, {
    description: "Start this session with Fast Mode enabled",
    type: "boolean",
    default: false,
  });
}

export function isStartupFastOverrideRequested(pi: StartupFastOverrideReaderAPI): boolean {
  return pi.getFlag(FAST_FLAG) === true;
}
