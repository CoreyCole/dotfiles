# TODOS

## TODO-1: Cross-runtime validation

**What:** Test the skill against Codex CLI and Gemini CLI after the Claude Code version works.
**Why:** The "agent-agnostic" claim is unverified until tested on non-Claude runtimes. Context window limits and text-mode Q&A behavior may differ significantly.
**Pros:** Confirms the skill works as advertised; required before awesome-agent-skills submission.
**Cons:** Requires access to Codex CLI and Gemini CLI; 1-2 hours of manual testing.
**Context:** The skill uses AskUserQuestion (Claude Code-only) with a text-mode fallback for other runtimes. The fallback logic (Phase 1 probe attempt → switch to numbered-list mode) needs real-world testing to confirm it degrades gracefully without aborting.
**Where to start:** Run the golden path test (Fired Up Pizza description) in Codex CLI. Check that (1) the probe AskUserQuestion fails cleanly, (2) gap-fill questions print as a numbered list, (3) both output files are written correctly.
**Depends on:** TODO-0 (working Claude Code version)

---
