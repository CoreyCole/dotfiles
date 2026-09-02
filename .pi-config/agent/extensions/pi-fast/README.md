# Pi Fast Mode

The local extension name is `pi-fast`.

This extension started from `studioarray/pi-openai-fast` at commit `e82ed32f1b7c5a946d441d948da33de40da7b04a`.

Upstream repository: <https://github.com/studioarray/pi-openai-fast>

The local version supports OpenAI, OpenAI Codex, and xAI Grok models. It adds `service_tier: "priority"` to eligible provider requests.

xAI documents Priority Processing for Chat Completions and Responses. Priority Processing costs 2x the standard token rates.

- Priority Processing: <https://docs.x.ai/developers/advanced-api-usage/priority-processing>
- Pricing: <https://docs.x.ai/developers/pricing#priority-processing-pricing>

The `/fast` command toggles Fast Mode. The `--fast` flag enables it at startup.

New subagents inherit the requested Fast Mode state. Fast Mode becomes active only when the subagent uses a supported model.

The extension only changes requests for an exact model in `supportedModels`. It also requires a supported API and a matching payload model.

If another extension sets `service_tier`, this extension keeps that value.

The global settings use status mode. The custom Pi footer places the active `fast` label after the model and thinking level.

The MIT license from the upstream repository is in `LICENSE`.
