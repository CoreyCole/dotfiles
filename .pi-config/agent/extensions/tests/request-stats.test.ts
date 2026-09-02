import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { requestStatsTest } from "../request-stats.ts";

function stateRoot() {
  return mkdtempSync(join(tmpdir(), "pi-request-stats-"));
}

test("accumulates exact weighted provider/model buckets across restart", async () => {
  const root = stateRoot();
  try {
    await requestStatsTest.updateRequestStatsAggregate(
      "one",
      "openai",
      "a",
      10,
      1000,
      root,
    );
    await requestStatsTest.updateRequestStatsAggregate(
      "one",
      "openai",
      "a",
      90,
      9000,
      root,
    );
    await requestStatsTest.updateRequestStatsAggregate(
      "one",
      "openai",
      "b",
      100,
      2000,
      root,
    );
    await requestStatsTest.updateRequestStatsAggregate(
      "one",
      "other",
      "a",
      100,
      4000,
      root,
    );
    const state = await requestStatsTest.readRequestStatsAggregate("one", root);
    assert.deepEqual(state?.buckets, [
      {
        provider: "openai",
        model: "a",
        outputTokens: 100,
        generationMs: 10000,
      },
      { provider: "openai", model: "b", outputTokens: 100, generationMs: 2000 },
      { provider: "other", model: "a", outputTokens: 100, generationMs: 4000 },
    ]);
    assert.equal(
      state!.buckets[0].outputTokens / (state!.buckets[0].generationMs / 1000),
      10,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("uses private atomic sidecars and isolates parallel sessions", async () => {
  const root = stateRoot();
  try {
    await Promise.all([
      requestStatsTest.updateRequestStatsAggregate("one", "p", "m", 1, 1, root),
      requestStatsTest.updateRequestStatsAggregate("two", "p", "m", 2, 2, root),
    ]);
    const one = requestStatsTest.requestStatsSidecarPath("one", root);
    const two = requestStatsTest.requestStatsSidecarPath("two", root);
    assert.notEqual(one, two);
    assert.equal(statSync(join(root, "sessions")).mode & 0o777, 0o700);
    assert.equal(statSync(one).mode & 0o777, 0o600);
    assert.match(readFileSync(one, "utf8"), /"sessionId":"one"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid state is unavailable and is replaced by the next valid response", async () => {
  const root = stateRoot();
  try {
    const file = requestStatsTest.requestStatsSidecarPath("one", root);
    const fs = await import("node:fs/promises");
    await fs.mkdir(join(root, "sessions"), { recursive: true });
    for (const invalid of [
      "{",
      JSON.stringify({ version: 2, sessionId: "one", buckets: [] }),
      JSON.stringify({ version: 1, sessionId: "wrong", buckets: [] }),
      JSON.stringify({
        version: 1,
        sessionId: "one",
        buckets: [
          {
            provider: "p",
            model: "m",
            outputTokens: Infinity,
            generationMs: 1,
          },
        ],
      }),
    ]) {
      await fs.writeFile(file, invalid);
      assert.equal(
        await requestStatsTest.readRequestStatsAggregate("one", root),
        undefined,
      );
      await requestStatsTest.updateRequestStatsAggregate(
        "one",
        "p",
        "m",
        3,
        4,
        root,
      );
      assert.deepEqual(
        (await requestStatsTest.readRequestStatsAggregate("one", root))
          ?.buckets,
        [{ provider: "p", model: "m", outputTokens: 3, generationMs: 4 }],
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
