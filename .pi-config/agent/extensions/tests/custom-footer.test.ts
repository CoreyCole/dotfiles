import assert from "node:assert/strict";
import test from "node:test";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { __test__ } from "../custom-footer.ts";

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

function createFooter(statuses: Map<string, string>) {
  let factory: FooterFactory | undefined;
  const start = Date.now() - 90 * 60_000;
  const ctx = {
    hasUI: true,
    model: { id: "test-model", contextWindow: 100_000 },
    getContextUsage() {
      return { tokens: 1_000, contextWindow: 100_000, percent: 1 };
    },
    sessionManager: {
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

  __test__.installFooter(pi, ctx);
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
    assert.match(lines[2], /test-model • high/);

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
  let intervalCallback: (() => void) | undefined;
  let cleared = false;
  globalThis.setInterval = ((callback: () => void, delay: number) => {
    assert.equal(delay, 60_000);
    intervalCallback = callback;
    return 123 as unknown as ReturnType<typeof setInterval>;
  }) as typeof setInterval;
  globalThis.clearInterval = ((timer: ReturnType<typeof setInterval>) => {
    assert.equal(timer, 123);
    cleared = true;
  }) as typeof clearInterval;

  try {
    const footer = createFooter(new Map());
    assert.ok(intervalCallback);
    intervalCallback();
    assert.equal(footer.renders, 1);
    footer.component.dispose();
    assert.equal(cleared, true);
    assert.equal(footer.branchDisposed, true);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});
