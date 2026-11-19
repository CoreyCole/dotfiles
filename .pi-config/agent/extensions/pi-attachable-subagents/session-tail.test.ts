import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readNewSessionEntries, sessionFileSize } from "./session.ts";

test("session tail reads only bytes appended after the cursor", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-session-tail-"));
  const sessionFile = join(dir, "child.jsonl");
  const line = (id: string) => JSON.stringify({ type: "custom", id });
  try {
    writeFileSync(sessionFile, `${line("old")}\n`);
    const start = sessionFileSize(sessionFile);
    assert.ok(start > 0);

    writeFileSync(sessionFile, `${line("new")}\n`, { flag: "a" });
    const first = readNewSessionEntries(sessionFile, {
      offset: start,
      pending: Buffer.alloc(0),
    });
    assert.deepEqual(
      first.entries.map((entry) => entry.id),
      ["new"],
    );

    const second = readNewSessionEntries(sessionFile, first.cursor);
    assert.deepEqual(second.entries, []);

    writeFileSync(sessionFile, line("partial"), { flag: "a" });
    const held = readNewSessionEntries(sessionFile, second.cursor);
    assert.deepEqual(held.entries, []);

    writeFileSync(sessionFile, "\n", { flag: "a" });
    const finished = readNewSessionEntries(sessionFile, held.cursor);
    assert.deepEqual(
      finished.entries.map((entry) => entry.id),
      ["partial"],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
