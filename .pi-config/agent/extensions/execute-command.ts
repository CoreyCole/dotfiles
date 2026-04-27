import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  // Queue of commands/messages to handle after agent turn ends
  let pendingCommand: { command: string; reason?: string } | null = null;

  // Tool to send follow-up messages or trigger supported interactive flows
  pi.registerTool({
    name: "execute_command",
    label: "Execute Command",
    description: `Send a follow-up message after the current agent turn, or open a supported interactive flow. Use this to:
- Self-invoke /answer after asking multiple questions
- Send follow-up prompts to yourself

Slash commands are not sent as user messages because that bypasses pi's slash-command parser. /answer is supported directly; other slash commands are placed in the editor for the user to run.`,
    parameters: Type.Object({
      command: Type.String({
        description: "The command or message to execute (e.g., '/answer' or any text). Other slash commands are placed in the editor for the user to run."
      }),
      reason: Type.Optional(
        Type.String({
          description: "Optional explanation for why you're executing this command (shown to user)"
        })
      ),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { command, reason } = params;

      // Store command to be executed after agent turn ends
      pendingCommand = { command, reason };

      const stopNotice = command === "/answer"
        ? "\n\nIMPORTANT: Stop now. /answer runs after this agent turn ends; do not continue with more tool calls in this turn."
        : "";
      const explanation = reason
        ? `Queued for execution: ${command}\nReason: ${reason}${stopNotice}`
        : `Queued for execution: ${command}${stopNotice}`;

      return {
        content: [{ type: "text", text: explanation }],
        details: {
          command,
          reason,
          queued: true,
        },
      };
    },
  });

  // Handle pending command/message after agent turn completes
  pi.on("agent_end", async (_event, ctx) => {
    if (pendingCommand) {
      const { command } = pendingCommand;
      pendingCommand = null;

      // Special handling for /answer via event bus (needs context)
      if (command === "/answer") {
        setTimeout(() => {
          pi.events.emit("trigger:answer", ctx);
        }, 100);
        return;
      }

      // Slash commands must go through the editor command parser. Sending them
      // with sendUserMessage turns them into model-visible text and can loop.
      if (command.startsWith("/")) {
        if (ctx.hasUI) {
          ctx.ui.setEditorText(command);
          ctx.ui.notify(`Press Enter to run: ${command}`, "info");
        }
        return;
      }

      pi.sendUserMessage(command);
    }
  });
}
