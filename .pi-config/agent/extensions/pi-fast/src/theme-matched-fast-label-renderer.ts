export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface ThemeMatchedFastLabelTheme {
  fg(color: "dim" | string, text: string): string;
  getThinkingBorderColor?: (level: ThinkingLevel) => ((text: string) => string) | undefined;
}

const NON_OFF_THINKING_LEVELS = new Set<ThinkingLevel>(["minimal", "low", "medium", "high", "xhigh"]);

export function normalizeThinkingLevel(value: string | undefined): ThinkingLevel {
  switch (value) {
    case "minimal":
    case "low":
    case "medium":
    case "high":
    case "xhigh":
      return value;
    default:
      return "off";
  }
}

export function renderThemeMatchedFastLabel(theme: ThemeMatchedFastLabelTheme, thinkingLevel: string | undefined): string {
  const normalizedThinkingLevel = normalizeThinkingLevel(thinkingLevel);

  if (!NON_OFF_THINKING_LEVELS.has(normalizedThinkingLevel)) {
    return theme.fg("dim", "fast");
  }

  try {
    const renderThinkingBorder = theme.getThinkingBorderColor?.(normalizedThinkingLevel);
    if (typeof renderThinkingBorder !== "function") {
      return theme.fg("dim", "fast");
    }

    return renderThinkingBorder("fast");
  } catch {
    return theme.fg("dim", "fast");
  }
}
