export type FastCommandParseResult = { kind: "toggle" } | { kind: "usage" };

export function parseFastCommandArgs(args: string): FastCommandParseResult {
  return args.trim().length === 0 ? { kind: "toggle" } : { kind: "usage" };
}
