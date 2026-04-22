import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { checkSubagentDepth, getSubagentDepthEnv, DEFAULT_SUBAGENT_MAX_DEPTH } from "./types.ts";

let savedDepth: string | undefined;
let savedMaxDepth: string | undefined;

beforeEach(() => {
	savedDepth = process.env.PI_SUBAGENT_DEPTH;
	savedMaxDepth = process.env.PI_SUBAGENT_MAX_DEPTH;
});

afterEach(() => {
	if (savedDepth === undefined) delete process.env.PI_SUBAGENT_DEPTH;
	else process.env.PI_SUBAGENT_DEPTH = savedDepth;
	if (savedMaxDepth === undefined) delete process.env.PI_SUBAGENT_MAX_DEPTH;
	else process.env.PI_SUBAGENT_MAX_DEPTH = savedMaxDepth;
});

describe("DEFAULT_SUBAGENT_MAX_DEPTH", () => {
	it("is 2", () => {
		assert.equal(DEFAULT_SUBAGENT_MAX_DEPTH, 2);
	});
});

describe("checkSubagentDepth", () => {
	it("not blocked at depth=0, max=2", () => {
		process.env.PI_SUBAGENT_DEPTH = "0";
		process.env.PI_SUBAGENT_MAX_DEPTH = "2";
		const result = checkSubagentDepth();
		assert.equal(result.blocked, false);
		assert.equal(result.depth, 0);
		assert.equal(result.maxDepth, 2);
	});

	it("not blocked at depth=1, max=2", () => {
		process.env.PI_SUBAGENT_DEPTH = "1";
		process.env.PI_SUBAGENT_MAX_DEPTH = "2";
		assert.equal(checkSubagentDepth().blocked, false);
	});

	it("blocked at depth=2, max=2", () => {
		process.env.PI_SUBAGENT_DEPTH = "2";
		process.env.PI_SUBAGENT_MAX_DEPTH = "2";
		const result = checkSubagentDepth();
		assert.equal(result.blocked, true);
		assert.equal(result.depth, 2);
		assert.equal(result.maxDepth, 2);
	});

	it("blocked at depth=3, max=2", () => {
		process.env.PI_SUBAGENT_DEPTH = "3";
		process.env.PI_SUBAGENT_MAX_DEPTH = "2";
		assert.equal(checkSubagentDepth().blocked, true);
	});

	it("blocked at depth=0, max=0 (disables subagent entirely)", () => {
		process.env.PI_SUBAGENT_DEPTH = "0";
		process.env.PI_SUBAGENT_MAX_DEPTH = "0";
		assert.equal(checkSubagentDepth().blocked, true);
	});

	it("defaults to depth=0, max=2 when env vars unset", () => {
		delete process.env.PI_SUBAGENT_DEPTH;
		delete process.env.PI_SUBAGENT_MAX_DEPTH;
		const result = checkSubagentDepth();
		assert.equal(result.blocked, false);
		assert.equal(result.depth, 0);
		assert.equal(result.maxDepth, 2);
	});

	it("not blocked when depth is invalid (NaN)", () => {
		process.env.PI_SUBAGENT_DEPTH = "garbage";
		process.env.PI_SUBAGENT_MAX_DEPTH = "2";
		assert.equal(checkSubagentDepth().blocked, false);
	});
});

describe("getSubagentDepthEnv", () => {
	it("increments from depth=0", () => {
		process.env.PI_SUBAGENT_DEPTH = "0";
		delete process.env.PI_SUBAGENT_MAX_DEPTH;
		const env = getSubagentDepthEnv();
		assert.equal(env.PI_SUBAGENT_DEPTH, "1");
		assert.equal(env.PI_SUBAGENT_MAX_DEPTH, "2");
	});

	it("increments from depth=1", () => {
		process.env.PI_SUBAGENT_DEPTH = "1";
		delete process.env.PI_SUBAGENT_MAX_DEPTH;
		const env = getSubagentDepthEnv();
		assert.equal(env.PI_SUBAGENT_DEPTH, "2");
		assert.equal(env.PI_SUBAGENT_MAX_DEPTH, "2");
	});

	it("defaults to depth=1 when env var unset", () => {
		delete process.env.PI_SUBAGENT_DEPTH;
		delete process.env.PI_SUBAGENT_MAX_DEPTH;
		const env = getSubagentDepthEnv();
		assert.equal(env.PI_SUBAGENT_DEPTH, "1");
		assert.equal(env.PI_SUBAGENT_MAX_DEPTH, "2");
	});

	it("respects custom PI_SUBAGENT_MAX_DEPTH", () => {
		process.env.PI_SUBAGENT_DEPTH = "0";
		process.env.PI_SUBAGENT_MAX_DEPTH = "5";
		const env = getSubagentDepthEnv();
		assert.equal(env.PI_SUBAGENT_DEPTH, "1");
		assert.equal(env.PI_SUBAGENT_MAX_DEPTH, "5");
	});

	it("falls back to depth=1 when env var is invalid (NaN)", () => {
		process.env.PI_SUBAGENT_DEPTH = "not-a-number";
		delete process.env.PI_SUBAGENT_MAX_DEPTH;
		const env = getSubagentDepthEnv();
		assert.equal(env.PI_SUBAGENT_DEPTH, "1");
	});
});
