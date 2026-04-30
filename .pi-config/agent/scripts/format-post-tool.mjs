#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const FORMATTERS_BY_EXTENSION = {
  ".lua": [{ command: "stylua", args: ["$FILENAME"] }],
  ".py": [
    { command: "isort", args: ["$FILENAME"] },
    { command: "black", args: ["$FILENAME"] },
  ],
  ".rs": [{ command: "rustfmt", args: ["$FILENAME"] }],
  ".json": [{ command: "prettierd", args: ["$FILENAME"], stdin: true }],
  ".js": [{ command: "prettierd", args: ["$FILENAME"], stdin: true }],
  ".mjs": [{ command: "prettierd", args: ["$FILENAME"], stdin: true }],
  ".cjs": [{ command: "prettierd", args: ["$FILENAME"], stdin: true }],
  ".ts": [{ command: "prettierd", args: ["$FILENAME"], stdin: true }],
  ".tsx": [{ command: "prettierd", args: ["$FILENAME"], stdin: true }],
  ".jsx": [{ command: "prettierd", args: ["$FILENAME"], stdin: true }],
  ".css": [{ command: "prettierd", args: ["$FILENAME"], stdin: true }],
  ".templ": [{ command: "templ", args: ["fmt", "-stdin-filepath", "$FILENAME"], stdin: true }],
  ".c": [{ command: "clang-format", args: ["-i", "$FILENAME"] }],
  ".h": [{ command: "clang-format", args: ["-i", "$FILENAME"] }],
  ".cc": [{ command: "clang-format", args: ["-i", "$FILENAME"] }],
  ".cpp": [{ command: "clang-format", args: ["-i", "$FILENAME"] }],
  ".cxx": [{ command: "clang-format", args: ["-i", "$FILENAME"] }],
  ".hh": [{ command: "clang-format", args: ["-i", "$FILENAME"] }],
  ".hpp": [{ command: "clang-format", args: ["-i", "$FILENAME"] }],
  ".hxx": [{ command: "clang-format", args: ["-i", "$FILENAME"] }],
  ".go": [{ command: "golangci-lint", args: ["fmt", "--stdin"], stdin: true, rootFiles: ["go.mod", "go.sum"] }],
  ".sh": [{ command: "shfmt", args: ["-w", "$FILENAME"] }],
  ".yaml": [{ command: "yamlfmt", args: ["$FILENAME"] }],
  ".yml": [{ command: "yamlfmt", args: ["$FILENAME"] }],
  ".swift": [{ command: "swiftformat", args: ["$FILENAME"] }],
  ".md": [{ command: "mdformat", args: ["$FILENAME"] }],
  ".markdown": [{ command: "mdformat", args: ["$FILENAME"] }],
  ".proto": [{ command: "buf", args: ["format", "-w", "$FILENAME"] }],
  ".sql": [{ command: "sqruff", args: ["fix", "$FILENAME"], allowedExitCodes: [0, 1] }],
  ".nix": [{ command: "alejandra", args: ["$FILENAME"] }],
};

function readStdin() {
  let input = "";
  process.stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
  });
}

function findRoot(startDir, rootFiles) {
  let current = path.resolve(startDir);
  while (true) {
    if (rootFiles.some((rootFile) => existsSync(path.join(current, rootFile)))) return current;

    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function expandArgs(args, filename) {
  return args.map((arg) => (arg === "$FILENAME" ? filename : arg));
}

function runFormatter(formatter, filename, fallbackCwd) {
  const cwd = formatter.rootFiles ? findRoot(path.dirname(filename), formatter.rootFiles) ?? path.dirname(filename) : fallbackCwd;
  const args = expandArgs(formatter.args, filename);
  const allowedExitCodes = formatter.allowedExitCodes ?? [0];

  if (!formatter.stdin) {
    spawnSync(formatter.command, args, { cwd, stdio: "ignore" });
    return;
  }

  const result = spawnSync(formatter.command, args, {
    cwd,
    input: readFileSync(filename),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  });

  if (allowedExitCodes.includes(result.status ?? 1)) {
    writeFileSync(filename, result.stdout, "utf8");
  }
}

const input = await readStdin();
let payload;
try {
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

if (payload.tool_response?.isError) process.exit(0);

const toolInput = payload.tool_input ?? {};
const rawPath = toolInput.path ?? toolInput.file_path;
if (typeof rawPath !== "string") process.exit(0);

const cwd = payload.cwd ?? process.cwd();
const filename = path.isAbsolute(rawPath) ? rawPath : path.join(cwd, rawPath);
const formatters = FORMATTERS_BY_EXTENSION[path.extname(filename).toLowerCase()];
if (!formatters) process.exit(0);

for (const formatter of formatters) {
  runFormatter(formatter, filename, cwd);
}
