import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./index.ts";
import { createStatusState } from "./status.ts";

type AttachCandidate = Parameters<
  typeof __test__.resolveAttachTarget
>[0][number];

function candidate(id: string, name: string): AttachCandidate {
  return {
    id,
    name,
    task: "test",
    surface: `%${id}`,
    startTime: 0,
    sessionFile: "/tmp/test.jsonl",
    statusState: createStatusState({ source: "pi", startTimeMs: 0 }),
  };
}

const agents = [
  candidate("abcd1234", "Scout"),
  candidate("abcd5678", "Worker"),
  candidate("ef901234", "Scout"),
];

test("one resolved Pi profile preserves flags and environment across runs", () => {
  const profile = {
    cwdPrefix: "cd '/work' && ",
    environment: ["PI_CODING_AGENT_DIR='/config'", "PI_SUBAGENT_ID='abc'"],
    arguments: ["pi", "--session", "'/session'", "--model", "'model:high'"],
  };
  const initial = __test__.buildPiLaunchCommand(profile, {
    surface: "%1",
    promptArguments: ["first"],
  });
  const resumed = __test__.buildPiLaunchCommand(profile, {
    surface: "%2",
    promptArguments: ["next"],
  });
  for (const stable of [...profile.environment, ...profile.arguments]) {
    assert.equal(initial.includes(stable), true);
    assert.equal(resumed.includes(stable), true);
  }
});

test("human target selection uses the picker without empty resolution", async () => {
  const picked = await __test__.selectHumanTarget(
    agents.slice(0, 2),
    undefined,
    async (_title, options) => options[1],
  );
  assert.equal(
    picked && "running" in picked ? picked.running.id : "",
    "abcd5678",
  );
  const canceled = await __test__.selectHumanTarget(
    agents.slice(0, 2),
    undefined,
    async () => undefined,
  );
  assert.equal(canceled, undefined);
});

test("resolveAttachTarget prefers an exact ID", () => {
  const result = __test__.resolveAttachTarget(agents, "abcd1234");
  assert.equal("running" in result && result.running.id, "abcd1234");
});

test("resolveAttachTarget accepts a unique ID prefix", () => {
  const result = __test__.resolveAttachTarget(agents, "ef90");
  assert.equal("running" in result && result.running.id, "ef901234");
});

test("resolveAttachTarget accepts an exact unique name", () => {
  const result = __test__.resolveAttachTarget(agents, "Worker");
  assert.equal("running" in result && result.running.id, "abcd5678");
});

test("resolveAttachTarget reports no match", () => {
  const result = __test__.resolveAttachTarget(agents, "missing");
  assert.deepEqual(result, { error: 'No running subagent matches "missing".' });
});

test("resolveAttachTarget rejects ambiguous prefixes and names", () => {
  const prefix = __test__.resolveAttachTarget(agents, "abcd");
  const name = __test__.resolveAttachTarget(agents, "Scout");
  assert.match("error" in prefix ? prefix.error : "", /Ambiguous subagent/);
  assert.match("error" in name ? name.error : "", /Ambiguous subagent/);
});

test("explicit stops suppress watcher success and rejection notifications", () => {
  const running = candidate("stop1234", "Stopped");
  assert.equal(__test__.shouldDeliverWatcherNotification(running), true);

  running.explicitlyStopped = true;
  assert.equal(__test__.shouldDeliverWatcherNotification(running), false);
});

test("subagent task calls expand from a preview to the full prompt", () => {
  const task = "First line that identifies the task\nSecond line with details";
  assert.deepEqual(__test__.formatSubagentTaskCall(task, false), {
    body: "First line that identifies the task",
    lineCount: 2,
    expandable: true,
  });
  assert.deepEqual(__test__.formatSubagentTaskCall(task, true), {
    body: task,
    lineCount: 2,
    expandable: false,
  });
});

test("files and the task are loaded in the first CLI turn", () => {
  const build = __test__.buildPiPromptArgs as unknown as (params: {
    files: string[];
    taskArg: string;
  }) => string[];

  assert.deepEqual(
    build({
      files: ["context.md", "@fixture.json"],
      taskArg: "@task.md",
    }),
    ["@context.md", "@fixture.json", "@task.md"],
  );
});
