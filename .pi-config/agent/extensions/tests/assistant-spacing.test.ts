import assert from "node:assert/strict";
import test from "node:test";
import { AssistantMessageComponent } from "@earendil-works/pi-coding-agent";
import assistantRenderer from "../assistant-renderer.ts";
import toolBorder from "../tool-border.ts";

assistantRenderer({} as never);
toolBorder({} as never);

function visible(line: string): string {
  return line
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
}

test("thinking before tools has no leading blank lines", () => {
  const component = new AssistantMessageComponent({
    role: "assistant",
    content: [
      {
        type: "thinking",
        thinking:
          'The user asked "how do I navigate machines". From the docs:\n',
      },
      {
        type: "toolCall",
        id: "1",
        name: "bash",
        arguments: { command: "echo hi" },
      },
    ],
    stopReason: "toolUse",
  } as never);

  const lines = component.render(80);
  assert.ok(lines.length > 0);
  assert.notEqual(visible(lines[0]).trim(), "");
  assert.match(visible(lines[0]), /│/);
  assert.equal(
    lines.filter((line) => visible(line).trim() === "").length,
    0,
  );
});

test("thinking before text starts on the first line", () => {
  const component = new AssistantMessageComponent({
    role: "assistant",
    content: [
      {
        type: "thinking",
        thinking:
          "The user has two saved machines. Navigation is via the sidebar.",
      },
      {
        type: "text",
        text: "Click a machine, or one of its workspaces.",
      },
    ],
    stopReason: "stop",
  } as never);

  const lines = component.render(80);
  assert.notEqual(visible(lines[0]).trim(), "");
  assert.match(visible(lines[0]), /│/);
});
