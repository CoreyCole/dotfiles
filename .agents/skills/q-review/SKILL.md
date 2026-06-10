---
name: q-review
description: Router for QRSPI LLM reviews. Use for reviewing design, product design, outline, plan, or completed implementation artifacts; loads q-review-plan before code exists and q-review-implementation after code has been written.
---

# QRSPI Review Router

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

## Runtime XML contract

Every response that completes a QRSPI workflow node must include a fenced `xml` block containing `<qrspi-result>`, followed by a mandatory concise human summary. Do not use prose-only `Artifact` / `Summary` / `Next` completion responses.

Required shape:

```xml
<qrspi-result>
  <stage>[canonical node id]</stage>
  <status>complete</status>
  <outcome>[node-specific branch outcome]</outcome>
  <workspace>[absolute active QRSPI plan directory before q-workspace; omit after implementation workspace exists]</workspace>
  <workspaceMetadata>
    <planWorkspace>[absolute active QRSPI plan/ticket directory; required after q-workspace]</planWorkspace>
    <implementationWorkspace>[absolute implementation workspace when known]</implementationWorkspace>
    <trunkBranch>[trunk branch name, usually main]</trunkBranch>
    <stackBottomBranch>[bottom Graphite branch above trunk, or empty when not applicable]</stackBottomBranch>
    <parentBranch>[Graphite parent branch below the just-finished branch/chunk, or empty when not applicable]</parentBranch>
    <currentBranch>[current branch after gt create/gt modify, or current git branch]</currentBranch>
  </workspaceMetadata>
  <policy>
    <autoMode>[current persisted policy]</autoMode>
    <enablePlanReviews>[current persisted policy]</enablePlanReviews>
    <invalidResultRetryLimit>[current persisted policy or 1]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall goal]</plan-goal>
    <stage-completed>[specific work completed]</stage-completed>
    <key-decisions>[decisions, risks, follow-up, or why next step is safe]</key-decisions>
  </summary>
  <artifact>thoughts/...</artifact>
  <artifacts>
    <artifact role="related">thoughts/...</artifact>
  </artifacts>
  <next>
    <step>Read ~/.agents/skills/qrspi-planning/SKILL.md.</step>
    <step>Read ~/.agents/skills/[concrete next-stage]/SKILL.md.</step>
    <step>Read [primary artifact path from artifact element].</step>
    <step>Start the concrete next stage immediately unless blocked by an explicit human/safety gate.</step>
  </next>
</qrspi-result>
```

`status` is lifecycle. `outcome` selects the graph branch. `<next>` is an ordered instruction block for the next agent: read `qrspi-planning`, read the next stage skill, read the appropriate artifact, then start the next stage immediately unless a named human/safety gate blocks. Runtime transitions remain graph-authoritative and may validate/rewrite the steps. Complete results must include `<outcome>`. Review stages must use explicit node IDs (`review-outline`, `review-plan`, or `review-implementation`), never `review`.

Every `/q-review` session starts by reading `~/.agents/skills/qrspi-planning/SKILL.md`, then this router, then the selected focused review skill. After route selection, immediately run that focused review. Do not answer “ready to proceed.”

`/q-review` is the stable entry point for QRSPI LLM review. It does not contain the review workflow itself. It resolves whether code has been written, then loads exactly one focused review skill:

- `~/.agents/skills/q-review-plan/SKILL.md` for pre-implementation planning review after `outline.md` and `plan.md`; it reviews and may edit `design.md` and optional `design-product.md` as supporting context.
- `~/.agents/skills/q-review-implementation/SKILL.md` for post-implementation code review after `/q-implement` completes.

## When Invoked

1. Read `~/.agents/skills/qrspi-planning/SKILL.md`.
1. Resolve the input:
   - `outline.md` or `plan.md` path → planning review.
   - Implement-complete handoff path under `[plan_dir]/handoffs/` → implementation review.
   - Plan directory path → inspect artifacts to choose mode.
   - Canonical review artifact path under `[plan_dir]/reviews/*/review.md` → use the `review_mode` frontmatter if present.
1. If no input was provided, respond:

```text
I'll run a QRSPI review and route it based on whether implementation code exists.

Please provide one of:
- an outline path, e.g. `/q-review thoughts/[git_username]/plans/.../outline.md`
- a plan path, e.g. `/q-review thoughts/[git_username]/plans/.../plan.md`
- an implement-complete handoff path, e.g. `/q-review thoughts/[git_username]/plans/.../handoffs/YYYY-MM-DD_HH-MM-SS_implement-handoff.md`
- or a plan directory path, e.g. `/q-review thoughts/[git_username]/plans/YYYY-MM-DD_HH-MM-SS_plan-name`
```

Then wait for input.

## Mode Resolution

### Planning review

Choose planning review when:

- the input is `outline.md` or `plan.md`
- the user asks to review the outline, plan, or planning docs
- the input is a plan directory that has no implement-complete handoff
- the input is a plan directory with `plan.md` but implementation is not complete

After resolving planning review, read and follow:

```text
~/.agents/skills/q-review-plan/SKILL.md
```

### Implementation review

Choose implementation review when:

- the input is an implement-complete handoff
- the input is a plan directory with a complete implement handoff in `[plan_dir]/handoffs/`
- the user explicitly asks to review completed code or implementation

A complete implement handoff is the final `/q-implement` handoff that points to `/q-review`, has `next_stage: review`, or otherwise states implementation is complete.

If both modes could apply for a plan directory, prefer implementation review only when a complete implement handoff is unambiguous. Otherwise run planning review.

After resolving implementation review, read and follow:

```text
~/.agents/skills/q-review-implementation/SKILL.md
```

## Rules

- Do not run both review modes in one invocation.
- Do not keep using this router after mode selection; load the focused skill and follow it.
- `/q-review` does not read or delegate same-workspace/thoughts-only routing to `/q-workspace`; `q-review-plan` owns the decision. If the reviewed `plan.md` is marked `execution_mode: thoughts-only`, all planned edits live under `thoughts/`/planning systems, the plan is under another plan's `reviews/` tree, or the human says to implement in the current workspace, `/q-review` must skip `/q-workspace` and emit `ready-for-implement` directly.
- Planning review edits planning documents directly when findings are clear, including `design-product.md` when present. After a successful normal source-code implementation `plan.md` review, the next stage is `/q-workspace [plan.md]`, not `/q-implement`; the XML and post-XML summary must say to start `/q-workspace` immediately, not “ready to proceed.” For thoughts-only project-planning/spec plans, the next stage is `/q-implement [plan.md]` in the current checkout; do not create a copied workspace.
- Review-plan-dir exception: for any reviewed `plan.md` whose plan directory is itself under another plan's `reviews/` tree (`.../reviews/*/plan.md`), do not route to `/q-workspace` unless the human explicitly asks for a fresh copy. This includes `*_implementation-review` follow-ups and review-fix/follow-up plan dirs with other names. The current repo root is the existing implementation workspace. The completion XML must route directly to `/q-implement [plan.md]`, omit top-level `<workspace>`, set `<planWorkspace>` to the review-dir plan workspace, set `<implementationWorkspace>` to the current/original implementation workspace, and say implementation must continue in this workspace. Do not create a fresh copy, do not reset to trunk/main, and do not imply implementation should happen anywhere except the reviewed workspace.
- Thoughts-only override: if `plan.md` frontmatter says `execution_mode: thoughts-only`, the plan uses `Thoughts-only Execution`, or project-planning doctrine applies and all planned edits live under `thoughts/`/planning systems, skip `/q-workspace`. Keep implementation in the current checkout, set outcome `ready-for-implement`, leave `<implementationWorkspace>` empty, and route directly to `/q-implement [plan.md]`.
- Same-workspace override: if the human says implementation will happen in the current workspace, skip `/q-workspace` even for a plan path that does not match `.../reviews/*/plan.md`. Treat the current repo root as `<implementationWorkspace>`, set outcome `ready-for-implement`, and route directly to `/q-implement [plan.md]`. `/q-workspace` is only for parent plans that need a new implementation copy; it must not create another workspace around an existing implementation workspace.
- Implementation review reviews code, applies only straightforward code fixes directly, and creates a review-directory QRSPI plan for deeper follow-up work.
- The focused review must summarize the current design/implementation and its alignment with PRDs, tickets, brainstormed requirements, approved QRSPI constraints, and relevant project guidance in `review.md`.
- The focused review must run/use the project-guidance lane for relevant `AGENTS.md`, `.agents/rules`, `.cursor/rules`, local skills, and nearby package docs based on the reviewed/changed code paths.
- The focused review must run/use the docs-health lane to decide whether relevant docs can be corrected, simplified, or made more concise.
- The post-XML user summary for review normally uses `Found: ... Fixed: ...`. For successful `review-outline`, append `Next: start /q-plan now.` For successful normal source-code implementation `review-plan`, append `Next: start /q-workspace now.` For successful thoughts-only, review-plan-dir, or same-workspace `review-plan`, append `Next: start /q-implement now.` If clean, use the matching next stage. Caveman clear. Few words. Most important words only.
- The focused review must preserve any conflicting relevant guidance from docs, `AGENTS.md`, `.agents/rules/`, `.cursor/rules/`, or local skills as `IMPORTANT: needs human attention` with exact source refs and the human decision needed.
- Always return the canonical review artifact path produced by the focused skill.
