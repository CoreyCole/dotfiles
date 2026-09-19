import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  appendLeadEvent,
  buildLeadEvent,
  classifySubagentCustomType,
  extractText,
  firstLine,
  leadInboxPath,
  postLeadWebhook,
  resolveWebhookUrl,
  truncate,
} from "../lead-subscribe.ts";

test("classifies attachable-subagent custom messages", () => {
  assert.equal(classifySubagentCustomType("subagent_result"), "subagent_settled");
  assert.equal(classifySubagentCustomType("subagent_ping"), "subagent_report");
  assert.equal(classifySubagentCustomType("subagent_status"), "subagent_report");
  assert.equal(classifySubagentCustomType("other"), undefined);
});

test("resolveWebhookUrl prefers the command arg and rejects non-http", () => {
  assert.deepEqual(resolveWebhookUrl(undefined, undefined), {});
  assert.equal(
    resolveWebhookUrl("https://lead.example/hook", "http://env.example").url,
    "https://lead.example/hook",
  );
  assert.equal(
    resolveWebhookUrl(undefined, "http://127.0.0.1:9/hook").url,
    "http://127.0.0.1:9/hook",
  );
  assert.match(resolveWebhookUrl("ftp://x").error ?? "", /http/);
  assert.match(resolveWebhookUrl("not a url").error ?? "", /Invalid/);
});

test("extracts and truncates text for event payloads", () => {
  assert.equal(extractText("  hello  "), "hello");
  assert.equal(
    extractText([{ type: "text", text: "one" }, { type: "text", text: "two" }]),
    "one\ntwo",
  );
  assert.equal(truncate("abcd", 4), "abcd");
  assert.equal(truncate("abcde", 4), "abc…");
  assert.equal(firstLine("\nsecond line\nthird"), "second line");
});

test("appendLeadEvent creates the inbox and writes one json line", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-lead-inbox-"));
  try {
    const filePath = leadInboxPath(root);
    const event = buildLeadEvent({
      kind: "agent_settled",
      session: "sess-1",
      cwd: "/tmp",
      summary: "done",
      snippet: "full assistant text",
      ts: "2026-04-09T00:00:00.000Z",
    });
    appendLeadEvent(event, filePath);
    appendLeadEvent({ ...event, kind: "subagent_settled" }, filePath);
    const lines = readFileSync(filePath, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    assert.deepEqual(JSON.parse(lines[0]), event);
    assert.equal(JSON.parse(lines[1]).kind, "subagent_settled");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("postLeadWebhook posts JSON and callers can ignore failures", async () => {
  const bodies: string[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      bodies.push(body);
      res.writeHead(204);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("expected tcp address");
  }
  const url = `http://127.0.0.1:${address.port}/hook`;
  const event = buildLeadEvent({
    kind: "subagent_report",
    session: "sess-2",
    cwd: "/home/ruby/dotfiles",
    summary: "subagent ping: worker",
    snippet: "need help",
  });
  try {
    await postLeadWebhook(url, event);
    assert.equal(bodies.length, 1);
    assert.deepEqual(JSON.parse(bodies[0]), event);
    await assert.rejects(
      postLeadWebhook("http://127.0.0.1:1/", event),
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
