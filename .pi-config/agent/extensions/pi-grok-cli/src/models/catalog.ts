import type { ModelCost, ThinkingLevelMap } from "@earendil-works/pi-ai";

export interface GrokCliModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: ModelCost;
  contextWindow: number;
  maxTokens: number;
  thinkingLevelMap?: ThinkingLevelMap;
}

const textImage = ["text", "image"] as ("text" | "image")[];

export function resolveModels(): GrokCliModelConfig[] {
  return [
    {
      id: "grok-build",
      name: "Grok Build",
      reasoning: true,
      input: textImage,
      cost: { input: 1, output: 2, cacheRead: 0.2, cacheWrite: 0.2 },
      contextWindow: 500_000,
      maxTokens: 30_000,
    },
    {
      id: "grok-4.7",
      name: "Grok 4.7",
      reasoning: true,
      input: textImage,
      cost: { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 0 },
      contextWindow: 500_000,
      maxTokens: 30_000,
      thinkingLevelMap: { xhigh: "xhigh" },
    },
    {
      id: "grok-4.5",
      name: "Grok 4.5",
      reasoning: true,
      input: textImage,
      cost: { input: 2, output: 6, cacheRead: 0.3, cacheWrite: 0 },
      contextWindow: 500_000,
      maxTokens: 30_000,
    },
  ];
}
