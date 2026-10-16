import assert from "node:assert/strict";
import test from "node:test";
import {
  createReadToolDefinition,
  initTheme,
  ToolExecutionComponent,
} from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import toolBorder from "../tool-border.ts";

toolBorder({} as never);
initTheme("dark");

const cwd = "/home/coreycole/cn/chestnut-flake/monorepo";
const path =
  "/home/coreycole/cn/chestnut-flake/monorepo/.agents/skills/snowflake-cli/SKILL.md";

function visible(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
}

function renderRead(expanded: boolean, isError = false): string {
  const component = new ToolExecutionComponent(
    "read",
    "read-1",
    { path, offset: 1, limit: 80 },
    {},
    createReadToolDefinition(cwd),
    { requestRender() {} } as TUI,
    cwd,
  );
  component.updateResult(
    {
      content: [
        {
          type: "text",
          text: isError
            ? "No such file"
            : "---\nname: snowflake-cli\nsecret body\n",
        },
      ],
      details: undefined,
      isError,
    },
    false,
  );
  component.setExpanded(expanded);
  return visible(component.render(120).join("\n"));
}

test("collapsed read shows the formatted path and not the file body", () => {
  const text = renderRead(false);
  assert.match(
    text,
    /📖 chestnut-flake\/monorepo\/\.agents\/skills\/snowflake-cli\/SKILL\.md:1-80/,
  );
  assert.doesNotMatch(text, /secret body/);
  assert.doesNotMatch(text, /name: snowflake-cli/);
});

test("expanded read does not dump the file body into the session view", () => {
  const text = renderRead(true);
  assert.match(
    text,
    /📖 chestnut-flake\/monorepo\/\.agents\/skills\/snowflake-cli\/SKILL\.md:1-80/,
  );
  assert.doesNotMatch(text, /secret body/);
  assert.doesNotMatch(text, /name: snowflake-cli/);
});

test("read errors stay visible", () => {
  const text = renderRead(true, true);
  assert.match(text, /📖 /);
  assert.match(text, /SKILL\.md:1-80/);
  assert.match(text, /No such file/);
});
