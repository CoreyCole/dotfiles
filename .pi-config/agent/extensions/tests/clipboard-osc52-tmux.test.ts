import assert from "node:assert/strict";
import test from "node:test";
import { clipboardOsc52Test } from "../clipboard-osc52-tmux.ts";

const ENV_KEYS = [
  "HERDR_ENV",
  "TMUX",
  "SSH_CONNECTION",
  "SSH_CLIENT",
  "MOSH_CONNECTION",
] as const;

function withEnv(
  values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => void,
) {
  const previous = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  try {
    for (const key of ENV_KEYS) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("herdr skips the tmux stdout steal even when TMUX is inherited", () => {
  withEnv({ HERDR_ENV: "1", TMUX: "/tmp/tmux-501/default,1,0" }, () => {
    assert.equal(clipboardOsc52Test.shouldInstallTmuxOsc52Bridge(), false);
  });
});

test("plain tmux still installs the stdout steal", () => {
  withEnv({ TMUX: "/tmp/tmux-501/default,1,0" }, () => {
    assert.equal(clipboardOsc52Test.shouldInstallTmuxOsc52Bridge(), true);
  });
});

test("herdr without SSH forces OSC 52 emission", () => {
  withEnv({ HERDR_ENV: "1" }, () => {
    clipboardOsc52Test.enableOsc52Copy();
    assert.equal(
      process.env.SSH_CONNECTION,
      "pi-herdr-osc52 0 pi-herdr-osc52 0",
    );
  });
});

test("existing SSH env is left alone", () => {
  withEnv(
    {
      HERDR_ENV: "1",
      TMUX: "/tmp/tmux-501/default,1,0",
      SSH_CONNECTION: "100.1.1.1 1 100.2.2.2 22",
    },
    () => {
      clipboardOsc52Test.enableOsc52Copy();
      assert.equal(process.env.SSH_CONNECTION, "100.1.1.1 1 100.2.2.2 22");
    },
  );
});
