import { lazyStream, type OAuthCredentials, type SimpleStreamOptions } from "@earendil-works/pi-ai";
import { streamSimpleOpenAIResponses } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI, ProviderConfig } from "@earendil-works/pi-coding-agent";
import { getBaseUrl } from "../auth/config.ts";
import { login, refresh, type XaiOAuthCredentials } from "../auth/oauth.ts";
import { resolveModels } from "../models/catalog.ts";
import { registerAccountCommand } from "./accounts.ts";
import { resolveAccountRoute } from "./accountRouting.ts";
import {
  ACCOUNT_1_ID,
  ACCOUNT_VAULT_MARKER,
  loadAccountVault,
  mutateAccountVault,
  toStoredCredential,
} from "./accountVault.ts";
import { grokCliModelHeaders, grokCliVersionHeaders, PINNED_GROK_CLI_VERSION } from "./stream.ts";

const marker = (): OAuthCredentials => ({
  access: ACCOUNT_VAULT_MARKER,
  refresh: ACCOUNT_VAULT_MARKER,
  expires: Number.MAX_SAFE_INTEGER,
});

function isMarker(credentials: OAuthCredentials) {
  return credentials.access === ACCOUNT_VAULT_MARKER && credentials.refresh === ACCOUNT_VAULT_MARKER;
}

export function registerGrokCli(pi: ExtensionAPI) {
  const oauthProvider = {
    name: "Grok CLI",
    usesCallbackServer: true,

    async login(callbacks) {
      const current = loadAccountVault();
      const account = current.accounts.find((candidate) => candidate.id === ACCOUNT_1_ID);
      if (!account) throw new Error("The permanent Grok CLI account is missing.");
      if (current.accounts.some((candidate) => candidate.credential)) return marker();

      const revision = account.revision;
      const credentials = (await login(callbacks)) as XaiOAuthCredentials;
      await mutateAccountVault((vault) => {
        const target = vault.accounts.find((candidate) => candidate.id === ACCOUNT_1_ID);
        if (!target) throw new Error("The permanent Grok CLI account is missing.");
        if (target.revision !== revision) {
          throw new Error("The account changed while login was in progress. Try again.");
        }
        target.credential = toStoredCredential(credentials);
        target.revision += 1;
        vault.activeAccountId = target.id;
      });
      return marker();
    },

    async refreshToken(credentials) {
      if (isMarker(credentials)) return marker();
      return refresh(credentials);
    },

    getApiKey(credentials) {
      return credentials.access;
    },
  } satisfies NonNullable<ProviderConfig["oauth"]>;

  pi.registerProvider("grok-cli", {
    name: "Grok CLI",
    baseUrl: getBaseUrl(),
    oauth: oauthProvider,
    api: "openai-responses",
    models: resolveModels().map((model) => ({
      id: model.id,
      name: model.name,
      reasoning: model.reasoning,
      thinkingLevelMap: model.thinkingLevelMap,
      input: model.input,
      cost: model.cost,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      headers: grokCliModelHeaders(model.id),
    })),
    streamSimple(model, context, options?: SimpleStreamOptions) {
      return lazyStream(model, async () => {
        const route = await resolveAccountRoute();
        return streamSimpleOpenAIResponses(
          { ...model, baseUrl: route.baseUrl, api: "openai-responses" },
          context,
          {
            ...options,
            apiKey: route.token,
            headers: {
              ...grokCliVersionHeaders(PINNED_GROK_CLI_VERSION),
              ...options?.headers,
            },
          },
        );
      });
    },
  });

  registerAccountCommand(pi);
}
