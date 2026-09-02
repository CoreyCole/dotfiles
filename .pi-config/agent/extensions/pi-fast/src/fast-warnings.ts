export type FastWarningCode =
  | "config-read-failed"
  | "config-default-write-failed"
  | "config-write-failed"
  | "config-malformed-write-refused"
  | "config-supported-models-not-array"
  | "config-supported-models-dropped"
  | "config-supported-models-all-invalid"
  | "config-fast-label-color-invalid"
  | "fast-handoff-invalid-value";

export interface FastWarning {
  code: FastWarningCode;
  message: string;
  path?: string | undefined;
  name?: string | undefined;
  value?: string | undefined;
  cause?: unknown;
}

export type FastWarningSink<Warning extends FastWarning = FastWarning> = (warning: Warning) => void;

export interface FastWarningCollector {
  readonly warnings: FastWarning[];
  collect(warning: FastWarning): void;
}

export interface FastWarningNotificationSink {
  notify?(message: string, type: "warning"): void;
}

export function emitFastWarning<Warning extends FastWarning>(warn: FastWarningSink<Warning>, warning: Warning): void {
  try {
    warn(warning);
  } catch {
    // Warning sinks must not make startup, config fallback, or command handling fail.
  }
}

export function createFastWarningCollector(): FastWarningCollector {
  const warnings: FastWarning[] = [];

  return {
    warnings,
    collect(warning) {
      warnings.push(warning);
    },
  };
}

export function formatFastWarning(warning: Pick<FastWarning, "message">): string {
  return `[pi-fast] ${warning.message}`;
}

export function warnToConsole(warning: Pick<FastWarning, "message">): void {
  console.warn(formatFastWarning(warning));
}

function warningDeliveryKey(warning: FastWarning): string {
  return JSON.stringify([warning.code, warning.path, warning.name, warning.value, warning.message]);
}

function deliverFastWarning(warning: FastWarning, notificationSink: FastWarningNotificationSink | undefined): void {
  try {
    if (typeof notificationSink?.notify === "function") {
      notificationSink.notify(warning.message, "warning");
      return;
    }

    warnToConsole(warning);
  } catch {
    // Warning delivery must not make startup or command handling fail.
  }
}

export function deliverFastWarnings(
  warnings: readonly FastWarning[],
  notificationSink: FastWarningNotificationSink | undefined,
): void {
  const delivered = new Set<string>();

  for (const warning of warnings) {
    const key = warningDeliveryKey(warning);
    if (delivered.has(key)) {
      continue;
    }
    delivered.add(key);
    deliverFastWarning(warning, notificationSink);
  }
}

export function hasConfigWriteFailureWarning(warnings: readonly FastWarning[]): boolean {
  return warnings.some(
    (warning) => warning.code === "config-write-failed" || warning.code === "config-malformed-write-refused",
  );
}
