import type { OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { login, type XaiOAuthCredentials } from "../auth/oauth.ts";
import {
  ACCOUNT_1_ID,
  type AccountVault,
  loadAccountVault,
  mutateAccountVault,
  toStoredCredential,
  type VaultAccount,
} from "./accountVault.ts";

function loginCallbacks(ctx: ExtensionCommandContext): OAuthLoginCallbacks {
  return {
    onAuth(info) {
      ctx.ui.notify(`Open this URL to continue login: ${info.url}`, "warning");
    },
    onDeviceCode(info) {
      ctx.ui.notify(`Open ${info.verificationUri} and enter code ${info.userCode}.`, "info");
    },
    async onPrompt(prompt) {
      return (await ctx.ui.input(prompt.message, prompt.placeholder)) ?? "";
    },
    onProgress(message) {
      ctx.ui.notify(message, "info");
    },
    async onManualCodeInput() {
      return (await ctx.ui.input("Paste the authorization code")) ?? "";
    },
    async onSelect(prompt) {
      const label = await ctx.ui.select(
        prompt.message,
        prompt.options.map((option) => option.label),
      );
      return prompt.options.find((option) => option.label === label)?.id;
    },
  };
}

function statusLabel(account: VaultAccount, activeId: string | undefined) {
  const state = account.credential ? "logged in" : "logged out";
  const active = account.id === activeId ? ", active" : "";
  return `${account.slot}. ${account.label} — ${state}${active}`;
}

async function storeLogin(id: string, credentials: XaiOAuthCredentials) {
  await mutateAccountVault((vault) => {
    const account = vault.accounts.find((candidate) => candidate.id === id);
    if (!account) throw new Error(`Unknown Grok CLI account: ${id}`);
    account.credential = toStoredCredential(credentials);
    account.revision += 1;
    vault.activeAccountId = account.id;
  });
}

async function addAccount(ctx: ExtensionCommandContext, vault: AccountVault) {
  const slot = vault.nextSlot;
  const label = (await ctx.ui.input("Label this Grok CLI account:", `Account ${slot}`))?.trim();
  if (!label) return;
  const id = `account-${slot}`;
  await mutateAccountVault((latest) => {
    if (latest.accounts.some((account) => account.label.toLocaleLowerCase() === label.toLocaleLowerCase())) {
      throw new Error(`An account named "${label}" already exists.`);
    }
    latest.accounts.push({ id, slot, label, revision: 0 });
    latest.nextSlot = slot + 1;
  });
  try {
    await storeLogin(id, (await login(loginCallbacks(ctx))) as XaiOAuthCredentials);
    ctx.ui.notify(`Logged in to ${label}.`, "info");
  } catch (error) {
    await mutateAccountVault((latest) => {
      latest.accounts = latest.accounts.filter((account) => account.id !== id);
      latest.nextSlot = slot;
    });
    throw error;
  }
}

export function registerAccountCommand(pi: ExtensionAPI) {
  pi.registerCommand("grok-cli-accounts", {
    description: "Add, select, or log out Grok CLI accounts",
    handler: async (args, ctx) => {
      if (args.trim()) {
        ctx.ui.notify("Usage: /grok-cli-accounts", "warning");
        return;
      }
      const vault = loadAccountVault();
      const choice = await ctx.ui.select("Grok CLI accounts:", [
        ...vault.accounts.map((account) => statusLabel(account, vault.activeAccountId)),
        "Add account",
      ]);
      if (!choice || choice === "Add account") {
        if (choice === "Add account") {
          try {
            await addAccount(ctx, vault);
          } catch (error) {
            ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
          }
        }
        return;
      }
      const account = vault.accounts.find(
        (candidate) => statusLabel(candidate, vault.activeAccountId) === choice,
      );
      if (!account) return;
      const action = await ctx.ui.select(`Manage "${account.label}":`, [
        account.credential ? "Use this account" : "Log in",
        ...(account.credential ? ["Log out"] : []),
        ...(account.id === ACCOUNT_1_ID ? [] : ["Remove"]),
      ]);
      try {
        if (action === "Log in") {
          await storeLogin(account.id, (await login(loginCallbacks(ctx))) as XaiOAuthCredentials);
          ctx.ui.notify(`Logged in to ${account.label}.`, "info");
        }
        if (action === "Use this account") {
          await mutateAccountVault((latest) => {
            const target = latest.accounts.find((candidate) => candidate.id === account.id);
            if (!target?.credential) throw new Error(`Log in to "${account.label}" first.`);
            latest.activeAccountId = target.id;
          });
          ctx.ui.notify(`Active account: ${account.label}.`, "info");
        }
        if (action === "Log out") {
          await mutateAccountVault((latest) => {
            const target = latest.accounts.find((candidate) => candidate.id === account.id);
            if (!target) return;
            target.credential = undefined;
            target.revision += 1;
            if (latest.activeAccountId === target.id) latest.activeAccountId = undefined;
          });
          ctx.ui.notify(`Logged out ${account.label}.`, "info");
        }
        if (action === "Remove") {
          await mutateAccountVault((latest) => {
            if (account.id === ACCOUNT_1_ID) throw new Error("The permanent Account 1 cannot be removed.");
            latest.accounts = latest.accounts.filter((candidate) => candidate.id !== account.id);
            if (latest.activeAccountId === account.id) latest.activeAccountId = undefined;
          });
          ctx.ui.notify(`Removed ${account.label}.`, "info");
        }
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}
