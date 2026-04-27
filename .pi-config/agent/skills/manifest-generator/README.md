# ManifestGenerator

A coding-agent skill that turns a free-form project description into two files:

- `PROJECT_MANIFEST.md` — structured project context every factory agent reads
- `SOFTWARE_FACTORY_MANIFEST.md` — the 6-agent SDLC pipeline blueprint

Works in Claude Code, Codex CLI, Gemini CLI, or any agent runtime that can execute
markdown-based skill instructions.

---

## Install

**Recommended — works with 45+ agent runtimes (Claude Code, Cursor, Codex, Gemini CLI, and more):**

```bash
npx skills add https://github.com/audiojak/manifest-generator
```

The `skills` CLI will prompt you to choose which agent runtimes to install into.
Add `--yes` to skip prompts and install to all universal targets:

```bash
npx skills add https://github.com/audiojak/manifest-generator --yes
```

**Manual install — git clone:**

```bash
# Global (all projects)
git clone --depth 1 https://github.com/audiojak/manifest-generator.git ~/.claude/skills/manifest-generator

# Project-local (this project only)
git clone --depth 1 https://github.com/audiojak/manifest-generator.git .claude/skills/manifest-generator
```

Then invoke with `/manifest-generator` in Claude Code, or the equivalent slash
command in your agent runtime.

**Update:**

```bash
git -C ~/.claude/skills/manifest-generator pull
```

---

## Usage

```
/manifest-generator
```

The skill will:
1. Accept your project description (paste it, or provide a file path)
2. Extract structured content against the 11-section project manifest schema
3. Ask questions only for what it couldn't extract (none if your description is rich)
4. Write `PROJECT_MANIFEST.md`
5. Generate and write `SOFTWARE_FACTORY_MANIFEST.md`

**Resume:** If `PROJECT_MANIFEST.md` already exists but `SOFTWARE_FACTORY_MANIFEST.md`
doesn't, re-invoking the skill skips to factory manifest generation.

---

## Example

See `examples/fired-up-pizza/` for a complete worked example:
- `PROJECT_OVERVIEW.md` — the input description
- `PROJECT_MANIFEST.md` — the generated project manifest
- `SOFTWARE_FACTORY_MANIFEST.md` — the generated factory manifest

To try it yourself:

```bash
cd /tmp/test-manifest-generator
/manifest-generator examples/fired-up-pizza/PROJECT_OVERVIEW.md
```

---

## Manual Smoke Tests

Run these before submitting a new version or after modifying the skill.

### Test 1: Golden path (rich description)

**Input:** Paste the Fired Up Pizza description from `examples/fired-up-pizza/PROJECT_OVERVIEW.md`.

**Expected:**
- ≤ 3 questions asked before `PROJECT_MANIFEST.md` is written
- All 11 sections of `PROJECT_MANIFEST.md` are filled with non-placeholder content
- `SOFTWARE_FACTORY_MANIFEST.md` has all 7 sections
- All 6 system prompt seeds contain "Fired Up Pizza" and at least one of: Order, Customer, Staff, MenuItem
- Both human gates are defined (Gate 1 after Architect, Gate 2 after Reviewer)

### Test 2: Thin description (one-liner)

**Input:** `"A pizza ordering app"`

**Expected:**
- Exactly 5 gap-fill questions asked (one for each always-ask section: Overview, Tech Stack, Domain Model, Constraints, Success Criteria)
- After answering all 5, both files are written and complete

### Test 3: Resume detection

**Setup:** Write a stub `PROJECT_MANIFEST.md` to a test directory (copy the Fired Up Pizza one). Ensure `SOFTWARE_FACTORY_MANIFEST.md` does NOT exist.

**Input:** Invoke `/manifest-generator` with no description.

**Expected:**
- Phases 1–5 are skipped
- Agent says "Found existing PROJECT_MANIFEST.md — skipping to factory manifest generation"
- Only `SOFTWARE_FACTORY_MANIFEST.md` is written

### Test 4: Text-mode fallback (Codex CLI / Gemini CLI)

**Input:** Run in a runtime without AskUserQuestion (Codex CLI with a thin description).

**Expected:**
- Gap-fill questions printed as a numbered list in a single response
- User provides all answers in one message
- Both files written correctly

### Test 5: Overwrite guard

**Setup:** Both `PROJECT_MANIFEST.md` and `SOFTWARE_FACTORY_MANIFEST.md` already exist.

**Input:** Invoke `/manifest-generator` with the Fired Up Pizza description.

**Expected:**
- User is asked "PROJECT_MANIFEST.md already exists. Overwrite, rename to .bak, or abort?" before Phase 5 writes
- User is asked the same for `SOFTWARE_FACTORY_MANIFEST.md` before Phase 7 writes
- Selecting "Rename" renames the existing file to `.bak` before writing the new version

---

## The 6-Agent Pipeline

The factory manifest configures this pipeline:

```
Feature Request
      │
      ▼
  PLANNER ──────────────────────────► work-packages/<slug>.md
      │
      ▼
 ARCHITECT ── [human gate 1] ────────► docs/adr/NNNN-<slug>.md
      │
      ▼
  DESIGNER ───────────────────────────► design/<slug>-spec.md
      │
      ▼
   CODER ──────────────────────────────► src/ (feature branch)
      │
      ▼
  REVIEWER ── [human gate 2] ──────────► review-reports/<slug>-review.md
      │
      ▼
  DEPLOYER ────────────────────────────► release-gates/<slug>-gate.md
```

Built for [GasCity](https://github.com/gastownhall/gascity) and compatible with any
multi-agent pipeline that reads Markdown configuration.

---

## Contributing

The skill is a single file: `manifest-generator/SKILL.md`.

To modify: edit the file, run the 5 smoke tests above, submit a PR.
