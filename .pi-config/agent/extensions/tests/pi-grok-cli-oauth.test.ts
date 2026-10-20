import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { XAI_OAUTH_CLIENT_ID } from "../pi-grok-cli/src/auth/config.ts";
import { credentialsFromLoginPayload, refresh } from "../pi-grok-cli/src/auth/oauth.ts";
import { loadAccountVault, mutateAccountVault } from "../pi-grok-cli/src/provider/accountVault.ts";

const tokenEndpoint = "https://auth.x.ai/oauth2/token";

function jwt(claims: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.sig`;
}

async function withFetch(
  payload: Record<string, unknown>,
  run: (bodies: string[]) => Promise<void>,
) {
  const bodies: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    bodies.push(String(init?.body ?? ""));
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await run(bodies);
  } finally {
    globalThis.fetch = original;
  }
}

test("team refresh sends principal fields and does not send teamId", async () => {
  await withFetch(
    {
      access_token: jwt({
        principal_type: "Team",
        principal_id: "team-123",
        team_id: "team-123",
      }),
      refresh_token: "new-refresh",
      expires_in: 3600,
    },
    async (bodies) => {
      const updated = await refresh({
        access: "old-access",
        refresh: "old-refresh",
        expires: 1,
        tokenEndpoint,
        principalType: "Team",
        principalId: "team-123",
        teamId: "team-123",
      });
      const params = new URLSearchParams(bodies[0]);
      assert.equal(params.get("grant_type"), "refresh_token");
      assert.equal(params.get("client_id"), XAI_OAUTH_CLIENT_ID);
      assert.equal(params.get("refresh_token"), "old-refresh");
      assert.equal(params.get("principal_type"), "Team");
      assert.equal(params.get("principal_id"), "team-123");
      assert.equal(params.get("team_id"), null);
      assert.equal(updated.principalType, "Team");
      assert.equal(updated.principalId, "team-123");
      assert.equal(updated.teamId, "team-123");
    },
  );
});

test("personal refresh sends only the original params", async () => {
  await withFetch(
    { access_token: "opaque-access", refresh_token: "new-refresh", expires_in: 3600 },
    async (bodies) => {
      const updated = await refresh({
        access: "old-access",
        refresh: "old-refresh",
        expires: 1,
        tokenEndpoint,
      });
      const params = new URLSearchParams(bodies[0]);
      assert.deepEqual([...params.keys()].sort(), ["client_id", "grant_type", "refresh_token"]);
      assert.equal(updated.principalType, undefined);
      assert.equal(updated.principalId, undefined);
      assert.equal(updated.teamId, undefined);
    },
  );
});

test("login payload extracts principal claims from the access token", () => {
  const credentials = credentialsFromLoginPayload(
    {
      access_token: jwt({
        principal_type: "Team",
        principal_id: "team-1",
        team_id: "team-9",
      }),
      refresh_token: "refresh-1",
      expires_in: 3600,
    },
    tokenEndpoint,
    "invalid",
    "token exchange",
  );
  assert.equal(credentials.principalType, "Team");
  assert.equal(credentials.principalId, "team-1");
  assert.equal(credentials.teamId, "team-9");
});

test("login payload falls back to id_token when the access token has no claims", () => {
  const credentials = credentialsFromLoginPayload(
    {
      access_token: "opaque-access",
      refresh_token: "refresh-1",
      expires_in: 3600,
      id_token: jwt({ principalType: "Team", principalId: "team-7", teamId: "team-7" }),
    },
    tokenEndpoint,
    "invalid",
    "token exchange",
  );
  assert.equal(credentials.principalType, "Team");
  assert.equal(credentials.principalId, "team-7");
  assert.equal(credentials.teamId, "team-7");
});

test("refresh extracts new claims and keeps a previous claim the new token lacks", async () => {
  await withFetch(
    {
      access_token: jwt({ principal_type: "Team", principal_id: "team-2" }),
      expires_in: 3600,
    },
    async () => {
      const updated = await refresh({
        access: "old-access",
        refresh: "old-refresh",
        expires: 1,
        tokenEndpoint,
        principalType: "Team",
        principalId: "team-1",
        teamId: "team-1",
      });
      assert.equal(updated.principalType, "Team");
      assert.equal(updated.principalId, "team-2");
      assert.equal(updated.teamId, "team-1");
      assert.equal(updated.refresh, "old-refresh");
    },
  );
});

test("vault reload keeps stored principal fields", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-grok-cli-"));
  const path = join(dir, "accounts.json");
  try {
    await mutateAccountVault((vault) => {
      const account = vault.accounts[0];
      if (!account) throw new Error("missing account");
      account.credential = {
        access: "access-token",
        refresh: "refresh-token",
        expires: 10,
        principalType: "Team",
        principalId: "team-1",
        teamId: "team-1",
      };
      vault.activeAccountId = account.id;
    }, path);
    const loaded = loadAccountVault(path);
    const credential = loaded.accounts[0]?.credential;
    assert.equal(credential?.principalType, "Team");
    assert.equal(credential?.principalId, "team-1");
    assert.equal(credential?.teamId, "team-1");
    assert.equal("extra" in (credential ?? {}), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
