import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { FastLabelFormatter } from "./fast-label-formatter.ts";
import type { FastColorMode, FastColorValue } from "./fast-colors.ts";
import {
  normalizeThinkingLevel,
  renderThemeMatchedFastLabel,
  type ThinkingLevel,
} from "./theme-matched-fast-label-renderer.ts";

/*
 * Portions of this file are adapted from Pi's default footer renderer:
 * @earendil-works/pi-coding-agent v0.75.3
 * packages/coding-agent/src/modes/interactive/components/footer.ts
 * pi-mono commit 144b93861f339ce353531f6873d377a1e4b2f5c4.
 *
 * Original project license: MIT License.
 * Copyright (c) 2025 Mario Zechner.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export interface FooterCloneTheme {
  fg(color: "dim" | "error" | "warning" | string, text: string): string;
  name?: string | undefined;
  getColorMode?: () => FastColorMode;
  getThinkingBorderColor?: (level: ThinkingLevel) => ((text: string) => string) | undefined;
}

export interface FooterCloneTui {
  requestRender(force?: boolean): void;
}

export interface FooterCloneModel {
  provider: string;
  id: string;
  reasoning?: boolean | undefined;
  contextWindow?: number | undefined;
}

export interface FooterCloneContextUsage {
  percent?: number | null | undefined;
  contextWindow?: number | undefined;
}

export interface FooterCloneSessionManager {
  getCwd(): string;
  getSessionName(): string | undefined;
  getEntries(): readonly FooterCloneSessionEntry[];
}

export interface FooterCloneModelRegistry {
  isUsingOAuth(model: FooterCloneModel): boolean;
}

export interface FooterCloneContext {
  model?: FooterCloneModel | undefined;
  sessionManager: FooterCloneSessionManager;
  modelRegistry: FooterCloneModelRegistry;
  getContextUsage(): FooterCloneContextUsage | undefined;
}

export interface FooterCloneFooterData {
  getGitBranch(): string | null | undefined;
  getExtensionStatuses(): ReadonlyMap<string, string>;
  getAvailableProviderCount(): number;
  onBranchChange?: (callback: () => void) => () => void;
}

export interface FooterCloneUsage {
  input?: number | undefined;
  output?: number | undefined;
  cacheRead?: number | undefined;
  cacheWrite?: number | undefined;
  cost?: { total?: number | undefined } | undefined;
}

export interface FooterCloneSessionEntry {
  type: string;
  message?: {
    role?: string | undefined;
    usage?: FooterCloneUsage | undefined;
  };
}

export interface FooterCloneOptions {
  context?: FooterCloneContext | undefined;
  getContext?: (() => FooterCloneContext | undefined) | undefined;
  footerData: FooterCloneFooterData;
  theme: FooterCloneTheme;
  labelFormatter: FastLabelFormatter;
  isFastActive: () => boolean;
  getThinkingLevel: () => string | undefined;
  fastLabelColors?: {
    dark?: FastColorValue;
    light?: FastColorValue;
    vars?: Record<string, string>;
  };
  tui?: FooterCloneTui | undefined;
}

/**
 * Sanitize text for display in a single-line status.
 * Removes newlines, tabs, carriage returns, and other control characters.
 */
function sanitizeStatusText(text: string): string {
  // Replace newlines, tabs, carriage returns with space, then collapse multiple spaces
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

/**
 * Format token counts for compact footer display.
 */
function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

function numberOrZero(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const ANSI_FAST_LABEL_PATTERN = /\x1b\[[0-9;]*mfast\x1b\[39m/g;

function findLastAnsiFastLabel(text: string): { index: number; label: string } | undefined {
  ANSI_FAST_LABEL_PATTERN.lastIndex = 0;
  let current: RegExpExecArray | null;
  let last: { index: number; label: string } | undefined;

  while ((current = ANSI_FAST_LABEL_PATTERN.exec(text)) !== null) {
    last = { index: current.index, label: current[0] };
  }

  ANSI_FAST_LABEL_PATTERN.lastIndex = 0;
  return last;
}

function dimFooterRemainder(theme: FooterCloneTheme, text: string): string {
  const fastLabel = findLastAnsiFastLabel(text);
  if (!fastLabel) {
    return theme.fg("dim", text);
  }

  const beforeFastLabel = text.slice(0, fastLabel.index);
  const afterFastLabel = text.slice(fastLabel.index + fastLabel.label.length);

  return [
    beforeFastLabel ? theme.fg("dim", beforeFastLabel) : "",
    fastLabel.label,
    afterFastLabel ? theme.fg("dim", afterFastLabel) : "",
  ].join("");
}

/**
 * Owned clone of Pi's default footer with the intentional change constrained to
 * model-label construction for the active Fast Mode label.
 */
export class FooterClone implements Component {
  private autoCompactEnabled = true;
  private readonly getContext: () => FooterCloneContext | undefined;
  private readonly footerData: FooterCloneFooterData;
  private readonly theme: FooterCloneTheme;
  private readonly labelFormatter: FastLabelFormatter;
  private readonly isFastActive: () => boolean;
  private readonly getThinkingLevel: () => string | undefined;
  private readonly fastLabelColors: {
    dark?: FastColorValue | undefined;
    light?: FastColorValue | undefined;
    vars: Record<string, string>;
  };
  private readonly isThemeLight: boolean;
  private readonly colorMode: FastColorMode;
  private readonly tui: FooterCloneTui | undefined;
  private readonly disposeCallbacks: Array<() => void> = [];
  private ownedByExtension = true;

  constructor(options: FooterCloneOptions) {
    this.getContext = options.getContext ?? (() => options.context);
    this.footerData = options.footerData;
    this.theme = options.theme;
    this.labelFormatter = options.labelFormatter;
    this.isFastActive = options.isFastActive;
    this.getThinkingLevel = options.getThinkingLevel;
    this.fastLabelColors = {
      dark: options.fastLabelColors?.dark,
      light: options.fastLabelColors?.light,
      vars: { ...(options.fastLabelColors?.vars ?? {}) },
    };
    this.isThemeLight = options.theme.name?.toLowerCase() === "light";
    this.colorMode = options.theme.getColorMode?.() ?? "256color";
    this.tui = options.tui;

    if (typeof options.footerData.onBranchChange === "function") {
      const unsubscribe = options.footerData.onBranchChange(() => {
        this.invalidate();
      });
      if (typeof unsubscribe === "function") {
        this.disposeCallbacks.push(unsubscribe);
      }
    }
  }

  setAutoCompactEnabled(enabled: boolean): void {
    this.autoCompactEnabled = enabled;
  }

  invalidate(): void {
    this.tui?.requestRender();
  }

  isOwnedByExtension(): boolean {
    return this.ownedByExtension;
  }

  dispose(): void {
    this.ownedByExtension = false;

    for (const dispose of this.disposeCallbacks) {
      dispose();
    }
    this.disposeCallbacks.length = 0;
  }

  render(width: number): string[] {
    const context = this.getContext();
    if (!context) {
      return [];
    }

    const renderWidth = Math.max(0, Math.floor(width));
    const state = {
      model: context.model,
      thinkingLevel: normalizeThinkingLevel(this.getThinkingLevel()),
    };

    // Calculate cumulative usage from ALL session entries (not just post-compaction messages)
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let totalCost = 0;

    for (const entry of context.sessionManager.getEntries()) {
      if (entry.type === "message" && entry.message?.role === "assistant") {
        const usage = entry.message.usage;
        totalInput += numberOrZero(usage?.input);
        totalOutput += numberOrZero(usage?.output);
        totalCacheRead += numberOrZero(usage?.cacheRead);
        totalCacheWrite += numberOrZero(usage?.cacheWrite);
        totalCost += numberOrZero(usage?.cost?.total);
      }
    }

    // Calculate context usage from session (handles compaction correctly).
    // After compaction, tokens are unknown until the next LLM response.
    const contextUsage = context.getContextUsage();
    const contextWindow = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
    const contextPercentValue = contextUsage?.percent ?? 0;
    const contextPercent = contextUsage?.percent !== null ? contextPercentValue.toFixed(1) : "?";

    // Replace home directory with ~
    let pwd = context.sessionManager.getCwd();
    const home = process.env.HOME || process.env.USERPROFILE;
    if (home && pwd.startsWith(home)) {
      pwd = `~${pwd.slice(home.length)}`;
    }

    // Add git branch if available
    const branch = this.footerData.getGitBranch();
    if (branch) {
      pwd = `${pwd} (${branch})`;
    }

    // Add session name if set
    const sessionName = context.sessionManager.getSessionName();
    if (sessionName) {
      pwd = `${pwd} • ${sessionName}`;
    }

    // Build stats line
    const statsParts = [];
    if (totalInput) statsParts.push(`↑${formatTokens(totalInput)}`);
    if (totalOutput) statsParts.push(`↓${formatTokens(totalOutput)}`);
    if (totalCacheRead) statsParts.push(`R${formatTokens(totalCacheRead)}`);
    if (totalCacheWrite) statsParts.push(`W${formatTokens(totalCacheWrite)}`);

    // Show cost with "(sub)" indicator if using OAuth subscription
    const usingSubscription = state.model ? context.modelRegistry.isUsingOAuth(state.model) : false;
    if (totalCost || usingSubscription) {
      const costStr = `$${totalCost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`;
      statsParts.push(costStr);
    }

    // Colorize context percentage based on usage
    let contextPercentStr: string;
    const autoIndicator = this.autoCompactEnabled ? " (auto)" : "";
    const contextPercentDisplay =
      contextPercent === "?"
        ? `?/${formatTokens(contextWindow)}${autoIndicator}`
        : `${contextPercent}%/${formatTokens(contextWindow)}${autoIndicator}`;
    if (contextPercentValue > 90) {
      contextPercentStr = this.theme.fg("error", contextPercentDisplay);
    } else if (contextPercentValue > 70) {
      contextPercentStr = this.theme.fg("warning", contextPercentDisplay);
    } else {
      contextPercentStr = contextPercentDisplay;
    }
    statsParts.push(contextPercentStr);

    let statsLeft = statsParts.join(" ");

    // Add model name on the right side, plus thinking level if model supports it
    const modelName = state.model?.id || "no-model";
    const modelLabel = this.labelFormatter.formatModelLabel(modelName, {
      active: this.isFastActive(),
      darkFastColor: this.fastLabelColors.dark,
      lightFastColor: this.fastLabelColors.light,
      footerVars: this.fastLabelColors.vars,
      isLightTheme: this.isThemeLight,
      colorMode: this.colorMode,
      renderDefaultActiveLabel: () => renderThemeMatchedFastLabel(this.theme, state.thinkingLevel),
    });

    let statsLeftWidth = visibleWidth(statsLeft);

    // If statsLeft is too wide, truncate it
    if (statsLeftWidth > renderWidth) {
      statsLeft = truncateToWidth(statsLeft, renderWidth, "...");
      statsLeftWidth = visibleWidth(statsLeft);
    }

    // Calculate available space for padding (minimum 2 spaces between stats and model)
    const minPadding = 2;

    // Add thinking level indicator if model supports reasoning
    let rightSideWithoutProvider = modelLabel;
    if (state.model?.reasoning) {
      rightSideWithoutProvider =
        state.thinkingLevel === "off" ? `${modelLabel} • thinking off` : `${modelLabel} • ${state.thinkingLevel}`;
    }

    // Prepend the provider in parentheses if there are multiple providers and there's enough room
    let rightSide = rightSideWithoutProvider;
    if (this.footerData.getAvailableProviderCount() > 1 && state.model) {
      rightSide = `(${state.model.provider}) ${rightSideWithoutProvider}`;
      if (statsLeftWidth + minPadding + visibleWidth(rightSide) > renderWidth) {
        // Too wide, fall back
        rightSide = rightSideWithoutProvider;
      }
    }

    const rightSideWidth = visibleWidth(rightSide);
    const totalNeeded = statsLeftWidth + minPadding + rightSideWidth;

    let statsLine: string;
    if (totalNeeded <= renderWidth) {
      // Both fit - add padding to right-align model
      const padding = " ".repeat(renderWidth - statsLeftWidth - rightSideWidth);
      statsLine = statsLeft + padding + rightSide;
    } else {
      // Need to truncate right side
      const availableForRight = renderWidth - statsLeftWidth - minPadding;
      if (availableForRight > 0) {
        const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
        const truncatedRightWidth = visibleWidth(truncatedRight);
        const padding = " ".repeat(Math.max(0, renderWidth - statsLeftWidth - truncatedRightWidth));
        statsLine = statsLeft + padding + truncatedRight;
      } else {
        // Not enough space for right side at all
        statsLine = statsLeft;
      }
    }

    // Apply dim to footer sections rather than wrapping the whole line. statsLeft can
    // contain context color codes, and the active fast label owns its foreground while
    // the right-side suffix still needs to return to dim styling after the label reset.
    const dimStatsLeft = this.theme.fg("dim", statsLeft);
    const remainder = statsLine.slice(statsLeft.length); // padding + rightSide
    const dimRemainder = dimFooterRemainder(this.theme, remainder);

    const pwdLine = truncateToWidth(this.theme.fg("dim", pwd), renderWidth, this.theme.fg("dim", "..."));
    const lines = [pwdLine, dimStatsLeft + dimRemainder];

    // Add extension statuses on a single line, sorted by key alphabetically
    const extensionStatuses = this.footerData.getExtensionStatuses();
    if (extensionStatuses.size > 0) {
      const sortedStatuses = Array.from(extensionStatuses.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, text]) => sanitizeStatusText(text));
      const statusLine = sortedStatuses.join(" ");
      // Truncate to terminal width with dim ellipsis for consistency with footer style
      lines.push(truncateToWidth(statusLine, renderWidth, this.theme.fg("dim", "...")));
    }

    return lines;
  }
}
