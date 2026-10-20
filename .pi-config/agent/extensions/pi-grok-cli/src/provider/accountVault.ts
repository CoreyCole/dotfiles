import { existsSync } from "node:fs";
import { getAccountVaultPath, readJsonFile, writeJsonAtomic } from "../storage.ts";

export const ACCOUNT_1_ID = "account-1";
export const ACCOUNT_VAULT_MARKER = "pi-grok-cli-account-vault-v1";

export interface AccountCredential {
  access: string;
  refresh: string;
  expires: number;
  tokenEndpoint?: string;
  discovery?: {
    authorization_endpoint: string;
    token_endpoint: string;
    device_authorization_endpoint?: string;
  };
  idToken?: string;
  tokenType?: string;
  baseUrl?: string;
  principalType?: string;
  principalId?: string;
  teamId?: string;
}

export interface VaultAccount {
  id: string;
  slot: number;
  label: string;
  credential?: AccountCredential;
  revision: number;
}

export interface AccountVault {
  version: 1;
  nextSlot: number;
  activeAccountId?: string;
  accounts: VaultAccount[];
}

const locks = new Map<string, Promise<unknown>>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

export function toStoredCredential(value: AccountCredential): AccountCredential {
  return {
    access: value.access,
    refresh: value.refresh,
    expires: value.expires,
    ...(value.tokenEndpoint ? { tokenEndpoint: value.tokenEndpoint } : {}),
    ...(value.discovery
      ? {
          discovery: {
            authorization_endpoint: value.discovery.authorization_endpoint,
            token_endpoint: value.discovery.token_endpoint,
            ...(value.discovery.device_authorization_endpoint
              ? { device_authorization_endpoint: value.discovery.device_authorization_endpoint }
              : {}),
          },
        }
      : {}),
    ...(value.idToken ? { idToken: value.idToken } : {}),
    ...(value.tokenType ? { tokenType: value.tokenType } : {}),
    ...(value.baseUrl ? { baseUrl: value.baseUrl } : {}),
    ...(value.principalType ? { principalType: value.principalType } : {}),
    ...(value.principalId ? { principalId: value.principalId } : {}),
    ...(value.teamId ? { teamId: value.teamId } : {}),
  };
}

export function parseStoredCredential(value: unknown): AccountCredential | undefined {
  if (!isObject(value)) return undefined;
  if (
    typeof value.access !== "string" ||
    !value.access ||
    value.access === ACCOUNT_VAULT_MARKER ||
    typeof value.refresh !== "string" ||
    !value.refresh ||
    value.refresh === ACCOUNT_VAULT_MARKER ||
    typeof value.expires !== "number" ||
    !Number.isFinite(value.expires) ||
    !optionalString(value.tokenEndpoint) ||
    !optionalString(value.idToken) ||
    !optionalString(value.tokenType) ||
    !optionalString(value.baseUrl) ||
    !optionalString(value.principalType) ||
    !optionalString(value.principalId) ||
    !optionalString(value.teamId)
  ) {
    return undefined;
  }
  const discovery = value.discovery;
  if (
    discovery !== undefined &&
    (!isObject(discovery) ||
      typeof discovery.authorization_endpoint !== "string" ||
      typeof discovery.token_endpoint !== "string" ||
      !optionalString(discovery.device_authorization_endpoint))
  ) {
    return undefined;
  }
  const authorizationEndpoint = isObject(discovery) ? discovery.authorization_endpoint : undefined;
  const tokenEndpoint = isObject(discovery) ? discovery.token_endpoint : undefined;
  const deviceAuthorizationEndpoint = isObject(discovery)
    ? discovery.device_authorization_endpoint
    : undefined;
  return toStoredCredential({
    access: value.access,
    refresh: value.refresh,
    expires: value.expires,
    ...(typeof value.tokenEndpoint === "string" ? { tokenEndpoint: value.tokenEndpoint } : {}),
    ...(typeof authorizationEndpoint === "string" && typeof tokenEndpoint === "string"
      ? {
          discovery: {
            authorization_endpoint: authorizationEndpoint,
            token_endpoint: tokenEndpoint,
            ...(typeof deviceAuthorizationEndpoint === "string"
              ? { device_authorization_endpoint: deviceAuthorizationEndpoint }
              : {}),
          },
        }
      : {}),
    ...(typeof value.idToken === "string" ? { idToken: value.idToken } : {}),
    ...(typeof value.tokenType === "string" ? { tokenType: value.tokenType } : {}),
    ...(typeof value.baseUrl === "string" ? { baseUrl: value.baseUrl } : {}),
    ...(typeof value.principalType === "string" ? { principalType: value.principalType } : {}),
    ...(typeof value.principalId === "string" ? { principalId: value.principalId } : {}),
    ...(typeof value.teamId === "string" ? { teamId: value.teamId } : {}),
  });
}

export function defaultAccountVault(): AccountVault {
  return {
    version: 1,
    nextSlot: 2,
    accounts: [{ id: ACCOUNT_1_ID, slot: 1, label: "Account 1", revision: 0 }],
  };
}

export function parseAccountVault(value: unknown, path: string): AccountVault {
  const invalid = (reason: string): never => {
    throw new Error(`Invalid Grok CLI account vault at ${path}: ${reason}`);
  };
  if (!isObject(value)) return invalid("root must be a JSON object");
  if (value.version !== 1) invalid("unsupported version");
  if (!Number.isInteger(value.nextSlot) || Number(value.nextSlot) < 2) invalid("invalid next slot");
  const rawAccounts = value.accounts;
  if (!Array.isArray(rawAccounts) || rawAccounts.length === 0) {
    return invalid("accounts are missing");
  }

  const ids = new Set<string>();
  const slots = new Set<number>();
  const labels = new Set<string>();
  const accounts = rawAccounts.map((candidate: unknown, index): VaultAccount => {
    if (
      !isObject(candidate) ||
      typeof candidate.id !== "string" ||
      !candidate.id ||
      !Number.isInteger(candidate.slot) ||
      Number(candidate.slot) < 1 ||
      typeof candidate.label !== "string" ||
      !candidate.label.trim() ||
      typeof candidate.revision !== "number" ||
      !Number.isInteger(candidate.revision) ||
      candidate.revision < 0
    ) {
      return invalid(`invalid account at index ${index}`);
    }
    const slot = Number(candidate.slot);
    const label = candidate.label.trim();
    if (ids.has(candidate.id) || slots.has(slot) || labels.has(label.toLocaleLowerCase())) {
      return invalid(`duplicate account at index ${index}`);
    }
    const credential =
      candidate.credential === undefined ? undefined : parseStoredCredential(candidate.credential);
    if (candidate.credential !== undefined && !credential) {
      return invalid(`invalid credential at index ${index}`);
    }
    ids.add(candidate.id);
    slots.add(slot);
    labels.add(label.toLocaleLowerCase());
    return {
      id: candidate.id,
      slot,
      label,
      ...(credential ? { credential } : {}),
      revision: candidate.revision,
    };
  });

  if (accounts[0]?.id !== ACCOUNT_1_ID || accounts[0].slot !== 1) {
    invalid("Account 1 must be first and permanent");
  }
  if (
    value.activeAccountId !== undefined &&
    (typeof value.activeAccountId !== "string" ||
      !accounts.some((account) => account.id === value.activeAccountId && account.credential))
  ) {
    invalid("active account must be logged in");
  }
  return {
    version: 1,
    nextSlot: Number(value.nextSlot),
    ...(typeof value.activeAccountId === "string" ? { activeAccountId: value.activeAccountId } : {}),
    accounts,
  };
}

export function loadAccountVault(path = getAccountVaultPath()): AccountVault {
  if (!existsSync(path)) return defaultAccountVault();
  return parseAccountVault(readJsonFile(path), path);
}

export function saveAccountVault(vault: AccountVault, path = getAccountVaultPath()) {
  const stored = parseAccountVault(vault, path);
  writeJsonAtomic(path, stored);
}

export async function mutateAccountVault(
  mutate: (vault: AccountVault) => void,
  path = getAccountVaultPath(),
): Promise<AccountVault> {
  const previous = locks.get(path) ?? Promise.resolve();
  const run = previous.then(() => {
    const vault = loadAccountVault(path);
    mutate(vault);
    saveAccountVault(vault, path);
    return loadAccountVault(path);
  });
  locks.set(
    path,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}
