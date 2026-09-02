import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { __test__ } from "../custom-footer.ts";
import { FAST_STATUS_KEY } from "../pi-fast/src/capabilities.ts";

test("session helpers format local start and wall-clock duration", () => {
  const previousTz = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const start = Date.UTC(2026, 7, 22, 4, 25);
    assert.equal(__test__.formatLocalHHMM(start), "21:25");
    assert.equal(__test__.formatElapsedDuration(0), "(00h 00m)");
    assert.equal(__test__.formatElapsedDuration(59 * 60_000), "(00h 59m)");
    assert.equal(
      __test__.formatElapsedDuration((2 * 60 + 14) * 60_000),
      "(02h 14m)",
    );
    assert.equal(
      __test__.formatElapsedDuration((23 * 60 + 59) * 60_000),
      "(23h 59m)",
    );
    assert.equal(
      __test__.formatElapsedDuration(24 * 60 * 60_000),
      "(1d 00h 00m)",
    );
    assert.equal(
      __test__.formatElapsedDuration((4 * 24 * 60 + 3 * 60 + 17) * 60_000),
      "(4d 03h 17m)",
    );
    assert.equal(
      __test__.formatSessionLine(start, start + 60_000),
      "21:25 (00h 01m)",
    );
    assert.equal(
      __test__.formatSessionLine(start, start + 121 * 60_000),
      "21:25 (02h 01m)",
    );
  } finally {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  }
});

test("invalid and future session timestamps do not produce a session line", () => {
  const now = Date.UTC(2026, 7, 22, 4, 25);
  assert.equal(__test__.parseSessionStartTime("invalid", now), undefined);
  assert.equal(
    __test__.parseSessionStartTime(new Date(now + 1).toISOString(), now),
    undefined,
  );
  assert.equal(__test__.formatSessionLine(undefined, now), undefined);
  assert.equal(__test__.formatSessionLine(now + 1, now), undefined);
});

test("MCP status classification ignores ANSI styling but preserves display text", () => {
  const zero = "\x1b[31mMCP: 0/2 servers\x1b[0m";
  const connected = "\x1b[32mMCP: 1/2 servers\x1b[0m";
  assert.equal(__test__.stripAnsiSgr(zero), "MCP: 0/2 servers");
  assert.equal(__test__.shouldShowStatusText("MCP: 0/2 servers"), false);
  assert.equal(__test__.shouldShowStatusText(zero), false);
  assert.equal(__test__.shouldShowStatusText(connected), true);
  assert.equal(__test__.sanitizeStatusText(connected), connected);
});

type FooterComponent = {
  dispose(): void;
  render(width: number): string[];
};

type FooterFactory = (
  tui: { requestRender(): void },
  theme: { fg(name: string, text: string): string },
  data: {
    onBranchChange(callback: () => void): () => void;
    getExtensionStatuses(): Map<string, string>;
  },
) => FooterComponent;

type FooterOptions = {
  sessionId?: string;
  provider?: string;
  model?: string;
  stateDir?: string;
};

function writeAggregate(
  stateDir: string,
  sessionId: string,
  buckets: {
    provider: string;
    model: string;
    outputTokens: number;
    generationMs: number;
  }[],
) {
  mkdirSync(join(stateDir, "sessions"), { recursive: true });
  writeFileSync(
    join(stateDir, "sessions", `${sessionId}.json`),
    `${JSON.stringify({ version: 1, sessionId, buckets })}\n`,
  );
}

function createFooter(
  statuses: Map<string, string>,
  options: FooterOptions = {},
) {
  let factory: FooterFactory | undefined;
  const start = Date.now() - 90 * 60_000;
  const sessionId = options.sessionId ?? "footer-test-session";
  const stateDir = options.stateDir;
  const ctx = {
    hasUI: true,
    model: {
      id: options.model ?? "test-model",
      provider: options.provider ?? "openai",
      contextWindow: 100_000,
    },
    getContextUsage() {
      return { tokens: 1_000, contextWindow: 100_000, percent: 1 };
    },
    sessionManager: {
      getSessionId() {
        return sessionId;
      },
      getHeader() {
        return { timestamp: new Date(start).toISOString() };
      },
      getEntries() {
        return [];
      },
    },
    ui: {
      setFooter(value: FooterFactory) {
        factory = value;
      },
    },
  } as unknown as ExtensionContext;
  const pi = {
    getThinkingLevel() {
      return "high";
    },
  } as unknown as ExtensionAPI;

  __test__.installFooter(pi, ctx, stateDir);
  assert.ok(factory);

  let branchDisposed = false;
  let renders = 0;
  const component = factory(
    { requestRender: () => renders++ },
    { fg: (_name, text) => text },
    {
      onBranchChange: () => () => {
        branchDisposed = true;
      },
      getExtensionStatuses: () => statuses,
    },
  );
  return {
    component,
    get branchDisposed() {
      return branchDisposed;
    },
    get renders() {
      return renders;
    },
  };
}

test("footer places the session line directly above stats and filters MCP statuses", () => {
  const connected = "\x1b[32mMCP: 1/2 servers\x1b[0m";
  const footer = createFooter(
    new Map([
      ["empty-mcp", "\x1b[31mMCP: 0/2 servers\x1b[0m"],
      ["mcp", connected],
      ["other", "ready"],
    ]),
  );
  try {
    const lines = footer.component.render(100);
    assert.equal(lines.length, 3);
    assert.match(lines[0], /ready/);
    assert.equal(lines[0].includes(connected), true);
    assert.doesNotMatch(__test__.stripAnsiSgr(lines[0]), /MCP: 0\/2/);
    assert.match(lines[1].trim(), /^\d{2}:\d{2} \(01h 30m\)$/);
    assert.equal(visibleWidth(lines[1]), 100);
    assert.match(lines[2], /test-model • high • —/);

    for (const width of [100, 20, 1]) {
      for (const line of footer.component.render(width)) {
        assert.ok(visibleWidth(line) <= Math.max(1, width));
      }
    }
  } finally {
    footer.component.dispose();
  }
});

test("footer clears its minute interval and branch subscription on dispose", () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let nextTimer = 1;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  globalThis.setInterval = ((callback: () => void, delay: number) => {
    const id = nextTimer++;
    timers.set(id, { callback, delay });
    return id as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;
  globalThis.clearInterval = ((timer: ReturnType<typeof setInterval>) => {
    timers.delete(timer as unknown as number);
  }) as typeof clearInterval;

  try {
    const footer = createFooter(new Map());
    const delays = [...timers.values()]
      .map((timer) => timer.delay)
      .sort((left, right) => left - right);
    assert.deepEqual(delays, [1000, 60_000]);
    const sessionCallback = [...timers.values()].find(
      (timer) => timer.delay === 60_000,
    )?.callback;
    assert.ok(sessionCallback);
    sessionCallback();
    assert.equal(footer.renders, 1);
    footer.component.dispose();
    assert.equal(timers.size, 0);
    assert.equal(footer.branchDisposed, true);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

test("missing, invalid, and other-model aggregates show an em dash", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-footer-"));
  try {
    const missing = createFooter(new Map(), {
      sessionId: "missing",
      stateDir: root,
    });
    try {
      assert.match(
        missing.component.render(100).at(-1) ?? "",
        /test-model • high • —/,
      );
    } finally {
      missing.component.dispose();
    }

    mkdirSync(join(root, "sessions"), { recursive: true });
    writeFileSync(
      join(root, "sessions", "invalid.json"),
      JSON.stringify({ version: 2, sessionId: "invalid", buckets: [] }),
    );
    const invalid = createFooter(new Map(), {
      sessionId: "invalid",
      stateDir: root,
    });
    try {
      assert.match(
        invalid.component.render(100).at(-1) ?? "",
        /test-model • high • —/,
      );
    } finally {
      invalid.component.dispose();
    }

    writeAggregate(root, "other", [
      {
        provider: "openai",
        model: "other-model",
        outputTokens: 255,
        generationMs: 10_000,
      },
    ]);
    const other = createFooter(new Map(), {
      sessionId: "other",
      stateDir: root,
    });
    try {
      assert.match(
        other.component.render(100).at(-1) ?? "",
        /test-model • high • —/,
      );
    } finally {
      other.component.dispose();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("current provider/model bucket 255 tokens / 10000 ms shows 25.5 tok/s", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-footer-"));
  try {
    writeAggregate(root, "current", [
      {
        provider: "openai",
        model: "test-model",
        outputTokens: 255,
        generationMs: 10_000,
      },
    ]);
    const footer = createFooter(new Map(), {
      sessionId: "current",
      stateDir: root,
    });
    try {
      const stats = footer.component.render(100).at(-1) ?? "";
      assert.match(stats, /test-model • high • 25\.5 tok\/s/);
    } finally {
      footer.component.dispose();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("TPS is last after model, thinking, and optional fast", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-footer-"));
  try {
    writeAggregate(root, "fast", [
      {
        provider: "openai",
        model: "test-model",
        outputTokens: 255,
        generationMs: 10_000,
      },
    ]);
    const footer = createFooter(new Map([[FAST_STATUS_KEY, "fast"]]), {
      sessionId: "fast",
      stateDir: root,
    });
    try {
      assert.match(
        footer.component.render(100).at(-1) ?? "",
        /test-model • high • fast • 25\.5 tok\/s/,
      );
    } finally {
      footer.component.dispose();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("cached render performs no filesystem I/O", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-footer-"));
  try {
    writeAggregate(root, "cached", [
      {
        provider: "openai",
        model: "test-model",
        outputTokens: 255,
        generationMs: 10_000,
      },
    ]);
    const footer = createFooter(new Map(), {
      sessionId: "cached",
      stateDir: root,
    });
    try {
      assert.match(footer.component.render(100).at(-1) ?? "", /25\.5 tok\/s/);
      writeFileSync(join(root, "sessions", "cached.json"), "{");
      assert.match(footer.component.render(100).at(-1) ?? "", /25\.5 tok\/s/);
    } finally {
      footer.component.dispose();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("narrow widths keep the stats line within the terminal width", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-footer-"));
  try {
    writeAggregate(root, "width", [
      {
        provider: "openai",
        model: "test-model",
        outputTokens: 255,
        generationMs: 10_000,
      },
    ]);
    const footer = createFooter(new Map([[FAST_STATUS_KEY, "fast"]]), {
      sessionId: "width",
      stateDir: root,
    });
    try {
      for (const width of [100, 20, 1]) {
        for (const line of footer.component.render(width)) {
          assert.ok(visibleWidth(line) <= Math.max(1, width));
        }
      }
    } finally {
      footer.component.dispose();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
