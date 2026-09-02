export type FastColorValue = string | number;
export type FastColorMode = "truecolor" | "256color";

export interface FastColorFormatterOptions {
  mode: FastColorMode;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const INTEGER_INDEX = /^\d+$/;
const COLOR_VAR_REFERENCE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const LEGACY_FAST_LABEL_COLOR_LITERALS = new Set(["#ff50be", "#d20000"]);

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidIntegerColorIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

/**
 * Normalize raw JSON values into a supported fast color token.
 *
 * The fast color token supports:
 * - hex color strings ("#rrggbb")
 * - 256-color integer indexes as numbers or numeric strings
 * - variable names that map to another token in theme-style vars
 * - empty string to request terminal default foreground
 */
export function normalizeFastColorValue(value: unknown): FastColorValue | undefined {
  if (typeof value === "number") {
    return isValidIntegerColorIndex(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed === "" || HEX_COLOR.test(trimmed)) {
    return trimmed;
  }

  if (INTEGER_INDEX.test(trimmed)) {
    const index = Number(trimmed);
    return isValidIntegerColorIndex(index) ? trimmed : undefined;
  }

  if (COLOR_VAR_REFERENCE.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

/**
 * Literal-only legacy color classification used by config migration.
 *
 * Variable names are intentionally not resolved here: a variable-valued override
 * remains user-owned even when the variable maps to an old generated literal.
 */
export function isLegacyFastLabelColorLiteral(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = normalizeFastColorValue(value);
  return typeof normalized === "string" && LEGACY_FAST_LABEL_COLOR_LITERALS.has(normalized.toLowerCase());
}

export type FastColorResolutionFailureReason = "invalid-value" | "missing-variable" | "circular-variable";

export type FastColorResolutionResult =
  | { kind: "resolved"; value: FastColorValue }
  | { kind: "invalid"; reason: FastColorResolutionFailureReason; reference?: string | undefined };

function resolveVariableRef(
  value: string,
  vars: Readonly<Record<string, string>>,
  visited: Set<string>,
): FastColorResolutionResult {
  if (!COLOR_VAR_REFERENCE.test(value)) {
    return { kind: "invalid", reason: "invalid-value" };
  }

  if (visited.has(value)) {
    return { kind: "invalid", reason: "circular-variable", reference: value };
  }

  if (!isStringRecord(vars) || !Object.prototype.hasOwnProperty.call(vars, value)) {
    return { kind: "invalid", reason: "missing-variable", reference: value };
  }

  const resolved = (vars as Readonly<Record<string, unknown>>)[value];
  if (typeof resolved !== "string") {
    return { kind: "invalid", reason: "missing-variable", reference: value };
  }

  visited.add(value);
  const normalized = normalizeFastColorValue(resolved.trim());
  if (normalized === undefined) {
    return { kind: "invalid", reason: "invalid-value", reference: value };
  }

  return resolveFastColorValueDetailed(normalized, vars, visited);
}

export function resolveFastColorValueDetailed(
  value: FastColorValue,
  vars: Readonly<Record<string, string>>,
  visited = new Set<string>(),
): FastColorResolutionResult {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return { kind: "resolved", value: "" };
    }

    if (HEX_COLOR.test(trimmed) || INTEGER_INDEX.test(trimmed)) {
      const normalized = normalizeFastColorValue(trimmed);
      return normalized === undefined
        ? { kind: "invalid", reason: "invalid-value" }
        : { kind: "resolved", value: normalized };
    }

    return resolveVariableRef(trimmed, vars, visited);
  }

  return isValidIntegerColorIndex(value)
    ? { kind: "resolved", value }
    : { kind: "invalid", reason: "invalid-value" };
}

/**
 * Resolve nested variable references to an ANSI-ready color token.
 *
 * Returns `undefined` when a variable chain is missing or circular.
 */
export function resolveFastColorValue(
  value: FastColorValue,
  vars: Readonly<Record<string, string>>,
  visited = new Set<string>(),
): FastColorValue | undefined {
  const resolution = resolveFastColorValueDetailed(value, vars, visited);
  return resolution.kind === "resolved" ? resolution.value : undefined;
}

const ANSI_RESET_FOREGROUND = "\x1b[39m";

const CUBE_VALUES = [0, 95, 135, 175, 215, 255];
const GRAY_VALUES = Array.from({ length: 24 }, (_, i) => 8 + i * 10);

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const r = Number.parseInt(cleaned.substring(0, 2), 16);
  const g = Number.parseInt(cleaned.substring(2, 4), 16);
  const b = Number.parseInt(cleaned.substring(4, 6), 16);

  if ([r, g, b].some((component) => Number.isNaN(component))) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return { r, g, b };
}

function findClosestIndex(values: number[], value: number): number {
  let minDistance = Infinity;
  let minIndex = 0;

  for (const [index, candidate] of values.entries()) {
    const distance = Math.abs(value - candidate);
    if (distance < minDistance) {
      minDistance = distance;
      minIndex = index;
    }
  }

  return minIndex;
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dR = r1 - r2;
  const dG = g1 - g2;
  const dB = b1 - b2;
  return dR * dR * 0.299 + dG * dG * 0.587 + dB * dB * 0.114;
}

function rgbTo256Index(r: number, g: number, b: number): number {
  const rIndex = findClosestIndex(CUBE_VALUES, r);
  const gIndex = findClosestIndex(CUBE_VALUES, g);
  const bIndex = findClosestIndex(CUBE_VALUES, b);

  const cubeR = CUBE_VALUES[rIndex];
  const cubeG = CUBE_VALUES[gIndex];
  const cubeB = CUBE_VALUES[bIndex];
  const cubeIndex = 16 + 36 * rIndex + 6 * gIndex + bIndex;
  const cubeDistance = colorDistance(r, g, b, cubeR, cubeG, cubeB);

  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const grayIndex = findClosestIndex(GRAY_VALUES, gray);
  const grayValue = GRAY_VALUES[grayIndex];
  const grayDistance = colorDistance(r, g, b, grayValue, grayValue, grayValue);

  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread < 10 && grayDistance < cubeDistance) {
    return 232 + grayIndex;
  }

  return cubeIndex;
}

function ansiFromHex(color: string, mode: FastColorMode): string {
  const rgb = hexToRgb(color);
  if (mode === "truecolor") {
    return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`;
  }

  const index = rgbTo256Index(rgb.r, rgb.g, rgb.b);
  return `\x1b[38;5;${index}m`;
}

function colorToAnsi(color: FastColorValue, mode: FastColorMode): string {
  if (typeof color === "string") {
    if (color === "") {
      return ANSI_RESET_FOREGROUND;
    }

    if (INTEGER_INDEX.test(color)) {
      return `\x1b[38;5;${Number(color)}m`;
    }

    if (HEX_COLOR.test(color)) {
      return ansiFromHex(color, mode);
    }

    throw new Error(`Invalid color value: ${color}`);
  }

  if (isValidIntegerColorIndex(color)) {
    return `\x1b[38;5;${color}m`;
  }

  throw new Error(`Invalid color value: ${color}`);
}

/**
 * Convert a fast color token into a foreground ANSI sequence.
 */
export function fastColorToAnsi(color: FastColorValue, options: FastColorFormatterOptions): string {
  return colorToAnsi(color, options.mode);
}
