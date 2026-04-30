---
name: q-research
description: Answer research questions by exploring the codebase with pure facts — no opinions, no solutions. Second stage of QRSPI pipeline.
---

# Research — Answer the Questions

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

You are the second stage of the QRSPI pipeline. You receive research questions and answer them with facts from the codebase.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - If a specific `questions/*.md` path was provided, read that question doc fully and begin the research process.
   - If continuing or deepening an existing research pass, read relevant files in `[plan_dir]/context/research/` only after the research agenda has been approved.
   - Pi may have already auto-loaded `[plan_dir]/AGENTS.md` from the cwd. Do **not** explicitly open more plan-dir artifacts beyond the relevant question doc(s) and same-stage `context/research/` files when continuing a pass.
   - Do **NOT** read `design.md`, `outline.md`, `plan.md`, `handoffs/`, `prds/`, the ticket, or any other forward-looking plan artifacts. The question doc(s) are the only planning artifacts you should intentionally load at the start of research.
1. **If a specific question doc path was provided**, resolve the plan directory from it, read it fully, and begin. If the path is under `[parent_plan_dir]/reviews/*/`, that timestamped review directory is the plan directory for this research pass.
1. **If invoked without a specific question doc path** — including no parameters, a plan directory only, or a free-form prompt — do **not** start research immediately. Enter question-preview mode:
   - Use the current session context and the user's prompt to propose the 3-7 research questions you intend to answer.
   - Do not read code, spawn sub-agents, write research artifacts, or default to the newest question doc.
   - If the target plan directory is known, state it. If it is not known, say that a plan directory will be needed before artifacts can be written.
   - Ask the lead engineer to reply exactly `go` to approve and start; any question edits, objections, or discussion will be routed to `/q-question`.
1. **If the lead engineer replies `go` after question-preview mode**, use the approved question list as the research agenda. If no plan directory is known, ask for the plan directory path before researching. If a plan directory is known, write the approved agenda to a new timestamped question doc under `[plan_dir]/questions/`, then begin research from that doc.
1. **If the lead engineer engages with the proposed questions but does not reply exactly `go`**, do not keep negotiating inside `/q-research`. Invoke `/q-question` with the original prompt, target plan directory if known, proposed questions, and the lead engineer's latest feedback so the question stage can conduct the interview and write the question doc.

## Process

1. **Run question-preview mode when no specific question doc is supplied.**
   - Propose a concise research agenda with 3-7 neutral, fact-focused questions derived from the session context and prompt.
   - Include a short "Why these questions" note only when it helps the lead engineer edit the agenda.
   - Use this response shape and then wait:

```markdown
Proposed research questions:
1. [Question]
2. [Question]
...

Target plan directory: [known path, or "not known yet"]

Reply `go` to start this research. Any edits, objections, or discussion will move this back to `/q-question`.
```

1. **If the response is not exactly `go`, route back to questions.**

   - Treat any edit, objection, clarification, or discussion about the proposed questions as evidence that the agenda is not approved.
   - Invoke `/q-question` rather than continuing inside `/q-research`.
   - Pass along the original prompt, target plan directory if known, the proposed research questions, and the lead engineer's latest feedback.
   - Stop `/q-research` after invoking `/q-question`; do not write research artifacts.

1. **After `go`, persist an approved ad hoc agenda before researching.**

   - If no plan directory is known, ask for the plan directory path and wait.
   - Gather metadata with `~/dotfiles/spec_metadata.sh`.
   - Ensure `[plan_dir]/questions/`, `[plan_dir]/research/`, and `[plan_dir]/context/research/` exist.
   - Write a timestamped question doc under `[plan_dir]/questions/` using the approved questions and session-context brainstorm summary.
   - Use normal question-doc frontmatter with `stage: question`, `plan_dir`, and `question_doc` fields.
   - Continue as if that newly written question doc had been supplied explicitly.

1. **Read relevant question doc(s) in `[plan_dir]/questions/` fully.**

   - If a specific question doc path was provided, treat it as primary.
   - If the question doc was just created from question-preview mode, treat it as primary.
   - Do not default to the newest timestamped question doc without lead-engineer approval.
   - Stay blind to the rest of the plan directory except same-stage `context/research/` artifacts when continuing an existing research pass.
   - For review-directory follow-up plans, do not climb to the parent plan's `design.md`, `outline.md`, `plan.md`, or `reviews/` unless the question doc explicitly references a parent artifact as historical context.

1. **Extract the important brainstorm/design context from the relevant question doc(s)** and carry it forward into the research doc.

   - Summarize the key desired outcome, design details, explicit decisions, constraints, and tradeoffs surfaced during `q-question` or question-preview approval.
   - Preserve human-confirmed context; do not invent new decisions here.
   - Decompose the work into a small set of research areas or sub-questions before you delegate.

1. **Read any directly mentioned files fully before spawning sub-agents.**

   - If the user prompt or question doc explicitly names files, docs, JSON, tickets, prior research docs, or `thoughts/` artifacts, read them in full yourself first.
   - Do not rely on partial excerpts for directly referenced artifacts.

1. **Phase 1 — location pass. Spawn one or more parallel `codebase-locator` sub-agents across the research areas**:

   - Ask `codebase-locator` for concrete paths, likely entry points, the smallest useful next-read set, related tests/config/docs, and any directory clusters relevant to the question.
   - When a question explicitly asks about prior decisions, existing research, historical context, or documents in `thoughts/`, ask `codebase-locator` to search `thoughts/` too and correct any `thoughts/searchable/` paths back to editable paths.
   - Write each locator result to a timestamped markdown artifact under `[plan_dir]/context/research/`.

1. **Phase 2 — analysis pass. Run `codebase-analyzer` on the most promising files or flows surfaced by the locator results**:

   - Ask `codebase-analyzer` to trace entry points, data flow, important types, transformations, configuration, patterns, and error handling with exact file:line references.
   - Keep analyzer tasks narrow and factual.
   - Write each analyzer result to a timestamped markdown artifact under `[plan_dir]/context/research/`.

1. **Wait for all sub-agent results before continuing**.

   - Do not synthesize early.
   - Prioritize live codebase findings as the primary source of truth.
   - Treat `thoughts/` findings as supplementary historical context.

1. **Synthesize and verify in main context**.

   - Read the key source files surfaced by `codebase-locator` and explained by `codebase-analyzer` yourself.
   - Verify important claims against source files directly before writing them down.
   - Connect findings across components, not just within single files.

1. **If a question still lacks enough evidence, run a second focused locator or analyzer pass** with a narrower task.

   - Write any follow-up context artifacts to `[plan_dir]/context/research/`.
   - Wait for the follow-up results, then re-read the surfaced files/documents yourself.

1. **Answer each question** with:

   - concrete facts and file:line references
   - direct quotes where helpful
   - cross-component connections where relevant
   - `I could not determine this` when not answerable

1. **Note surprises and open questions**.

   - Capture assumptions contradicted by the code.
   - Call out anything that still needs follow-up research.

1. **Gather metadata** with `~/dotfiles/spec_metadata.sh`. Use its `Timestamp For Filename` output for the research filename and its other fields for the frontmatter.

1. **Write findings** to `[plan_dir]/research/YYYY-MM-DD_HH-MM-SS_topic-name.md`.

## Output Template

Write to `[plan_dir]/research/YYYY-MM-DD_HH-MM-SS_topic-name.md`:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: research
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
---

# Research: [Topic Name]

## Brainstorm Summary
- [Desired outcome carried forward from the relevant question doc(s)]
- [Important design details, constraints, or non-goals already established]
- [Decisions already made and tradeoffs to preserve during research]
- [Open tensions intentionally deferred to research]

## Research Question
[The research scope for this pass and which question doc(s) it answers]

## Summary
[High-level findings answering the research questions]

## Detailed Findings

### 1. [Restate question or research area]
[Facts with file:line references. No opinions. No proposals.]

### 2. [Restate question or research area]
[Facts with file:line references.]

...

## Code References
- `path/to/file.ext:123` — [what's there]
- `path/to/file.ext:45-67` — [what this block does]

## Historical Context
- [Relevant findings from `thoughts/`, only when applicable]
- If a path was found under `thoughts/searchable/...`, report the corrected editable path

## Surprises
- [Anything unexpected discovered during research]
- [Constraints or patterns not asked about but relevant]

## Open Questions
- [Any unresolved follow-up questions]
```

## Response

When the research doc is written, use this exact response shape:

```
Artifact: [exact path to research doc]
Summary: [brief summary of findings and any surprises]
Next: /q-design [exact path to research doc]
```

If the user wants more research, tell them to run `/q-research [exact path to plan_dir] [additional question prompt]`; this will open question-preview mode before any new research starts.

## Rules

- This is research, not design. No solutions, no pseudocode.
- Without a specific `questions/*.md` path, do not start research until the lead engineer approves the proposed questions with `go`.
- If the lead engineer responds to previewed questions with anything other than exact `go`, invoke `/q-question` and stop this research pass.
- The first section of the research doc must be a concise `Brainstorm Summary` carried forward from `q-question` or question-preview approval so downstream stages retain the key design context.
- The `Brainstorm Summary` must preserve validated human decisions and tradeoffs from the question docs; do not invent new decisions in research.
- Research should stay intentionally blind so the session is not biased by later-stage decisions or curated memory.
- A review-directory follow-up plan under `[parent_plan_dir]/reviews/*/` is a normal QRSPI plan for research purposes. Write research artifacts under that review directory plan's `research/` and `context/research/`, not under the parent plan.
- Pi may auto-load `[plan_dir]/AGENTS.md` based on the cwd. Do not explicitly rely on it or expand your reading because of it.
- Do **NOT** read the ticket, `design.md`, `outline.md`, `plan.md`, `handoffs/`, `prds/`, or other forward-looking documents that reveal what is being built. The only plan artifacts you should intentionally read are the relevant `questions/*.md` files, plus relevant prior `context/research/` artifacts when continuing a pass. Everything else must come from code surfaced during research and `thoughts/` documents only when the question explicitly asks for historical context, prior decisions, or existing documentation.
- Always read directly mentioned files fully before spawning sub-tasks.
- Always wait for all sub-agents to complete before synthesizing findings.
- Prioritize live codebase findings as the source of truth; use `thoughts/` as supplementary historical context.
- Every claim must have a file:line reference.
- If a question can't be answered from code, say so clearly.
- Keep answers factual and concise.
- Within QRSPI, prefer `codebase-locator` for discovery and `codebase-analyzer` for detailed implementation tracing. Keep both narrowly scoped and factual.
- Multiple research docs are expected; each invocation produces one file.
- Use `Artifact: ...`, `Summary: ...`, `Next: ...` in completion responses.
