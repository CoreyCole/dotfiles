import type { FastWarning } from "./fast-warnings.ts";

export const FAST_DESIRED_HANDOFF_ENV = "PI_OPENAI_FAST_DESIRED";
export const FAST_HANDOFF_INVALID_VALUE_WARNING_CODE = "fast-handoff-invalid-value";

export type FastDesiredHandoffEnvironment = Readonly<Record<string, string | undefined>>;
export type WritableFastDesiredHandoffEnvironment = Record<string, string | undefined>;

export interface FastDesiredHandoffInvalidValueWarning extends FastWarning {
  code: typeof FAST_HANDOFF_INVALID_VALUE_WARNING_CODE;
  name: typeof FAST_DESIRED_HANDOFF_ENV;
  value: string;
}

export type FastDesiredHandoffReadResult =
  | { kind: "valid"; desiredActive: boolean }
  | { kind: "unset" }
  | { kind: "invalid"; warning: FastDesiredHandoffInvalidValueWarning };

function invalidFastDesiredHandoffWarning(value: string): FastDesiredHandoffInvalidValueWarning {
  return {
    code: FAST_HANDOFF_INVALID_VALUE_WARNING_CODE,
    name: FAST_DESIRED_HANDOFF_ENV,
    value,
    message: `Ignoring invalid ${FAST_DESIRED_HANDOFF_ENV} value ${JSON.stringify(value)}; expected exact value 1 or 0.`,
  };
}

export function readFastDesiredHandoff(
  env: FastDesiredHandoffEnvironment = process.env,
): FastDesiredHandoffReadResult {
  const value = env[FAST_DESIRED_HANDOFF_ENV];

  if (value === undefined) {
    return { kind: "unset" };
  }

  if (value === "1") {
    return { kind: "valid", desiredActive: true };
  }

  if (value === "0") {
    return { kind: "valid", desiredActive: false };
  }

  return { kind: "invalid", warning: invalidFastDesiredHandoffWarning(value) };
}

export function writeFastDesiredHandoff(
  desiredActive: boolean,
  env: WritableFastDesiredHandoffEnvironment = process.env,
): void {
  env[FAST_DESIRED_HANDOFF_ENV] = desiredActive ? "1" : "0";
}
