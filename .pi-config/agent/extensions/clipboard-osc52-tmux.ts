import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TMUX_OSC52_SSH_MARKER = "pi-tmux-osc52";
const OSC52_CLIPBOARD_PATTERN = /\x1b\]52;[^;]*;([^\x07\x1b]*)(?:\x07|\x1b\\)/;
const TMUX_OSC52_BRIDGE_INSTALLED = Symbol.for("pi.tmuxOsc52BridgeInstalled");

function enableOsc52CopyInTmux() {
  if (!process.env.TMUX) return;
  if (
    process.env.SSH_CONNECTION ||
    process.env.SSH_CLIENT ||
    process.env.MOSH_CONNECTION
  )
    return;

  process.env.SSH_CONNECTION = `${TMUX_OSC52_SSH_MARKER} 0 ${TMUX_OSC52_SSH_MARKER} 0`;
}

function installTmuxOsc52ClipboardBridge() {
  if (!process.env.TMUX) return;
  if ((process.stdout as unknown as Record<symbol, boolean>)[TMUX_OSC52_BRIDGE_INSTALLED]) return;

  (process.stdout as unknown as Record<symbol, boolean>)[TMUX_OSC52_BRIDGE_INSTALLED] = true;
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
  enableOsc52CopyInTmux();
  installTmuxOsc52ClipboardBridge();
}
