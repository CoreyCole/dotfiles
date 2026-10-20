import { getBaseUrl } from "../auth/config.ts";
import type { OAuthCredentials } from "@earendil-works/pi-ai";
import { refresh, type XaiOAuthCredentials } from "../auth/oauth.ts";
import {
  type AccountCredential,
  loadAccountVault,
  mutateAccountVault,
  toStoredCredential,
} from "./accountVault.ts";

export interface AccountRoute {
  accountId: string;
  token: string;
  baseUrl: string;
}

function route(accountId: string, credential: AccountCredential): AccountRoute {
  return {
    accountId,
    token: credential.access,
    baseUrl: (credential.baseUrl ?? getBaseUrl()).replace(/\/+$/, ""),
  };
}

function selectedAccount(accountId?: string) {
  const vault = loadAccountVault();
  const account = accountId
    ? vault.accounts.find((candidate) => candidate.id === accountId && candidate.credential)
    : (vault.accounts.find(
        (candidate) => candidate.id === vault.activeAccountId && candidate.credential,
      ) ?? vault.accounts.find((candidate) => candidate.credential));
  return account;
}

export async function resolveAccountRoute(accountId?: string): Promise<AccountRoute> {
  const account = selectedAccount(accountId);
  if (!account?.credential) {
    throw new Error("Grok CLI login is required. Run /login and choose Grok CLI.");
  }
  if (Date.now() < account.credential.expires) return route(account.id, account.credential);

  const refreshed = toStoredCredential(
    (await refresh(account.credential as OAuthCredentials)) as XaiOAuthCredentials,
  );
  await mutateAccountVault((vault) => {
    const target = vault.accounts.find((candidate) => candidate.id === account.id);
    if (!target) return;
    target.credential = refreshed;
    target.revision += 1;
    vault.activeAccountId ??= target.id;
  });
  return route(account.id, refreshed);
}
