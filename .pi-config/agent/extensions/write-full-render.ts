import {
  createWriteToolDefinition,
  getMarkdownTheme,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";

type WriteArgs = { path?: string; file_path?: string; content?: string };

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

export default function (pi: ExtensionAPI) {
  const write = createWriteToolDefinition(process.cwd());
  const originalRenderCall = write.renderCall;
  if (!originalRenderCall)
    throw new Error("write tool renderCall is unavailable");

  pi.registerTool({
    ...write,
    renderCall(args, theme, context) {
      const writeArgs = args as WriteArgs | undefined;
      const path = writeArgs?.file_path ?? writeArgs?.path;
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
  });
}
