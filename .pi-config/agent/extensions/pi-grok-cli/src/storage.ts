import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const homePath = () => process.env.HOME || homedir();

export const getAccountVaultPath = () =>
  process.env.PI_GROK_CLI_ACCOUNTS_PATH ||
  join(homePath(), ".local", "share", "pi-grok-cli", "accounts.json");

export function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export function writeJsonAtomic(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}
