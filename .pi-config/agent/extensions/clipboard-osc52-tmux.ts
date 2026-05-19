import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TMUX_OSC52_SSH_MARKER = "pi-tmux-osc52";

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

export default function clipboardOsc52Tmux(_pi: ExtensionAPI) {
  enableOsc52CopyInTmux();
}
