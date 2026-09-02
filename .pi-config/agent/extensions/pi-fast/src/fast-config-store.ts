import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { FastColorResolutionResult, FastColorValue } from "./fast-colors.ts";
import { isLegacyFastLabelColorLiteral, normalizeFastColorValue, resolveFastColorValueDetailed } from "./fast-colors.ts";
import { emitFastWarning, warnToConsole, type FastWarning } from "./fast-warnings.ts";

export const DEFAULT_SUPPORTED_MODELS = [
  "openai/gpt-5.4",
  "openai/gpt-5.5",
  "openai-codex/gpt-5.4",
  "openai-codex/gpt-5.5",
  "xai/grok-4.3",
  "xai/grok-4.5",
  "xai/grok-4.6",
  "xai/grok-build-0.1",
] as const;

export type FooterMode = "replace" | "status" | "off";

export interface FastFooterConfig {
  mode: FooterMode;
  vars: Record<string, string>;
  darkFastColor?: FastColorValue | undefined;
  lightFastColor?: FastColorValue | undefined;
}

export interface FastConfig {
  persistState: boolean;
  desiredActive: boolean;
  supportedModels: string[];
  footer: FastFooterConfig;
}

export const DEFAULT_FAST_CONFIG: FastConfig = {
  persistState: false,
  desiredActive: false,
  supportedModels: [...DEFAULT_SUPPORTED_MODELS],
  footer: {
    mode: "replace",
    vars: {},
  },
};

export type FastConfigWarningCode = Extract<
  FastWarning["code"],
  | "config-read-failed"
  | "config-default-write-failed"
  | "config-write-failed"
  | "config-malformed-write-refused"
  | "config-supported-models-not-array"
  | "config-supported-models-dropped"
  | "config-supported-models-all-invalid"
  | "config-fast-label-color-invalid"
>;

export interface FastConfigWarning extends FastWarning {
  code: FastConfigWarningCode;
  path: string;
}

export type FastConfigWarningSink = (warning: FastConfigWarning) => void;

export interface FastConfigStoreOptions {
  home?: string;
  warn?: FastConfigWarningSink;
}

export interface FastConfigOperationOptions {
  warn?: FastConfigWarningSink | undefined;
}

export interface FastConfigRepository {
  load(cwd: string, options?: FastConfigOperationOptions): Promise<FastConfig>;
  writeDesiredActive(cwd: string, desiredActive: boolean, options?: FastConfigOperationOptions): Promise<boolean>;
}

interface FastConfigPaths {
  project: string;
  global: string;
}

type JsonRecord = Record<string, unknown>;

interface ConfigWarningContext {
  path: string;
  warn: FastConfigWarningSink;
}

interface SupportedModelsNormalizationResult {
  supportedModels: string[] | undefined;
  invalidEntries: unknown[];
  allInvalid: boolean;
  notArray: boolean;
}

type FastLabelColorFieldName = "footer.darkFastColor" | "footer.lightFastColor";

function defaultFastConfig(): FastConfig {
  return {
    persistState: DEFAULT_FAST_CONFIG.persistState,
    desiredActive: DEFAULT_FAST_CONFIG.desiredActive,
    supportedModels: [...DEFAULT_FAST_CONFIG.supportedModels],
    footer: {
      mode: DEFAULT_FAST_CONFIG.footer.mode,
      vars: { ...DEFAULT_FAST_CONFIG.footer.vars },
    },
  };
}

function footerConfigToRawRecord(config: FastFooterConfig): JsonRecord {
  const footer: JsonRecord = {
    mode: config.mode,
    vars: { ...config.vars },
  };

  if (config.darkFastColor !== undefined) {
    footer.darkFastColor = config.darkFastColor;
  }

  if (config.lightFastColor !== undefined) {
    footer.lightFastColor = config.lightFastColor;
  }

  return footer;
}

function configToRawRecord(config: FastConfig): JsonRecord {
  return {
    persistState: config.persistState,
    desiredActive: config.desiredActive,
    supportedModels: [...config.supportedModels],
    footer: footerConfigToRawRecord(config.footer),
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFooterMode(value: unknown): value is FooterMode {
  return value === "replace" || value === "status" || value === "off";
}

function containsPatternIntentMetacharacter(value: string): boolean {
  return /[\*\[\]\(\)\{\}\?\+\|\^\$\\]/.test(value);
}

function normalizeSupportedModelEntry(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  const separatorIndex = trimmed.indexOf("/");

  if (
    trimmed.length === 0 ||
    /\s/.test(trimmed) ||
    separatorIndex <= 0 ||
    separatorIndex === trimmed.length - 1 ||
    containsPatternIntentMetacharacter(trimmed)
  ) {
    return undefined;
  }

  return trimmed;
}

function normalizeSupportedModels(value: unknown): SupportedModelsNormalizationResult {
  if (!Array.isArray(value)) {
    return { supportedModels: undefined, invalidEntries: [], allInvalid: false, notArray: true };
  }

  const supportedModels: string[] = [];
  const invalidEntries: unknown[] = [];

  for (const entry of value) {
    const normalized = normalizeSupportedModelEntry(entry);
    if (normalized === undefined) {
      invalidEntries.push(entry);
    } else {
      supportedModels.push(normalized);
    }
  }

  return {
    supportedModels,
    invalidEntries,
    allInvalid: value.length > 0 && supportedModels.length === 0,
    notArray: false,
  };
}

function parseJsonRecord(text: string): JsonRecord {
  const parsed: unknown = JSON.parse(text);

  if (!isRecord(parsed)) {
    throw new Error("Config JSON must be an object.");
  }

  return parsed;
}

function normalizeStringRecord(source: JsonRecord): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function hasOwnField(record: JsonRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

function migratedDesiredActive(source: JsonRecord, fallback: boolean): boolean {
  if (typeof source.desiredActive === "boolean") {
    return source.desiredActive;
  }

  if (!hasOwnField(source, "desiredActive") && typeof source.active === "boolean") {
    return source.active;
  }

  return fallback;
}

function invalidFastColorReason(resolution: FastColorResolutionResult | undefined): string {
  if (resolution?.kind !== "invalid") {
    return "it is not a supported color token";
  }

  if (resolution.reason === "missing-variable") {
    return `variable ${JSON.stringify(resolution.reference)} is not defined`;
  }

  if (resolution.reason === "circular-variable") {
    return `variable ${JSON.stringify(resolution.reference)} resolves circularly`;
  }

  return "it is not a supported color token";
}

function emitInvalidFastLabelColorWarning(
  warningContext: ConfigWarningContext | undefined,
  field: FastLabelColorFieldName,
  value: unknown,
  resolution?: FastColorResolutionResult | undefined,
): void {
  if (warningContext === undefined) {
    return;
  }

  emitWarning(warningContext.warn, {
    code: "config-fast-label-color-invalid",
    path: warningContext.path,
    name: field,
    value: describeWarningValue(value),
    message: `Ignored invalid Fast label color ${field} at ${warningContext.path}: ${describeWarningValue(value)} (${invalidFastColorReason(resolution)}).`,
  });
}

function normalizeConfiguredFastColorValue(
  value: unknown,
  vars: Readonly<Record<string, string>>,
  field: FastLabelColorFieldName,
  warningContext: ConfigWarningContext | undefined,
): FastColorValue | undefined {
  if (isLegacyFastLabelColorLiteral(value)) {
    return undefined;
  }

  const normalized = normalizeFastColorValue(value);
  if (normalized === undefined) {
    emitInvalidFastLabelColorWarning(warningContext, field, value);
    return undefined;
  }

  const resolution = resolveFastColorValueDetailed(normalized, vars);
  if (resolution.kind === "invalid") {
    emitInvalidFastLabelColorWarning(warningContext, field, value, resolution);
    return undefined;
  }

  return normalized;
}

function footerVarsForValidation(footer: JsonRecord): Record<string, string> {
  return isRecord(footer.vars) ? normalizeStringRecord(footer.vars) : {};
}

function sanitizeFooterRecordForWrite(source: JsonRecord, warningContext?: ConfigWarningContext): JsonRecord {
  const next: JsonRecord = { ...source };

  if (hasOwnField(next, "mode") && !isFooterMode(next.mode)) {
    delete next.mode;
  }

  if (hasOwnField(next, "vars")) {
    if (isRecord(next.vars)) {
      next.vars = normalizeStringRecord(next.vars);
    } else {
      delete next.vars;
    }
  }

  const vars = footerVarsForValidation(next);

  if (hasOwnField(next, "darkFastColor")) {
    const darkFastColor = normalizeConfiguredFastColorValue(
      next.darkFastColor,
      vars,
      "footer.darkFastColor",
      warningContext,
    );
    if (darkFastColor === undefined) {
      delete next.darkFastColor;
    } else {
      next.darkFastColor = darkFastColor;
    }
  }

  if (hasOwnField(next, "lightFastColor")) {
    const lightFastColor = normalizeConfiguredFastColorValue(
      next.lightFastColor,
      vars,
      "footer.lightFastColor",
      warningContext,
    );
    if (lightFastColor === undefined) {
      delete next.lightFastColor;
    } else {
      next.lightFastColor = lightFastColor;
    }
  }

  return next;
}

function sanitizeConfigRecordForWrite(source: JsonRecord, warningContext?: ConfigWarningContext): JsonRecord {
  const next: JsonRecord = { ...source };

  delete next.active;

  if (hasOwnField(next, "persistState") && typeof next.persistState !== "boolean") {
    delete next.persistState;
  }

  if (hasOwnField(next, "desiredActive") && typeof next.desiredActive !== "boolean") {
    delete next.desiredActive;
  }

  if (hasOwnField(next, "supportedModels")) {
    const supportedModels = normalizeSupportedModels(next.supportedModels);
    emitSupportedModelsWarnings(supportedModels, warningContext);
    if (supportedModels.supportedModels !== undefined) {
      next.supportedModels = supportedModels.supportedModels;
    } else {
      delete next.supportedModels;
    }
  }

  if (hasOwnField(next, "footer")) {
    if (isRecord(next.footer)) {
      next.footer = sanitizeFooterRecordForWrite(next.footer, warningContext);
    } else {
      delete next.footer;
    }
  }

  return next;
}

function mergeKnownConfig(base: FastConfig, source: JsonRecord, warningContext?: ConfigWarningContext): FastConfig {
  const next: FastConfig = {
    ...base,
    supportedModels: [...base.supportedModels],
    footer: { ...base.footer, vars: { ...base.footer.vars } },
  };

  if (typeof source.persistState === "boolean") {
    next.persistState = source.persistState;
  }
  next.desiredActive = migratedDesiredActive(source, next.desiredActive);
  if (hasOwnField(source, "supportedModels")) {
    const supportedModels = normalizeSupportedModels(source.supportedModels);
    emitSupportedModelsWarnings(supportedModels, warningContext);
    if (supportedModels.supportedModels !== undefined) {
      next.supportedModels = supportedModels.supportedModels;
    }
  }
  if (isRecord(source.footer)) {
    if (isFooterMode(source.footer.mode)) {
      next.footer.mode = source.footer.mode;
    }
    if (isRecord(source.footer.vars)) {
      next.footer.vars = normalizeStringRecord(source.footer.vars);
    }
    if (hasOwnField(source.footer, "darkFastColor")) {
      const darkFastColor = normalizeConfiguredFastColorValue(
        source.footer.darkFastColor,
        next.footer.vars,
        "footer.darkFastColor",
        warningContext,
      );
      if (darkFastColor !== undefined) {
        next.footer.darkFastColor = darkFastColor;
      }
    }
    if (hasOwnField(source.footer, "lightFastColor")) {
      const lightFastColor = normalizeConfiguredFastColorValue(
        source.footer.lightFastColor,
        next.footer.vars,
        "footer.lightFastColor",
        warningContext,
      );
      if (lightFastColor !== undefined) {
        next.footer.lightFastColor = lightFastColor;
      }
    }
  }

  return next;
}

type ConfigReadResult =
  | { kind: "missing" }
  | { kind: "loaded"; record: JsonRecord }
  | { kind: "failed" };

function defaultWarningSink(warning: FastConfigWarning): void {
  warnToConsole(warning);
}

function emitWarning(warn: FastConfigWarningSink, warning: FastConfigWarning): void {
  emitFastWarning(warn, warning);
}

function describeWarningValue(value: unknown): string {
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}

function emitSupportedModelsWarnings(
  result: SupportedModelsNormalizationResult,
  warningContext: ConfigWarningContext | undefined,
): void {
  if (warningContext === undefined) {
    return;
  }

  if (result.notArray) {
    emitWarning(warningContext.warn, {
      code: "config-supported-models-not-array",
      path: warningContext.path,
      message: `Ignored supportedModels at ${warningContext.path} because it must be an array of provider/model strings.`,
    });
    return;
  }

  if (result.invalidEntries.length > 0) {
    emitWarning(warningContext.warn, {
      code: "config-supported-models-dropped",
      path: warningContext.path,
      message: `Ignored invalid supportedModels entries at ${warningContext.path}: ${result.invalidEntries.map(describeWarningValue).join(", ")}.`,
    });
  }

  if (result.allInvalid) {
    emitWarning(warningContext.warn, {
      code: "config-supported-models-all-invalid",
      path: warningContext.path,
      message: `All supportedModels entries at ${warningContext.path} were invalid; Fast Mode has no supported models from that config layer.`,
    });
  }
}

function isMissingPathError(error: unknown): boolean {
  return isRecord(error) && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    return !isMissingPathError(error);
  }
}

async function readConfigRecord(path: string, warn: FastConfigWarningSink): Promise<ConfigReadResult> {
  try {
    return { kind: "loaded", record: parseJsonRecord(await readFile(path, "utf8")) };
  } catch (error) {
    if (isMissingPathError(error)) {
      return { kind: "missing" };
    }

    emitWarning(warn, {
      code: "config-read-failed",
      path,
      message: `Could not read pi-fast config at ${path}; using defaults for that config layer.`,
      cause: error,
    });
    return { kind: "failed" };
  }
}

async function readWriteTargetConfigRecord(path: string, warn: FastConfigWarningSink): Promise<ConfigReadResult> {
  try {
    return { kind: "loaded", record: parseJsonRecord(await readFile(path, "utf8")) };
  } catch (error) {
    if (isMissingPathError(error)) {
      return { kind: "missing" };
    }

    emitWarning(warn, {
      code: "config-malformed-write-refused",
      path,
      message: `Could not save Fast Mode preference because the config at ${path} could not be read as a JSON object and needs manual repair before saving Fast Mode preferences.`,
      cause: error,
    });
    return { kind: "failed" };
  }
}

async function writeConfigRecord(
  path: string,
  record: JsonRecord,
  warn: FastConfigWarningSink,
  code: FastConfigWarningCode,
): Promise<boolean> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    return true;
  } catch (error) {
    emitWarning(warn, {
      code,
      path,
      message: `Could not write pi-fast config at ${path}; the config update was not saved.`,
      cause: error,
    });
    return false;
  }
}

async function selectWriteTarget(paths: FastConfigPaths): Promise<string> {
  return (await pathExists(paths.project)) ? paths.project : paths.global;
}

function rawRecordForWrite(readResult: Extract<ConfigReadResult, { kind: "loaded" | "missing" }>): JsonRecord {
  if (readResult.kind === "loaded") {
    return readResult.record;
  }

  return configToRawRecord(defaultFastConfig());
}

export class FastConfigStore implements FastConfigRepository {
  private readonly home: string;
  private readonly warn: FastConfigWarningSink;

  constructor(options: FastConfigStoreOptions = {}) {
    this.home = options.home ?? homedir();
    this.warn = options.warn ?? defaultWarningSink;
  }

  paths(cwd: string): FastConfigPaths {
    return {
      project: join(cwd, ".pi", "extensions", "pi-fast.json"),
      global: join(this.home, ".pi", "agent", "extensions", "pi-fast.json"),
    };
  }

  private warningSink(options: FastConfigOperationOptions | undefined): FastConfigWarningSink {
    return options?.warn ?? this.warn;
  }

  async load(cwd: string, options?: FastConfigOperationOptions): Promise<FastConfig> {
    const paths = this.paths(cwd);
    const warn = this.warningSink(options);
    let config = defaultFastConfig();

    const globalConfig = await readConfigRecord(paths.global, warn);
    const projectConfig = await readConfigRecord(paths.project, warn);

    if (globalConfig.kind === "missing" && projectConfig.kind === "missing") {
      await writeConfigRecord(paths.global, configToRawRecord(config), warn, "config-default-write-failed");
      return config;
    }

    if (globalConfig.kind === "loaded") {
      config = mergeKnownConfig(config, globalConfig.record, { path: paths.global, warn });
    }

    if (projectConfig.kind === "loaded") {
      config = mergeKnownConfig(config, projectConfig.record, { path: paths.project, warn });
    }

    return config;
  }

  async writeDesiredActive(
    cwd: string,
    desiredActive: boolean,
    options?: FastConfigOperationOptions,
  ): Promise<boolean> {
    const paths = this.paths(cwd);
    const warn = this.warningSink(options);
    const target = await selectWriteTarget(paths);
    const existing = await readWriteTargetConfigRecord(target, warn);

    if (existing.kind === "failed") {
      return false;
    }

    const next = sanitizeConfigRecordForWrite(rawRecordForWrite(existing), { path: target, warn });
    next.desiredActive = desiredActive;

    return await writeConfigRecord(target, next, warn, "config-write-failed");
  }
}
