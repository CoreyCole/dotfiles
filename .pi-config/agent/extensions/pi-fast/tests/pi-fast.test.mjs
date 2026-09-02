import assert from "node:assert/strict";
import { test } from "node:test";
import { FAST_STATUS_KEY } from "../src/capabilities.ts";
import { DEFAULT_SUPPORTED_MODELS, FastConfigStore } from "../src/fast-config-store.ts";
import { FAST_DESIRED_HANDOFF_ENV } from "../src/fast-desired-handoff.ts";
import { FastStateEngine } from "../src/fast-state-engine.ts";
import { ServiceTierInjector } from "../src/service-tier-injector.ts";

const active = { active: true };

test("uses the pi-fast name for status, config, and child handoff", () => {
  const paths = new FastConfigStore({ home: "/home/test" }).paths("/work");

  assert.equal(FAST_STATUS_KEY, "pi-fast");
  assert.equal(FAST_DESIRED_HANDOFF_ENV, "PI_FAST_DESIRED");
  assert.equal(paths.global, "/home/test/.pi/agent/extensions/pi-fast.json");
  assert.equal(paths.project, "/work/.pi/extensions/pi-fast.json");
});

test("enables Fast Mode for the supported xAI Grok models", () => {
  for (const id of ["grok-4.3", "grok-4.5", "grok-4.6", "grok-build-0.1"]) {
    const engine = new FastStateEngine({
      desiredActive: true,
      supportedModels: DEFAULT_SUPPORTED_MODELS,
      currentModel: { provider: "xai", id },
    });

    assert.equal(engine.snapshot().active, true, `xai/${id} must support Fast Mode`);
  }
});

for (const model of [
  { api: "openai-completions", id: "grok-4.6" },
  { api: "openai-responses", id: "grok-4.6" },
  { api: "openai-codex-responses", id: "gpt-5.5" },
]) {
  test(`injects the priority tier for ${model.api}`, () => {
    const injector = new ServiceTierInjector();
    const payload = { model: model.id, input: "hello" };

    assert.deepEqual(injector.inject(payload, active, model), {
      ...payload,
      service_tier: "priority",
    });
    assert.deepEqual(payload, { model: model.id, input: "hello" });
  });
}

test("leaves an existing service tier unchanged", () => {
  const injector = new ServiceTierInjector();
  const model = { api: "openai-responses", id: "grok-4.6" };
  const payload = { model: model.id, service_tier: "default" };

  assert.equal(injector.inject(payload, active, model), payload);
});

test("does not inject for a different payload model or unsupported API", () => {
  const injector = new ServiceTierInjector();
  const payload = { model: "grok-4.5" };

  assert.equal(
    injector.inject(payload, active, { api: "openai-responses", id: "grok-4.6" }),
    payload,
  );
  assert.equal(
    injector.inject(payload, active, { api: "anthropic-messages", id: "grok-4.5" }),
    payload,
  );
});

test("does not inject while inactive or without a record payload", () => {
  const injector = new ServiceTierInjector();
  const model = { api: "openai-responses", id: "grok-4.6" };
  const payload = { model: model.id };

  assert.equal(injector.inject(payload, { active: false }, model), payload);
  assert.equal(injector.inject(null, active, model), null);
});
