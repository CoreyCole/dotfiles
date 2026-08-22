import assert from "node:assert/strict";
import test from "node:test";
import {
  attachTmuxPane,
  createTmuxBackgroundWindow,
  detachTmuxPane,
  sendTmuxPrompt,
  type TmuxCommand,
} from "./cmux.ts";

function fakeTmux(outputs: string[]) {
  const calls: string[][] = [];
  const execute: TmuxCommand = (args) => {
    calls.push(args);
    return outputs.shift() ?? "";
  };
  return { calls, execute };
}

test("creates a tmux child in a detached background window", () => {
  const tmux = fakeTmux(["%42"]);
  assert.equal(createTmuxBackgroundWindow("Scout", tmux.execute), "%42");
  assert.deepEqual(tmux.calls, [
    [
      "new-window",
      "-d",
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

test("attaches an existing pane beside the manager and focuses it", () => {
  const tmux = fakeTmux(["@2", "@1", "", ""]);
  assert.equal(attachTmuxPane("%42", "%1", tmux.execute), "moved");
  assert.deepEqual(tmux.calls.slice(2), [
    ["join-pane", "-d", "-h", "-s", "%42", "-t", "%1"],
    ["select-pane", "-t", "%42"],
  ]);
});

test("focuses an attached pane without moving it again", () => {
  const tmux = fakeTmux(["@1", "@1", ""]);
  assert.equal(attachTmuxPane("%42", "%1", tmux.execute), "focused");
  assert.deepEqual(tmux.calls.at(-1), ["select-pane", "-t", "%42"]);
  assert.equal(
    tmux.calls.some((args) => args[0] === "join-pane"),
    false,
  );
});

test("detaches the same pane into a background window", () => {
  const tmux = fakeTmux(["%42"]);
  assert.equal(detachTmuxPane("%42", tmux.execute), "%42");
  assert.deepEqual(tmux.calls, [
    ["break-pane", "-d", "-s", "%42", "-P", "-F", "#{pane_id}"],
  ]);
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
