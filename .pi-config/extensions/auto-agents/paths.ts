import { accessSync, constants, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ResolvedReadTarget } from "./types";

const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const NARROW_NO_BREAK_SPACE = "\u202F";

function normalizeUnicodeSpaces(value: string): string {
  return value.replace(UNICODE_SPACES, " ");
}

function normalizeAtPrefix(filePath: string): string {
  return filePath.startsWith("@") ? filePath.slice(1) : filePath;
}

function expandPath(filePath: string): string {
  const normalized = normalizeUnicodeSpaces(normalizeAtPrefix(filePath));
  if (normalized === "~") return os.homedir();
  if (normalized.startsWith("~/")) return os.homedir() + normalized.slice(1);
  return normalized;
}

function fileExists(filePath: string): boolean {
  try {
    accessSync(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function tryMacOSScreenshotPath(filePath: string): string {
  return filePath.replace(/ (AM|PM)\./gi, `${NARROW_NO_BREAK_SPACE}$1.`);
}

function tryNFDVariant(filePath: string): string {
  return filePath.normalize("NFD");
}

function tryCurlyQuoteVariant(filePath: string): string {
  return filePath.replace(/'/g, "\u2019");
}

function resolveToCwd(filePath: string, cwd: string): string {
  const expanded = expandPath(filePath);
  if (path.isAbsolute(expanded)) return expanded;
  return path.resolve(cwd, expanded);
}

function resolveReadPath(filePath: string, cwd: string): string {
  const resolved = resolveToCwd(filePath, cwd);
  if (fileExists(resolved)) return resolved;

  const amPmVariant = tryMacOSScreenshotPath(resolved);
  if (amPmVariant !== resolved && fileExists(amPmVariant)) return amPmVariant;

  const nfdVariant = tryNFDVariant(resolved);
  if (nfdVariant !== resolved && fileExists(nfdVariant)) return nfdVariant;

  const curlyVariant = tryCurlyQuoteVariant(resolved);
  if (curlyVariant !== resolved && fileExists(curlyVariant)) return curlyVariant;

  const nfdCurlyVariant = tryCurlyQuoteVariant(nfdVariant);
  if (nfdCurlyVariant !== resolved && fileExists(nfdCurlyVariant)) return nfdCurlyVariant;

  return resolved;
}

export function resolveReadTarget(cwd: string, inputPath: string): ResolvedReadTarget {
  return {
    requestedPath: inputPath,
    absolutePath: resolveReadPath(inputPath, cwd),
  };
}

export function findAncestorAgentsFiles(targetPath: string): string[] {
  const files: string[] = [];
  let current = path.dirname(targetPath);

  while (true) {
    const candidate = path.join(current, "AGENTS.md");
    if (existsSync(candidate)) files.unshift(candidate);

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return files;
}
