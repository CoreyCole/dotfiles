import { complete, type Model, type Api } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const skillPattern = /^\/skill:(\S+)\s*([\s\S]*)/;
const planRootPattern = /((?:\/)?(?:[^/\s"'`()]+\/)*thoughts\/[^/\s"'`()]+\/plans\/[^/\s"'`()]+)/;
const PLAN_CLASSIFICATION_TYPE = "plan-classification";
const QRSPI_RESULT_TYPE = "qrspi-result";

const SUMMARY_PROMPT =
  "Summarize the user's request in 5-10 words max. Output ONLY the summary, nothing else. No quotes, no punctuation at the end.";

const HAIKU_MODEL_ID = "claude-haiku-4-5";

type PlanClassification = {
  planDir: string;
  source: "prompt-path" | "cwd";
};

type QrspiResult = {
  stage: string;
  next: string;
};

async function pickCheapModel(ctx: {
  model: Model<Api> | undefined;
  modelRegistry: {
    find: (p: string, id: string) => Model<Api> | undefined;
    getApiKeyAndHeaders: (m: Model<Api>) => Promise<{ ok: true; apiKey?: string; headers?: Record<string, string> } | { ok: false; error: string }>;
  };
}): Promise<{ model: Model<Api>; apiKey?: string; headers?: Record<string, string> } | null> {
  const haiku = ctx.modelRegistry.find("anthropic", HAIKU_MODEL_ID);
  if (haiku) {
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(haiku);
    if (auth.ok) return { model: haiku, apiKey: auth.apiKey, headers: auth.headers };
  }
  if (ctx.model) {
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
    if (auth.ok) return { model: ctx.model, apiKey: auth.apiKey, headers: auth.headers };
  }
  return null;
}

function normalizePlanDir(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const normalized = path.replace(/\\/g, "/").trim().replace(/\/+$/, "");
  if (!normalized) return undefined;
  const match = normalized.match(planRootPattern);
  return match?.[1];
}

function resolvePlanClassification(text: string, cwd: string): PlanClassification | undefined {
  const fromPrompt = normalizePlanDir(text);
  if (fromPrompt) {
    return { planDir: fromPrompt, source: "prompt-path" };
  }

  const fromCwd = normalizePlanDir(cwd);
  if (fromCwd) {
    return { planDir: fromCwd, source: "cwd" };
  }

  return undefined;
}

function getLatestPlanClassification(ctx: { sessionManager: { getEntries: () => Array<any> } }): PlanClassification | undefined {
  const entries = ctx.sessionManager.getEntries();
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry?.type !== "custom" || entry?.customType !== PLAN_CLASSIFICATION_TYPE) continue;
    const planDir = normalizePlanDir(entry?.data?.planDir);
    const source = entry?.data?.source;
    if (!planDir || (source !== "prompt-path" && source !== "cwd")) continue;
    return { planDir, source };
  }
  return undefined;
}

function tagPattern(tagName: string): string {
  return tagName.split("").map((char) => `${char}\\s*`).join("");
}

function extractXmlTag(text: string, tagName: string): string | undefined {
  return extractXmlTags(text, tagName)[0];
}

function extractLatestXmlTag(text: string, tagName: string): string | undefined {
  return extractXmlTags(text, tagName).at(-1);
}

function extractXmlTags(text: string, tagName: string): string[] {
  const tag = tagPattern(tagName);
  return [...text.matchAll(new RegExp(`<\\s*${tag}(?:\\s+[^>]*)?>\\s*([\\s\\S]*?)\\s*<\\s*/\\s*${tag}>`, "gi"))].map(
    (match) => match[1],
  );
}

function normalizeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeNextText(text: string): string {
  const decoded = normalizeXmlText(text);
  const steps = extractXmlTags(decoded, "step")
    .map((step) => normalizePlainNextText(normalizeXmlText(step)))
    .filter(Boolean);
  if (steps.length > 0) {
    return pickNextStageStep(steps) ?? steps.join(" ");
  }

  return normalizePlainNextText(decoded);
}

function normalizePlainNextText(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0].replace(/\s+/g, " ").trim();

  const [first, ...rest] = lines;
  if (first.startsWith("/") && rest.length > 0) {
    return `${first.replace(/\s+/g, " ").trim()} ${rest.join("")}`.trim();
  }
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

function pickNextStageStep(steps: string[]): string | undefined {
  return steps.find((step) => /\b(?:start|resume)\b[\s\S]*\/(?:skill:)?q-[a-z0-9-]+\b/i.test(step))
    ?? steps.find((step) => /\/(?:skill:)?q-[a-z0-9-]+\b/i.test(step));
}

function parseQrspiResult(text: string): QrspiResult | undefined {
  const result = extractLatestXmlTag(text, "qrspi-result");
  if (!result) return undefined;

  const stage = normalizeXmlText(extractXmlTag(result, "stage") ?? "");
  const next = normalizeNextText(extractXmlTag(result, "next") ?? "");
  if (!stage || !next) return undefined;
  return { stage, next };
}

function formatNextStage(next: string): string {
  const normalized = normalizeNextText(next);
  const match = normalized.match(/\/(?:skill:)?(q-[a-z0-9-]+)\b/i) ?? normalized.match(/\b(q-[a-z0-9-]+)\b/i);
  if (match) return match[1];

  const tagStripped = normalizePlainNextText(normalized.replace(/<\/?[^>]+>/g, " "));
  return tagStripped.split(/\s+/, 1)[0] || "next";
}

export default function (pi: ExtensionAPI) {
  let named = false;

  pi.on("session_start", () => {
    named = !!pi.getSessionName();
  });

  pi.on("input", async (event, ctx) => {
    const qrspi = parseQrspiResult(event.text);
    const classification = resolvePlanClassification(qrspi ? `${qrspi.next}\n${event.text}` : event.text, ctx.cwd);
    if (classification) {
      const latest = getLatestPlanClassification(ctx);
      if (!latest || latest.planDir !== classification.planDir || latest.source !== classification.source) {
        pi.appendEntry(PLAN_CLASSIFICATION_TYPE, classification);
      }
    }

    if (qrspi) {
      pi.appendEntry(QRSPI_RESULT_TYPE, {
        ...qrspi,
        planDir: classification?.planDir,
      });
      if (!named) {
        named = true;
        pi.setSessionName(`[qrspi:${formatNextStage(qrspi.next)}] <- ${qrspi.stage}`);
      }
      return;
    }

    if (named) return;

    const match = event.text.match(skillPattern);
    if (!match) return;

    const skillName = match[1];
    const userPrompt = match[2].trim();
    named = true;

    if (!userPrompt) {
      pi.setSessionName(`[${skillName}]`);
      return;
    }

    pi.setSessionName(`[${skillName}] ${userPrompt.slice(0, 60)}`);

    const cheap = await pickCheapModel(ctx);
    if (!cheap) return;

    try {
      const response = await complete(
        cheap.model,
        {
          systemPrompt: SUMMARY_PROMPT,
          messages: [{ role: "user", content: [{ type: "text", text: userPrompt }], timestamp: Date.now() }],
        },
        { apiKey: cheap.apiKey, headers: cheap.headers },
      );

      const summary = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("")
        .trim();

      if (summary) {
        pi.setSessionName(`[${skillName}] ${summary}`);
      }
    } catch {
      // Keep the truncated name, no big deal
    }
  });
}
