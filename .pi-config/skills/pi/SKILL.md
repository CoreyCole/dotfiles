---
name: pi
description: Build and customize pi itself (not end-user task execution). Use when asked to create or modify pi config, extensions, AGENTS.md behavior, skills/prompts/themes loading, package wiring, or integration surfaces for external tools/services.
---

# Pi Customization Skill

Focus on **extending pi**, not using pi to complete normal coding tasks.

## What This Skill Covers

- Configuring `settings.json` (global and project)
- Building and iterating on TypeScript extensions
- Wiring custom tools/commands/events into pi
- Managing resource loading (extensions, skills, prompts, themes, packages)
- Documenting and shaping agent behavior via `AGENTS.md`
- Packaging reusable pi customizations

## Source of Truth

When implementing or explaining behavior, use the docs in:

- `context/pi-mono/packages/coding-agent/README.md`
- `context/pi-mono/packages/coding-agent/docs/settings.md`
- `context/pi-mono/packages/coding-agent/docs/extensions.md`
- `context/pi-mono/packages/coding-agent/docs/skills.md`
- `context/pi-mono/packages/coding-agent/docs/packages.md`

Prefer quoting exact behavior from docs over assumptions.

## Step 1: Classify the Customization Request

Choose the smallest mechanism that solves the request:

| Need | Mechanism |
|---|---|
| Change runtime defaults/paths/model/theme/load rules | `settings.json` |
| Add runtime behavior, tools, commands, event hooks, UI | extension |
| Add reusable instruction workflow | skill |
| Add reusable prompt expansion | prompt template |
| Bundle/share customization | pi package |
| Change default operating instructions | `AGENTS.md`, `SYSTEM.md`, `APPEND_SYSTEM.md` |

If user asks for “agents in pi”, treat that as:
1. `AGENTS.md` context behavior, and/or
2. extension-based orchestration (since core pi has no built-in sub-agents)

## Step 2: Check Effective Configuration First

Inspect these files before editing:

- Global: `~/.pi/agent/settings.json`
- Project: `.pi/settings.json`
- Project instructions: `AGENTS.md` in cwd and parent dirs

Remember:

- Project settings override global settings
- Nested objects merge
- Resource paths resolve relative to the settings file location

## Step 3: Extension-First Implementation Pattern

When runtime behavior is needed, scaffold extension in auto-discovery location:

- Global: `~/.pi/agent/extensions/`
- Project: `.pi/extensions/`

Recommended starter:

```ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("pi-check", {
    description: "Show pi customization status",
    handler: async (_args, ctx) => {
      ctx.ui.notify("pi extension active", "info");
    },
  });

  pi.registerTool({
    name: "pi_echo",
    label: "Pi Echo",
    description: "Simple extension test tool",
    parameters: Type.Object({
      text: Type.String({ description: "Text to echo" }),
    }),
    async execute(_id, params) {
      return {
        content: [{ type: "text", text: `pi_echo: ${params.text}` }],
        details: {},
      };
    },
  });
}
```

Then reload with `/reload`.

## Step 4: Integration Surfaces to Prefer

When asked “how do we integrate X with pi?”, map to these surfaces:

1. **Extension API**
   - `pi.registerTool()` for LLM-callable tool integration
   - `pi.registerCommand()` for user commands
   - `pi.on(...)` for lifecycle/tool/session interception

2. **Settings-based resource loading**
   - `packages`, `extensions`, `skills`, `prompts`, `themes`

3. **Package-based distribution**
   - `pi install ...`, `pi remove ...`, `pi update`, `pi config`

4. **Context/instruction files**
   - `AGENTS.md` auto-loaded and concatenated from global + parent + current dirs
   - `.pi/SYSTEM.md` to replace system prompt
   - `APPEND_SYSTEM.md` to append to system prompt

## Step 5: Verify Changes Before Claiming Done

After customization work:

1. Confirm files exist in expected discovery paths
2. Run `/reload` (or restart pi if needed)
3. Trigger the new command/tool in-session
4. If package/config changes were made, run `pi list` or `pi config` to verify visibility
5. Report exact files changed and observed behavior

## Guardrails

- Do not propose generic app-level coding solutions when the request is about pi platform customization.
- Keep examples minimal and operational; avoid over-engineering extension architecture.
- Treat extension/package code as trusted-code risk; call out security implications for third-party sources.
- If docs and observed runtime differ, state both and prefer observed behavior with citation.

## Typical Outputs

Use this shape in responses:

1. **Mechanism chosen** (settings vs extension vs package vs AGENTS)
2. **Files to create/edit** (full paths)
3. **Minimal implementation**
4. **Verification commands**
5. **Next optional hardening step** (only one, concise)
