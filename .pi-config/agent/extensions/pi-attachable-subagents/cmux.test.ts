import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  attachHerdrPane,
  attachTmuxPane,
  createHerdrSurface,
  createTmuxBackgroundWindow,
  detachHerdrPane,
  createTmuxHiddenSurface,
  detachTmuxPane,
  destroyTmuxHiddenOwner,
  ensureTmuxHiddenOwner,
  interpretStartupPaneError,
  sendTmuxPrompt,
  TMUX_HIDDEN_KEEPER_COMMAND,
  tmuxHiddenSessionName,
  getMuxBackend,
  type HerdrCommand,
  type TmuxCommand,
  type TmuxHiddenOwner,
} from "./cmux.ts";

function fakeTmux(outputs: Array<string | Error> = []) {
  const calls: string[][] = [];
  const execute: TmuxCommand = (args) => {
    calls.push(args);
    const next = outputs.shift();
    if (next instanceof Error) throw next;
    return next ?? "";
  };
  return { calls, execute };
}

function hiddenOwner(sessionName = "pi-hidden-parent"): TmuxHiddenOwner {
  return { sessionName, keeperPaneId: "%0" };
}

test("T1 T10 hidden session names include the parent id and stay nested-distinct", () => {
  assert.equal(tmuxHiddenSessionName("abc"), "pi-hidden-abc");
  assert.equal(tmuxHiddenSessionName("id:with.dots"), "pi-hidden-id-with-dots");
  assert.notEqual(
    tmuxHiddenSessionName("ceo-session"),
    tmuxHiddenSessionName("manager-session"),
  );
});

test("T1 T2 create commands target the hidden session with a non-exiting keeper", () => {
  const tmux = fakeTmux([new Error("missing"), "%0", "%42"]);
  const created = createTmuxHiddenSurface(
    "Scout",
    "parent",
    undefined,
    tmux.execute,
  );
  assert.equal(created.surface, "%42");
  assert.equal(created.owner.sessionName, "pi-hidden-parent");
  assert.equal(created.owner.keeperPaneId, "%0");
  assert.deepEqual(tmux.calls[0], ["has-session", "-t", "pi-hidden-parent"]);
  assert.deepEqual(tmux.calls[1], [
    "new-session",
    "-d",
    "-s",
    "pi-hidden-parent",
    "-n",
    "keeper",
    "-P",
    "-F",
    "#{pane_id}",
    TMUX_HIDDEN_KEEPER_COMMAND,
  ]);
  assert.equal(TMUX_HIDDEN_KEEPER_COMMAND, "tail -f /dev/null");
  assert.deepEqual(tmux.calls[2], [
    "new-window",
    "-d",
    "-t",
    "pi-hidden-parent",
    "-n",
    "Scout",
    "-c",
    process.cwd(),
    "-P",
    "-F",
    "#{pane_id}",
  ]);
  assert.equal(
    tmux.calls.some((args) => args[0] === "new-window" && !args.includes("-t")),
    false,
  );
});

test("T1 a second child reuses the owner and still targets the hidden session", () => {
  const owner = hiddenOwner();
  const tmux = fakeTmux(["", "%43"]);
  const created = createTmuxHiddenSurface(
    "Worker",
    "parent",
    owner,
    tmux.execute,
  );
  assert.equal(created.owner, owner);
  assert.equal(created.surface, "%43");
  assert.deepEqual(tmux.calls[0], ["has-session", "-t", "pi-hidden-parent"]);
  assert.equal(
    tmux.calls.some((args) => args[0] === "new-session"),
    false,
  );
  assert.equal(tmux.calls[1][3], "pi-hidden-parent");
});

test("creates a tmux child in a detached hidden-owner window", () => {
  const tmux = fakeTmux(["%42"]);
  assert.equal(
    createTmuxBackgroundWindow("Scout", hiddenOwner(), tmux.execute),
    "%42",
  );
  assert.deepEqual(tmux.calls, [
    [
      "new-window",
      "-d",
      "-t",
      "pi-hidden-parent",
      "-n",
      "Scout",
      "-c",
      process.cwd(),
      "-P",
      "-F",
      "#{pane_id}",
    ],
  ]);
});

test("T3 T4 attaches an existing pane beside the manager and never selects a window", () => {
  const tmux = fakeTmux(["@2", "@1", "", ""]);
  assert.equal(attachTmuxPane("%42", "%1", tmux.execute), "moved");
  assert.deepEqual(tmux.calls.slice(2), [
    ["join-pane", "-d", "-h", "-s", "%42", "-t", "%1"],
    ["select-pane", "-t", "%42"],
  ]);
  assert.equal(
    tmux.calls.some((args) => args[0] === "select-window"),
    false,
  );
  assert.equal(
    tmux.calls.some((args) => args[0] === "new-window"),
    false,
  );
});

test("T2 T5 focuses an attached pane without moving it or touching the keeper", () => {
  const tmux = fakeTmux(["@1", "@1", ""]);
  assert.equal(attachTmuxPane("%42", "%1", tmux.execute), "focused");
  assert.deepEqual(tmux.calls.at(-1), ["select-pane", "-t", "%42"]);
  assert.equal(
    tmux.calls.some((args) => args[0] === "join-pane"),
    false,
  );
  assert.equal(
    tmux.calls.some((args) => args[0] === "select-window"),
    false,
  );
  assert.equal(
    tmux.calls.some((args) => args[0] === "kill-session"),
    false,
  );
  assert.equal(
    tmux.calls.some((args) => args.includes("%0")),
    false,
  );
});

test("T6 detaches the pane into the recorded hidden owner", () => {
  const tmux = fakeTmux(["", "%42"]);
  assert.equal(
    detachTmuxPane("%42", hiddenOwner(), "Scout", tmux.execute),
    "%42",
  );
  assert.deepEqual(tmux.calls, [
    ["has-session", "-t", "pi-hidden-parent"],
    [
      "break-pane",
      "-d",
      "-s",
      "%42",
      "-t",
      "pi-hidden-parent:",
      "-n",
      "Scout",
      "-P",
      "-F",
      "#{pane_id}",
    ],
  ]);
  assert.equal(
    tmux.calls.some((args) => args[0] === "new-window"),
    false,
  );
});

test("T6 recreates a missing hidden owner before detach", () => {
  const tmux = fakeTmux([new Error("missing"), "%0", "%42"]);
  const owner = hiddenOwner();
  assert.equal(detachTmuxPane("%42", owner, "Scout", tmux.execute), "%42");
  assert.deepEqual(tmux.calls[0], ["has-session", "-t", "pi-hidden-parent"]);
  assert.deepEqual(tmux.calls[1], [
    "new-session",
    "-d",
    "-s",
    "pi-hidden-parent",
    "-n",
    "keeper",
    "-P",
    "-F",
    "#{pane_id}",
    TMUX_HIDDEN_KEEPER_COMMAND,
  ]);
  assert.equal(tmux.calls[2][0], "break-pane");
  assert.equal(tmux.calls[2][5], "pi-hidden-parent:");
});

test("ensureTmuxHiddenOwner recreates the keeper when the session is gone", () => {
  const tmux = fakeTmux([new Error("missing"), "%9"]);
  const owner = ensureTmuxHiddenOwner(
    "pi-hidden-parent",
    hiddenOwner(),
    tmux.execute,
  );
  assert.equal(owner.keeperPaneId, "%9");
  assert.equal(tmux.calls[1][0], "new-session");
});

test("destroyTmuxHiddenOwner kills the hidden session", () => {
  const tmux = fakeTmux([""]);
  destroyTmuxHiddenOwner(hiddenOwner(), tmux.execute);
  assert.deepEqual(tmux.calls, [["kill-session", "-t", "pi-hidden-parent"]]);
});

test("rejects unsafe controls before issuing tmux commands", () => {
  const tmux = fakeTmux([]);
  assert.throws(
    () => sendTmuxPrompt("%42", "safe\u001b[201~Enter", tmux.execute),
    /unsafe terminal control/,
  );
  assert.deepEqual(tmux.calls, []);
});

test("pastes multiline prompts as one bracketed tmux submission", () => {
  const tmux = fakeTmux([]);
  sendTmuxPrompt("%42", "line one\nline two", tmux.execute);

  const buffer = tmux.calls[0][2];
  assert.deepEqual(tmux.calls, [
    ["set-buffer", "-b", buffer, "--", "line one\nline two"],
    ["paste-buffer", "-p", "-b", buffer, "-d", "-t", "%42"],
    ["send-keys", "-t", "%42", "Enter"],
    ["delete-buffer", "-b", buffer],
  ]);
});

function tmuxBinaryAvailable(): boolean {
  try {
    execFileSync("tmux", ["-V"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

test("T1-T10 disposable tmux socket smoke for hidden launch, split attach, and cleanup", (t) => {
  if (!tmuxBinaryAvailable()) {
    t.skip("tmux is not available");
    return;
  }
  const socket = `pi-15e-${randomUUID()}`;
  const execute: TmuxCommand = (args) =>
    execFileSync("tmux", ["-L", socket, "-f", "/dev/null", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  const listWindows = (target: string) =>
    execute([
      "list-windows",
      "-t",
      target,
      "-F",
      "#{window_index}:#{window_name}",
    ])
      .split("\n")
      .filter(Boolean);
  const listPanes = (target: string) =>
    execute(["list-panes", "-t", target, "-F", "#{pane_id}"])
      .split("\n")
      .filter(Boolean);
  const listSessions = () => {
    try {
      return execute(["list-sessions", "-F", "#{session_name}"])
        .split("\n")
        .filter(Boolean);
    } catch {
      return [];
    }
  };
  try {
    execute([
      "new-session",
      "-d",
      "-s",
      "caller",
      "-n",
      "main",
      "tail -f /dev/null",
    ]);
    const managerPane = execute([
      "display-message",
      "-p",
      "-t",
      "caller:",
      "#{pane_id}",
    ]);
    const beforeWindows = listWindows("caller");
    const beforePanes = listPanes("caller");
    assert.deepEqual(beforeWindows, ["0:main"]);
    assert.equal(beforePanes.length, 1);

    const first = createTmuxHiddenSurface(
      "Scout",
      "parent-smoke",
      undefined,
      execute,
    );
    const second = createTmuxHiddenSurface(
      "Worker",
      "parent-smoke",
      first.owner,
      execute,
    );
    assert.deepEqual(listWindows("caller"), beforeWindows);
    assert.deepEqual(listPanes("caller"), beforePanes);
    assert.equal(
      listWindows(first.owner.sessionName).includes("1:Scout"),
      true,
    );
    assert.equal(
      listWindows(first.owner.sessionName).includes("2:Worker"),
      true,
    );
    const keeperPanes = listPanes(`${first.owner.sessionName}:keeper`);
    assert.equal(keeperPanes.includes(first.owner.keeperPaneId), true);

    assert.equal(attachTmuxPane(first.surface, managerPane, execute), "moved");
    assert.deepEqual(listWindows("caller"), beforeWindows);
    assert.equal(listPanes("caller").length, 2);
    assert.equal(listPanes("caller").includes(first.surface), true);
    assert.equal(
      listPanes(`${first.owner.sessionName}:keeper`).includes(
        first.owner.keeperPaneId,
      ),
      true,
    );

    assert.equal(
      attachTmuxPane(first.surface, managerPane, execute),
      "focused",
    );
    assert.deepEqual(listWindows("caller"), beforeWindows);
    assert.equal(listPanes("caller").length, 2);

    detachTmuxPane(first.surface, first.owner, "Scout", execute);
    assert.deepEqual(listWindows("caller"), beforeWindows);
    assert.deepEqual(listPanes("caller"), beforePanes);
    assert.equal(
      listWindows(first.owner.sessionName).some((window) =>
        window.endsWith(":Scout"),
      ),
      true,
    );

    assert.equal(attachTmuxPane(second.surface, managerPane, execute), "moved");
    execute(["kill-pane", "-t", second.surface]);
    assert.deepEqual(listWindows("caller"), beforeWindows);
    assert.deepEqual(listPanes("caller"), beforePanes);

    execute(["kill-pane", "-t", first.surface]);
    assert.deepEqual(listWindows("caller"), beforeWindows);
    assert.deepEqual(listPanes("caller"), beforePanes);

    destroyTmuxHiddenOwner(first.owner, execute);
    assert.equal(listSessions().includes(first.owner.sessionName), false);
    assert.deepEqual(listWindows("caller"), beforeWindows);
    assert.deepEqual(listPanes("caller"), beforePanes);
  } finally {
    try {
      execFileSync("tmux", ["-L", socket, "kill-server"], { stdio: "ignore" });
    } catch {}
  }
});

test("startup pane auth and model errors are detected", () => {
  assert.equal(
    interpretStartupPaneError(
      "Error: No API key found for amazon-bedrock.\n\nUse /login to log into a provider via OAuth or API key.",
    ),
    "No API key found for amazon-bedrock",
  );
  assert.equal(
    interpretStartupPaneError(
      "Error: No model selected.\n\nUse /login to log into a provider via OAuth or API key.\n\nThen use /model to select a model.",
    ),
    "No model selected.",
  );
  assert.equal(
    interpretStartupPaneError(
      'Authentication failed for "amazon-bedrock". Credentials may have expired.',
    ),
    'Authentication failed for "amazon-bedrock"',
  );
  assert.equal(
    interpretStartupPaneError("child discussed API keys in ordinary output"),
    undefined,
  );
});

function ok(result: unknown) {
  return JSON.stringify({ id: "t", result });
}

function fakeHerdr(handler: (args: string[]) => string) {
  const calls: string[][] = [];
  const execute: HerdrCommand = (args) => {
    calls.push(args);
    return handler(args);
  };
  return { calls, execute };
}

function paneGet(paneId: string, tabId: string) {
  return ok({ pane: { pane_id: paneId, tab_id: tabId }, type: "pane_get" });
}

test("herdr createSurface uses a no-focus tab", () => {
  const herdr = fakeHerdr(() =>
    ok({
      root_pane: { pane_id: "w1:p9" },
      tab: { tab_id: "w1:t2" },
      type: "tab_created",
    }),
  );
  assert.equal(createHerdrSurface("Scout", herdr.execute), "w1:p9");
  assert.equal(herdr.calls[0]?.[0], "tab");
  assert.equal(herdr.calls[0]?.[1], "create");
  assert.ok(herdr.calls[0]?.includes("--no-focus"));
  assert.ok(herdr.calls[0]?.includes("Scout"));
});

test("herdr attach focuses a same-tab pane", () => {
  const herdr = fakeHerdr((args) => {
    if (args[0] === "pane" && args[1] === "get") {
      return paneGet(args[2]!, "w1:t1");
    }
    return ok({ type: "ok" });
  });
  assert.equal(attachHerdrPane("w1:p2", "w1:p1", herdr.execute), "focused");
  assert.deepEqual(herdr.calls.at(-1), ["agent", "focus", "w1:p2"]);
  assert.equal(
    herdr.calls.some((args) => args[0] === "pane" && args[1] === "move"),
    false,
  );
});

test("herdr attach moves a cross-tab pane beside the manager", () => {
  const herdr = fakeHerdr((args) => {
    if (args[0] === "pane" && args[1] === "get" && args[2] === "w1:p9") {
      return paneGet("w1:p9", "w1:t2");
    }
    if (args[0] === "pane" && args[1] === "get") {
      return paneGet(args[2]!, "w1:t1");
    }
    return ok({ type: "pane_move" });
  });
  assert.equal(attachHerdrPane("w1:p9", "w1:p1", herdr.execute), "moved");
  assert.deepEqual(herdr.calls.at(-1), [
    "pane",
    "move",
    "w1:p9",
    "--tab",
    "w1:t1",
    "--target-pane",
    "w1:p1",
    "--split",
    "right",
    "--focus",
  ]);
});

test("herdr detach parks the pane on a new tab", () => {
  const herdr = fakeHerdr(() => ok({ type: "pane_move" }));
  assert.equal(detachHerdrPane("w1:p9", "Scout", herdr.execute), "w1:p9");
  assert.deepEqual(herdr.calls[0], [
    "pane",
    "move",
    "w1:p9",
    "--new-tab",
    "--label",
    "Scout",
    "--no-focus",
  ]);
});

test("herdr wins over leftover TMUX when HERDR_ENV is set", () => {
  const previous = {
    mux: process.env.PI_SUBAGENT_MUX,
    tmux: process.env.TMUX,
    herdr: process.env.HERDR_ENV,
    pane: process.env.HERDR_PANE_ID,
    cmux: process.env.CMUX_SOCKET_PATH,
  };
  delete process.env.PI_SUBAGENT_MUX;
  delete process.env.CMUX_SOCKET_PATH;
  process.env.TMUX = "leftover";
  process.env.HERDR_ENV = "1";
  process.env.HERDR_PANE_ID = "w1:p1";
  try {
    assert.equal(getMuxBackend(), "herdr");
  } finally {
    if (previous.mux == null) delete process.env.PI_SUBAGENT_MUX;
    else process.env.PI_SUBAGENT_MUX = previous.mux;
    if (previous.tmux == null) delete process.env.TMUX;
    else process.env.TMUX = previous.tmux;
    if (previous.herdr == null) delete process.env.HERDR_ENV;
    else process.env.HERDR_ENV = previous.herdr;
    if (previous.pane == null) delete process.env.HERDR_PANE_ID;
    else process.env.HERDR_PANE_ID = previous.pane;
    if (previous.cmux == null) delete process.env.CMUX_SOCKET_PATH;
    else process.env.CMUX_SOCKET_PATH = previous.cmux;
  }
});
