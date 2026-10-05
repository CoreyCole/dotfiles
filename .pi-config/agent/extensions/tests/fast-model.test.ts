import assert from "node:assert/strict";
import test from "node:test";
import type { Api, Model } from "@earendil-works/pi-ai";
import {
  configuredDefaultModelRef,
  isFastModelRef,
  routeFastModel,
} from "../lib/default-model.ts";

const grok = { provider: "xai", id: "grok-4.7" } as Model<Api>;
const fast = { provider: "xai", id: "fast" } as Model<Api>;

test("fast alias follows the Pi default and does not pin a version", () => {
  const piDefault = configuredDefaultModelRef();
  assert.equal(isFastModelRef("fast"), true);
  assert.equal(isFastModelRef("xai/fast"), true);
  assert.notEqual(piDefault, "xai/fast");
  assert.doesNotMatch(piDefault, /grok-4\.6/);

  const [provider, id] = piDefault.split("/");
  const routed = routeFastModel(
    { reason: "user", thinkingLevel: "high" },
    (foundProvider, foundId) =>
      foundProvider === provider && foundId === id ? grok : undefined,
    piDefault,
  );
  assert.equal(routed.model, grok);
  assert.equal(routed.thinkingLevel, "high");
});

test("fast continuation stays on the physical model from the current turn", () => {
  const routed = routeFastModel(
    {
      reason: "continuation",
      thinkingLevel: "high",
      previous: { model: grok, thinkingLevel: "low" },
    },
    () => fast,
    "xai/fast",
  );
  assert.equal(routed.model, grok);
  assert.equal(routed.thinkingLevel, "low");
});
