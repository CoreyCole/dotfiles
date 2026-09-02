import { fastColorToAnsi, resolveFastColorValue, type FastColorValue } from "./fast-colors.ts";

export interface FastLabelFormatOptions {
  active: boolean;
  darkFastColor?: FastColorValue | undefined;
  lightFastColor?: FastColorValue | undefined;
  footerVars?: Record<string, string> | undefined;
  isLightTheme?: boolean | undefined;
  colorMode?: "truecolor" | "256color" | undefined;
  renderDefaultActiveLabel?: (() => string) | undefined;
}

const ANSI_RESET_FOREGROUND = "\x1b[39m";

/**
 * Formatting seam for the inline Fast Mode footer label.
 */
export class FastLabelFormatter {
  private resolveConfiguredColor(options: FastLabelFormatOptions): FastColorValue | undefined {
    const colorToken = options.isLightTheme === true ? options.lightFastColor : options.darkFastColor;

    if (colorToken === undefined) {
      return undefined;
    }

    return resolveFastColorValue(colorToken, options.footerVars ?? {});
  }

  private renderDefaultActiveLabel(options: FastLabelFormatOptions): string {
    return options.renderDefaultActiveLabel?.() ?? "fast";
  }

  formatFastLabel(options: FastLabelFormatOptions): string {
    if (!options.active) {
      return "fast";
    }

    const color = this.resolveConfiguredColor(options);
    if (color === undefined) {
      return this.renderDefaultActiveLabel(options);
    }

    const colorMode: "truecolor" | "256color" = options.colorMode === "truecolor" ? "truecolor" : "256color";
    const ansi = fastColorToAnsi(color, { mode: colorMode });
    return `${ansi}fast${ANSI_RESET_FOREGROUND}`;
  }

  formatModelLabel(modelName: string, options: FastLabelFormatOptions): string {
    if (!options.active) {
      return modelName;
    }

    return `${modelName} ${this.formatFastLabel(options)}`;
  }
}
