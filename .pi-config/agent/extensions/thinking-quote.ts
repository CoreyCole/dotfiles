import { AssistantMessageComponent, getMarkdownTheme, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";
const PATCHED = Symbol.for("corey.thinkingQuotePatched");

class ThinkingQuoteBlock {
  constructor(private text: string) {}

  invalidate() {}

  render(width: number): string[] {
    const prefix = "\x1b[90m│ \x1b[39m";
    const contentWidth = Math.max(1, width - 3);
    const lines: string[] = [];

    for (const rawLine of this.text.split("\n")) {
      const wrapped = wrapTextWithAnsi(rawLine, contentWidth);
      for (const line of wrapped) {
        lines.push(
          truncateToWidth(`${prefix}\x1b[90m${line}\x1b[39m`, width, ""),
        );
      }
    }

    return lines.length > 0 ? lines : [prefix];
  }
}

function patchAssistantThinking() {
  const proto = AssistantMessageComponent.prototype as any;
  if (proto[PATCHED]) return;
  proto[PATCHED] = true;

  proto.render = function render(width: number): string[] {
    const lines = Container.prototype.render.call(this, width);
    if (this.hasToolCalls || lines.length === 0) return lines;
    lines[0] = OSC133_ZONE_START + lines[0];
    lines[lines.length - 1] =
      OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[lines.length - 1];
    return lines;
  };

  proto.updateContent = function updateContent(message: any) {
    this.lastMessage = message;
    this.contentContainer.clear();

    const hasVisibleContent = message.content.some(
      (c: any) =>
        (c.type === "text" && c.text.trim()) ||
        (c.type === "thinking" && c.thinking.trim()),
    );
    if (hasVisibleContent) this.contentContainer.addChild(new Spacer(1));

    const markdownTheme = this.markdownTheme ?? getMarkdownTheme();

    for (let i = 0; i < message.content.length; i++) {
      const content = message.content[i];
      if (content.type === "text" && content.text.trim()) {
        this.contentContainer.addChild(
          new Markdown(content.text.trim(), 1, 0, markdownTheme),
        );
      } else if (content.type === "thinking" && content.thinking.trim()) {
        const hasVisibleContentAfter = message.content
          .slice(i + 1)
          .some(
            (c: any) =>
              (c.type === "text" && c.text.trim()) ||
              (c.type === "thinking" && c.thinking.trim()),
          );

        if (this.hideThinkingBlock) {
          this.contentContainer.addChild(new Text(this.hiddenThinkingLabel, 1, 0));
        } else {
          this.contentContainer.addChild(
            new ThinkingQuoteBlock(content.thinking.trim()),
          );
        }

        if (hasVisibleContentAfter) this.contentContainer.addChild(new Spacer(1));
      }
    }

    const hasToolCalls = message.content.some((c: any) => c.type === "toolCall");
    this.hasToolCalls = hasToolCalls;
    if (hasToolCalls) return;

    if (message.stopReason === "aborted") {
      const abortMessage =
        message.errorMessage && message.errorMessage !== "Request was aborted"
          ? message.errorMessage
          : "Operation aborted";
      this.contentContainer.addChild(new Spacer(1));
      this.contentContainer.addChild(new Text(abortMessage, 1, 0));
    } else if (message.stopReason === "error") {
      const errorMsg = message.errorMessage || "Unknown error";
      this.contentContainer.addChild(new Spacer(1));
      this.contentContainer.addChild(new Text(`Error: ${errorMsg}`, 1, 0));
    }
  };
}

export default function (_pi: ExtensionAPI) {
  patchAssistantThinking();
}
