import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TMUX_OSC52_SSH_MARKER = "pi-tmux-osc52";
const HERDR_OSC52_SSH_MARKER = "pi-herdr-osc52";
const OSC52_CLIPBOARD_PATTERN = /\x1b\]52;[^;]*;([^\x07\x1b]*)(?:\x07|\x1b\\)/;
const TMUX_OSC52_BRIDGE_INSTALLED = Symbol.for("pi.tmuxOsc52BridgeInstalled");

function hasRemoteClipboardEnv(): boolean {
  return Boolean(
    process.env.SSH_CONNECTION ||
    process.env.SSH_CLIENT ||
    process.env.MOSH_CONNECTION,
  );
}

function inHerdr(): boolean {
  return Boolean(process.env.HERDR_ENV);
}

function enableOsc52Copy() {
  if (hasRemoteClipboardEnv()) return;
  if (!inHerdr() && !process.env.TMUX) return;

  const marker = inHerdr() ? HERDR_OSC52_SSH_MARKER : TMUX_OSC52_SSH_MARKER;
  process.env.SSH_CONNECTION = `${marker} 0 ${marker} 0`;
}

function shouldInstallTmuxOsc52Bridge(): boolean {
  return Boolean(process.env.TMUX) && !inHerdr();
}

function installTmuxOsc52ClipboardBridge() {
  if (!shouldInstallTmuxOsc52Bridge()) return;
  if (
    (process.stdout as unknown as Record<symbol, boolean>)[
      TMUX_OSC52_BRIDGE_INSTALLED
    ]
  )
    return;

  (process.stdout as unknown as Record<symbol, boolean>)[
    TMUX_OSC52_BRIDGE_INSTALLED
  ] = true;
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: unknown, ...args: unknown[]) => {
    const text =
      typeof chunk === "string"
        ? chunk
        : Buffer.isBuffer(chunk)
          ? chunk.toString("utf8")
          : undefined;
    const match = text?.match(OSC52_CLIPBOARD_PATTERN);

    if (match) {
      const clipboardText = Buffer.from(match[1], "base64");
      const result = spawnSync("tmux", ["load-buffer", "-w", "-"], {
        input: clipboardText,
        stdio: ["pipe", "ignore", "ignore"],
      });

      if (result.status === 0) return true;
    }

    return originalWrite(chunk as never, ...(args as never[]));
  }) as typeof process.stdout.write;
}

export default function clipboardOsc52Tmux(_pi: ExtensionAPI) {
  enableOsc52Copy();
  installTmuxOsc52ClipboardBridge();
}

export const clipboardOsc52Test = {
  enableOsc52Copy,
  shouldInstallTmuxOsc52Bridge,
};
