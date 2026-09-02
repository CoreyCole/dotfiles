import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  attachTmuxPane,
  createTmuxBackgroundWindow,
  createTmuxHiddenSurface,
  detachTmuxPane,
  destroyTmuxHiddenOwner,
  ensureTmuxHiddenOwner,
  sendTmuxPrompt,
  TMUX_HIDDEN_KEEPER_COMMAND,
  tmuxHiddenSessionName,
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
