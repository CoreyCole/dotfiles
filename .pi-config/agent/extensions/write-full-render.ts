import {
  createWriteToolDefinition,
  getMarkdownTheme,
  type AgentToolResult,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { isAbsolute, resolve } from "node:path";

type WriteArgs = { path?: string; file_path?: string; content?: string };

const BAT_ARGS = ["--color=always", "--style=plain", "--paging=never"];

function isMarkdownPath(path: string | undefined): path is string {
  return path !== undefined && /\.(md|markdown|txt)$/i.test(path);
}

function renderMarkdownWriteContent(content: string): Markdown {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return new Markdown(content, 0, 1, getMarkdownTheme());

  const yaml = frontmatter[1];
  const markdown = content.slice(frontmatter[0].length);
  return new Markdown(
    `\`\`\`yaml\n${yaml}\n\`\`\`\n\n${markdown}`,
    0,
    1,
    getMarkdownTheme(),
  );
}

function batPath(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

function renderWithBat(path: string, cwd: string): string | undefined {
  const bat = spawnSync("bat", [...BAT_ARGS, "--", batPath(path, cwd)], {
    encoding: "utf8",
    env: { ...process.env, CLICOLOR_FORCE: "1", NO_COLOR: undefined },
  });

  if (bat.error || bat.status !== 0 || !bat.stdout.trim()) return undefined;
  return bat.stdout.trimEnd();
}

export default function (pi: ExtensionAPI) {
  const write = createWriteToolDefinition(process.cwd());
  const originalExecute = write.execute.bind(write);
  const originalRenderCall = write.renderCall;
  const originalRenderResult = write.renderResult;
  const batOutputs = new Map<string, string>();
  if (!originalRenderCall)
    throw new Error("write tool renderCall is unavailable");

  pi.registerTool({
    ...write,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const result = await originalExecute(
        toolCallId,
        params,
        signal,
        onUpdate,
        ctx,
      );
      if (signal?.aborted) return result;

      const batOutput = renderWithBat(params.path, ctx.cwd);
      if (batOutput) batOutputs.set(toolCallId, batOutput);

      return result;
    },
    renderCall(args, theme, context) {
      const writeArgs = args as WriteArgs | undefined;
      const path = writeArgs?.file_path ?? writeArgs?.path;
      if (batOutputs.has(context.toolCallId)) {
        const text = context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
        text.setText(
          `${theme.fg("toolTitle", theme.bold("write"))} ${theme.fg("accent", path ?? "write")}`,
        );
        return text;
      }

      if (isMarkdownPath(path) && typeof writeArgs?.content === "string") {
        const component =
          context.lastComponent instanceof Container
            ? context.lastComponent
            : new Container();
        component.clear();
        component.addChild(
          new Text(
            `${theme.fg("toolTitle", theme.bold("write"))} ${theme.fg("accent", path)}`,
            0,
            0,
          ),
        );
        component.addChild(renderMarkdownWriteContent(writeArgs.content));
        return component;
      }

      return originalRenderCall(args, theme, { ...context, expanded: true });
    },
    renderResult(result, options, theme, context) {
      if (context.isError) {
        return originalRenderResult?.(result as AgentToolResult<undefined>, options, theme, context) ?? new Container();
      }

      const batOutput = batOutputs.get(context.toolCallId);
      if (!batOutput) {
        return originalRenderResult?.(result as AgentToolResult<undefined>, options, theme, context) ?? new Container();
      }

      const text = context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
      text.setText(`\n${batOutput}`);
      return text;
    },
  });
}
