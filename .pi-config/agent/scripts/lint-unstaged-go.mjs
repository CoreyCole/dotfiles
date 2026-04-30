#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
}

function outputAdditionalContext(text) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "Stop",
        additionalContext: text,
      },
    }),
  );
}

function readNullSeparated(stdout) {
  return stdout.split("\0").filter(Boolean);
}

function gitFiles(gitRoot, args) {
  const result = run("git", ["-C", gitRoot, ...args], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return [];

  return readNullSeparated(result.stdout);
}

function findGoModRoot(file, gitRoot) {
  let current = path.dirname(file);
  const stop = path.dirname(gitRoot);

  while (current !== stop) {
    if (existsSync(path.join(current, "go.mod"))) return current;

    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }

  return undefined;
}

function truncate(text, maxLength = 12000) {
  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength)}\n... truncated ...`;
}

function indent(text) {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function formatFiles(files) {
  return files.map((file) => `  - ${file}`).join("\n");
}

function formatCommand(modulePath, files) {
  const prefix = modulePath === "." ? "" : `cd ${modulePath} && `;
  return `${prefix}golangci-lint run ${files.join(" ")}`;
}

function formatFailure(gitRoot, moduleRoot, moduleFiles, result) {
  const modulePath = path.relative(gitRoot, moduleRoot) || ".";
  const output = [result.stdout.trim(), result.stderr.trim()]
    .filter(Boolean)
    .join("\n");

  return [
    `Module: ${modulePath}`,
    "Command:",
    `  ${formatCommand(modulePath, moduleFiles)}`,
    "Files:",
    formatFiles(moduleFiles),
    "Output:",
    indent(output || `golangci-lint exited with status ${result.status ?? 1}`),
  ].join("\n");
}

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const rootResult = run("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
  stdio: ["ignore", "pipe", "ignore"],
});
if (rootResult.status !== 0) process.exit(0);

const gitRoot = rootResult.stdout.trim();
const modified = gitFiles(gitRoot, [
  "diff",
  "--name-only",
  "--diff-filter=ACMRT",
  "-z",
  "--",
  "*.go",
]);
const untracked = gitFiles(gitRoot, [
  "ls-files",
  "--others",
  "--exclude-standard",
  "-z",
  "--",
  "*.go",
]);
const files = [...new Set([...modified, ...untracked])]
  .map((file) => path.join(gitRoot, file))
  .filter((file) => existsSync(file));

if (files.length === 0) process.exit(0);

const filesByModuleDir = new Map();
for (const file of files) {
  const moduleRoot = findGoModRoot(file, gitRoot);
  if (!moduleRoot) continue;

  const moduleFile = path.relative(moduleRoot, file);
  const moduleDir = path.dirname(moduleFile);
  const moduleDirs = filesByModuleDir.get(moduleRoot) ?? new Map();
  const list = moduleDirs.get(moduleDir) ?? [];
  list.push(moduleFile);
  moduleDirs.set(moduleDir, list);
  filesByModuleDir.set(moduleRoot, moduleDirs);
}

const failures = [];
for (const [moduleRoot, moduleDirs] of filesByModuleDir) {
  for (const moduleFiles of moduleDirs.values()) {
    const result = run("golangci-lint", ["run", ...moduleFiles], {
      cwd: moduleRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (result.status !== 0) {
      failures.push(formatFailure(gitRoot, moduleRoot, moduleFiles, result));
    }
  }
}

if (failures.length > 0) {
  outputAdditionalContext(
    truncate(
      [
        "Go lint found issues in unstaged files.",
        "Fix these before finishing the task.",
        failures.join("\n\n---\n\n"),
      ].join("\n\n"),
    ),
  );
}
