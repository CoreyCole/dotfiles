import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { FAST_MODEL, routeFastModel } from "./lib/default-model.ts";

/**
 * xai/fast follows Pi's default model.
 * Do not pin a model version for this alias.
 */
export default function (pi: ExtensionAPI) {
  pi.registerVirtualModel({
    provider: FAST_MODEL.provider,
    id: FAST_MODEL.id,
    name: FAST_MODEL.id,
    thinkingLevels: ["off", "minimal", "low", "medium", "high", "xhigh", "max"],
    input: ["text", "image"],
    route(request, ctx) {
      return routeFastModel(request, (provider, id) =>
        ctx.modelRegistry.find(provider, id),
      );
    },
  });
}
