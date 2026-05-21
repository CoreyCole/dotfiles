---
name: qrspi-planning
description: High-level overview of the QRSPI planning pipeline — Question, Research, Design, optional Product Design, Outline, Plan, Implement, Review. Read this to understand stage flow, review loops, and artifact ownership before using individual stage skills.
---

## Runtime XML contract

Every response that completes a QRSPI workflow node must include a fenced `xml` block containing `<qrspi-result>`, followed by a mandatory concise human summary. Do not use prose-only `Artifact` / `Summary` / `Next` completion responses.

The user should not have to ask for this XML. Return it automatically whenever QRSPI stage work completes, hands off, blocks, or errors. When a user says “the correct response”, “now the response”, “what’s the response?”, “give me the result”, or asks for the QRSPI response/result after QRSPI stage work, they mean the protocol XML below plus the required post-XML concise summary. Return the `<qrspi-result>` XML first, not a prose recap in place of XML. A handoff markdown file is only an artifact referenced from XML; creating a handoff does not replace the required XML response.

Required shape:

```xml
<qrspi-result>
  <stage>[canonical node id]</stage>
  <status>complete</status>
  <outcome>[node-specific branch outcome]</outcome>
  <workspace>[absolute active QRSPI plan/ticket directory before q-workspace; absolute fresh implementation workspace after q-workspace]</workspace>
  <workspaceMetadata>
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
  <next>[display/debug command matching the graph]</next>
</qrspi-result>
```

Summary: [Ultra-concise human update. Sacrifice perfect grammar for concision.]

`status` is lifecycle. `outcome` selects the graph branch. `<workspace>` is always required: before `/q-workspace`, set it to the absolute active QRSPI plan/ticket directory where the next planning stage should run; after `/q-workspace`, set it to the absolute fresh implementation workspace. `<workspaceMetadata>` records branch context for humans and runtime handoff/debugging: `trunkBranch` is usually `main`; `stackBottomBranch` is the lowest Graphite branch above trunk; `parentBranch` is the branch immediately below the chunk of work just completed; `currentBranch` is the branch created/updated for the chunk. Use empty elements when not in a Graphite repo or the value is unknowable. `<next>` is display/debug only; runtime transitions are graph-authoritative. Complete results must include `<outcome>`. Review stages must use explicit node IDs (`review-design`, `review-outline`, `review-plan`, or `review-implementation`), never `review`.

## QRSPI mode contract

- `autoMode=false`: stop at human gates; still emit valid `<qrspi-result>` and show validated advance button.
- `autoMode=true`: continue through human gates automatically unless `needs_human`, `blocked`, `error`, invalid artifact, disallowed transition, run failure, or XML retry exhaustion.
- `enablePlanReviews=true`: run planning `/q-review` after outline and plan. Do not run `/q-review` immediately after design; design advances to `/q-outline` (or optional `/q-design-product`).
- `enablePlanReviews=false`: skip planning `/q-review`; final implementation `/q-review` always runs.
- Research never has its own human stop. Humans evaluate research-derived direction in design/outline review, but research must loop to another `/q-research` pass when new code-answerable factual questions materially inform design.
- Emit the QRSPI XML result as a fenced `xml` code block for every completed QRSPI stage result so it is syntax highlighted, then add only the mandatory concise human summary after it.

## QRSPI XML summary contract

The `<summary>` element is used by humans to understand workflow state before asking follow-up questions or advancing. It must be structured, specific, self-contained, not a generic completion label. Use these child elements inside `<summary>`:

- `<plan-goal>`: overall plan/workflow goal in plain language; not just current stage label.
- `<stage-completed>`: what this stage/session did and how it moves toward the goal. Extremely concise; sacrifice grammar for concision.
- `<key-decisions>`: direction we are headed; significant tradeoffs, risks, open questions, follow-up, or why next step is safe. Use `None.` only when truly none.

Keep each child element short: 1-2 concise lines max.

For review stages, always include both: (1) what the entire implementation/plan now does as a whole, and (2) what this review session checked and changed. Do not write vague summaries like `review complete`, `implementation review result`, `done`, or `summary of findings` without the concrete details a human would need to ask informed questions.

## Post-XML human summary contract

After every fenced `<qrspi-result>` block, add exactly one mandatory concise human summary line or short bullet list.

Style is strict: caveman clear. Few words. Most important words only. Sacrifice grammar hard for concision.

- Put it after the XML, never before.
- Keep it shorter than the XML `<summary>`; 1-3 short bullets or one `Summary:` sentence.
- Prefer fragments over sentences when clearer.
- Say only what human needs now.
- Do not restate full artifact lists, branch metadata, or machine-control details already encoded in XML.

Stage-specific post-XML summary content:

- `question`: list the research questions, as short as possible. Caveman speak. Example: `Questions: auth path? data shape? failure modes? tests?`
- `research`: key findings + direct answers to research questions. Example: `Findings: auth in middleware; data from X; risk Y.`
- `design`: summarize chosen design. Example: `Design: reuse X; add Y adapter; no schema change.`
- `outline`: summarize design + outline shape. Example: `Design: X adapter. Outline: 3 slices — model, API, tests.`
- `plan`: summarize implementation plan and how each ADR is reflected. Example: `Plan: 4 parts. ADR-001 => adapter seam. ADR-002 => no migration.`
- `review-design`, `review-outline`, `review-plan`, `review-implementation`: say only what review found and what it fixed. Example: `Found: stale API assumption. Fixed: outline uses current handler.`

## QRSPI result footer

When more than one artifact is relevant, keep `<artifact>` as the primary next-command artifact and also include `<artifacts>` with every important artifact path, including review records, done summaries, handoffs, ADRs, and follow-up questions.

Do not duplicate artifact lists or machine-control details in prose outside the XML. For normal QRSPI stage completion, the response must be the fenced `xml` `<qrspi-result>` block followed by a mandatory concise human summary; make both summaries specific enough for humans.

Every primary QRSPI stage and review/helper that completes a workflow transition must include a visible fenced `xml` QRSPI result block. Always include `<outcome>` for complete results and `<workspace>` immediately after `<outcome>`:

```xml
<qrspi-result>
  <stage>design</stage>
  <status>complete</status>
  <outcome>complete</outcome>
  <workspace>
[absolute active QRSPI plan/ticket directory before q-workspace; absolute fresh implementation workspace after q-workspace]
  </workspace>
  <workspaceMetadata>
    <trunkBranch>[trunk branch name, usually main]</trunkBranch>
    <stackBottomBranch>[bottom Graphite branch above trunk, or empty when not applicable]</stackBottomBranch>
    <parentBranch>[Graphite parent branch below the just-finished branch/chunk, or empty when not applicable]</parentBranch>
    <currentBranch>[current branch after gt create/gt modify, or current git branch]</currentBranch>
  </workspaceMetadata>
  <policy>
    <autoMode>false</autoMode>
    <enablePlanReviews>true</enablePlanReviews>
    <invalidResultRetryLimit>1</invalidResultRetryLimit>
  </policy>

  <summary>
    <plan-goal>[Overall plan/workflow goal.]</plan-goal>
    <stage-completed>[What this stage/session did; how it moves toward the goal.]</stage-completed>
    <key-decisions>[Direction, tradeoffs, risks, open questions, follow-up, or why next step is safe.]</key-decisions>
  </summary>
  <artifact>
thoughts/.../design.md
  </artifact>
  <next>
/q-outline thoughts/.../design.md
  </next>
</qrspi-result>
```

Summary: Design captured approved direction; next outline unless product gate needed.

Statuses: `complete`, `handoff`, `needs_human`, `blocked`, `done`, `error`.
`<workspace>` always appears immediately after `<outcome>` for complete results. Before `/q-workspace`, it points at the absolute active QRSPI plan/ticket directory. `/q-workspace` creates or repairs the fresh implementation workspace and then changes `<workspace>` to that absolute implementation path; later stages preserve it so `/q-implement` runs there. Non-complete results that omit `<outcome>` still include `<workspace>` immediately after `<status>`.
`<workspaceMetadata>` always appears immediately after `<workspace>`. For implementation results in Graphite repos, fill `trunkBranch`, `stackBottomBranch`, `parentBranch`, and `currentBranch` after `gt create`/`gt modify`; for planning/non-Graphite contexts, include empty elements for unknown values and preserve `currentBranch` when known.
`<next>` is display/debug intent only; runtime validates and may rewrite it from latest persisted policy before starting another run.

## Nested project planning

For epics/projects that use QRSPI to plan milestones and create future tickets, load `~/.agents/skills/qrspi-project-planning/SKILL.md`. Use milestone-specific skills instead of forcing normal `/q-outline` and `/q-plan` onto milestone meta-planning:

- `/q-milestone-question`
- `/q-milestone-research`
- `/q-milestone-design`
- `/q-milestone-review`
- `/q-milestone-create-tickets`

Legacy milestone skills `/q-milestone-outline` and `/q-milestone-plan` exist only to finish old in-flight milestone flows.

# QRSPI Planning Pipeline

A structured approach to non-trivial coding tasks. Each stage produces artifacts in a plan directory that grows over time. Separate context windows keep each stage focused and avoid the dumb zone.

## Stages

| # | Stage | Skill | Produces | Gate |
|---|-------|-------|----------|------|
| 1 | Question | `/q-question` | `questions/*.md` | Human alignment on goals, scope, tradeoffs, and research agenda; XML summary includes the research questions |
| 2 | Research | `/q-research` | `research/*.md` | Answer open factual questions before design; loop to more research if new code-answerable design facts are needed |
| 3 | Design | `/q-design` | `design.md` + `adrs/*.md` | Human approves technical direction |
| 4 | Product Design (optional) | `/q-design-product` | `design-product.md` | Human approves product/PRD coverage when needed |
| 5 | Outline | `/q-outline` | `outline.md` | LLM review via `/q-review [outline.md]` |
| 6 | Plan | `/q-plan` | `plan.md` | LLM review via `/q-review [plan.md]` |
| 7 | Workspace | `/q-workspace` | prepared implementation workspace + synced plan dir | Base/stack safety gate before implementation |
| 8 | Implement | `/q-implement` | code changes + verified commits + review handoff | LLM code review via `/q-review [handoff.md]` |
| 9 | Done | final `/q-review` | `done.md` | Terminal whole-plan completion summary |

`/q-review` is a router:

- Before code exists, it loads `q-review-plan`.
- After implementation is complete, it loads `q-review-implementation`.

## Review Loops

### Planning review before implementation

Run planning review after `outline.md` and again after `plan.md`:

```text
# default path
/q-outline [plan_dir]/design.md
/q-review [plan_dir]/outline.md
/q-plan [plan_dir]/outline.md
/q-review [plan_dir]/plan.md
/q-workspace [plan_dir]/plan.md
/q-implement [plan_dir]/plan.md

# optional product gate when product-critical, high-stakes, user-facing, PRD-sensitive, compliance/security-sensitive, irreversible user/data behavior, demo impact, or stakeholder alignment matters
/q-design-product [plan_dir]/design.md
/q-outline [plan_dir]/design-product.md
/q-review [plan_dir]/outline.md
/q-plan [plan_dir]/outline.md
/q-review [plan_dir]/plan.md
/q-workspace [plan_dir]/plan.md
/q-implement [plan_dir]/plan.md
```

For product-critical, high-stakes, user-facing PRD-sensitive, compliance/security-sensitive, or irreversible user/data behavior changes, insert product design before outline:

```text
/q-design-product [plan_dir]/design.md
/q-outline [plan_dir]/design-product.md
```

Planning review findings are handled in three ways:

1. `obvious_doc_fix` — edit `design.md`, `design-product.md`, `outline.md`, or `plan.md` directly during review.
1. `needs_codebase_research` — create a research questions doc under the timestamped planning review directory, then run `/skill:q-research-for-review` on it. After research, run `/skill:q-address-review-research` to update the parent planning docs from `review.md` plus the research doc.
1. `needs_human_judgment` — ask through `/answer`, then update the planning docs from the decision. This should be rare when `/q-question` did its job.

Planning-review research directories are lightweight research workspaces. They do not get their own `design.md`, `design-product.md`, `outline.md`, or `plan.md`; the researched fixes apply back to the parent planning docs.

### Implementation review after code exists

Implementation review examines actual code and verification evidence.

- `straightforward_fix` findings can be fixed immediately as a final review-fix slice stacked on top of the implementation.
- When no findings remain, final implementation review creates or updates `[plan_dir]/done.md` with a whole-plan completion summary, review-session summary, verification evidence, and changelog sentence. Terminal XML should point its `<artifact>` at `done.md` and leave `<next>` empty.
- Deeper findings become a full QRSPI follow-up plan inside the timestamped implementation review directory. That review directory gets its own `questions/`, `research/`, `design.md`, `design-product.md`, `outline.md`, `plan.md`, `handoffs/`, and nested `reviews/`. Later `/q-implement` work from that review-dir plan stacks new branch slices on top of the original implementation.

Never overwrite the parent plan's `design.md`, `design-product.md`, `outline.md`, or `plan.md` for implementation-review follow-up work.

## Key Principles

- **Do not outsource the thinking.** The engineer is a critical part of the human gates. The agent dumps; the human steers.
- **LLM review edits artifacts.** Planning review runs after outline and plan, and should improve `design.md`, `design-product.md`, `outline.md`, and `plan.md` directly when fixes are clear. A passive report is not enough.
- **Human-facing planning is compressed.** For `design.md`, `design-product.md`, and `outline.md` artifacts: be extremely concise. Sacrifice grammar for the sake of concision. In `/q-question`, apply that style to the brainstorm/interview turns, not to the final research questions doc.
- **Separate context windows.** Question and Research run in fresh contexts. Research reads `AGENTS.md` and question docs for framing, stays blind to forward-looking plan artifacts, and answers questions with codebase facts.
- **Instruction budget.** Keep each stage skill focused. Do not combine stages into one mega-prompt.
- **Dumb zone.** Context windows degrade when overfilled. Load only the artifacts the stage skill names.
- **Vertical slices, not horizontal layers.** Each slice ships end-to-end with a verification checkpoint.
- **Fresh implementation directories, never worktrees.** `/q-workspace` creates or repairs a fresh filesystem copy named for the plan directory or ticket slug after final plan review. Do not use `git worktree`; use macOS `cp -ac source-dir clean-copy-dir` or Linux `cp -a --reflink=auto source-dir clean-copy-dir`.
- **Branch/submission model is repository-specific, and `cn-agents` uses workspace stack branches.** The fresh implementation workspace isolates concurrent work; branch policy follows the repo. Chestnut monorepo work normally uses Graphite slice branches. `cn-agents` QRSPI work also uses Graphite slice branches inside the fresh implementation workspace. `/q-workspace` selects the correct base: latest `main` when safe, or an unmerged parent stack top for review-fixes plans. Then `/q-implement` runs `gt create ..._slice-N` or `..._review_plan_slice-N` for tracked edit slices, commits with Graphite, and merges the completed stack back with `/cn-agents-merge`. Do not commit QRSPI implementation slices directly to `main` in `cn-agents`.
- **Design = brain dump + brain surgery.** Capture the approved technical direction in a lean doc; keep detailed decisions in ADRs.
- **Product Design = optional PRD coverage gate.** Use for product-critical, high-stakes, user-facing PRD-sensitive, compliance/security-sensitive, irreversible user/data behavior changes, demo impact, or non-technical stakeholder alignment concerns. Skip for internal tools, bugfixes, refactors, and low product-risk work.
- **Plan = tactical machine doc.** The plan is written for the implementing agent, but it still gets an LLM review before code starts.

## The Process Is Not Linear

The stages are the typical forward flow, but loops are expected:

- **Research -> Research**: Research reveals new code-answerable factual questions that materially inform design; create another research doc before `/q-design`.
- **Research -> Question**: Research reveals the questions missed human-goal/scope alignment, not just code facts.
- **Design -> Research**: Design needs facts not covered by existing research.
- **Product Design -> Design/Research**: optional PRD coverage reveals a product gap or missing fact.
- **Outline -> Product Design/Design**: Structural planning reveals a product or technical design flaw; run `/q-design-product` if product coverage becomes necessary.
- **Plan -> Outline/Product Design/Design**: Implementation steps reveal a slice, requirement, or interface problem; run `/q-design-product` if product coverage becomes necessary.
- **Planning Review -> Research for Review -> Address Review Research**: Review finds a factual gap; `q-research-for-review` answers it with category-aware context; `q-address-review-research` updates parent docs.
- **Implementation Review -> QRSPI follow-up**: Code review finds deeper work; the implementation review directory becomes a new plan dir for stacked follow-up slices.

When looping before implementation, update the parent planning docs. When looping after implementation review, write new planning artifacts under the implementation review directory.

## The Plan Directory

```text
thoughts/[git_username]/plans/[timestamp]_[plan-name]/
  AGENTS.md
  prds/
  context/
    brainstorms/    # q-question interview rationale for q-design
    question/
    research/
    design/
    design-product/
    outline/
    plan/
    implement/
    INDEX.md
  questions/
  research/
  design.md
  adrs/
  design-product.md
  outline.md
  plan.md
  handoffs/
  done.md            # terminal whole-plan completion summary after final implementation review
  reviews/
    YYYY-MM-DD_HH-MM-SS_[plan-name]_outline-review/
      review.md
      questions/     # only for planning-review codebase research follow-up
      research/
      context/
        brainstorms/
        research/
    YYYY-MM-DD_HH-MM-SS_[plan-name]_plan-review/
      review.md
      questions/     # only for planning-review codebase research follow-up
      research/
      context/
        brainstorms/
        research/
    YYYY-MM-DD_HH-MM-SS_[plan-name]_implementation-review/
      review.md
      AGENTS.md      # present when this review dir hosts follow-up QRSPI work
      prds/
      context/
        brainstorms/
        question/
        research/
        design/
        design-product/
        outline/
        plan/
        implement/
      questions/
      research/
      design.md
      adrs/
      design-product.md
      outline.md
      plan.md
      handoffs/
      reviews/
```

`context/` artifacts support later stages but do not replace primary stage artifacts. `context/brainstorms/` preserves q-question active context for q-design: Language / Domain Model, Alignment, decision branches, interview rationale, and ADR candidates. Load only the context subdirectories named by the active stage skill.

The copied `AGENTS.md` in each plan directory is curated long-term memory and the plan entrypoint. Preserve only durable decisions, gotchas, invariants, review learnings, language/ambiguity notes, ADR candidates, and pointers to canonical artifacts.

## Metadata Source

Before creating a new plan directory or writing a new markdown artifact, run:

```bash
~/dotfiles/spec_metadata.sh
```

Use its output for:

- `thoughts/[git_username]/...` path selection
- timestamped directory and filename values
- frontmatter fields such as date, researcher, git commit, branch, and repository

## Handoffs

Use `/q-handoff` to checkpoint progress within or between stages. Use `/q-resume` to pick up where you left off.

- After `design.md`: next is `/q-outline [design.md]`; optional product gate is `/q-design-product [design.md]` when product coverage is warranted.
- After `design-product.md`: next is `/q-outline [design-product.md]`.
- After `outline.md`: next is `/q-review [outline.md]`.
- After `plan.md`: `/q-plan` runs `just sync-thoughts`, then next is `/q-review [plan.md]`. After successful plan review, run `/q-workspace [plan.md]`; it creates/repairs the implementation workspace, records the base branch/commit in XML and plan memory, and then next is `/q-implement [plan.md]`.
- During implementation: intermediate handoffs resume with `/q-resume` in the same `/q-workspace`-recorded implementation workspace. The workspace is the unit of isolation; do not assume a branch exists or should be created. For Graphite edit slices, write the handoff before `gt create` so it is included in the slice commit; use `git_commit: pending-slice-commit` in that self-contained handoff and report the final branch-head hash only in the QRSPI XML result.
- Repository commit policy must be preserved in plans/handoffs: monorepo usually means Graphite slice branches; `cn-agents` means fresh workspace plus Graphite slice branches for each tracked edit slice, then `/cn-agents-merge` at the end. Do not record a `cn-agents` expectation to stay on `main` for slice commits.
- Implementation handoffs record the `/q-workspace` implementation directory; they must not instruct agents to create ad-hoc copies and must not point agents at `git worktree`.
- After all implementation slices are complete: the completion handoff advances to `/q-review [handoff.md]` in implementation mode.

## Standard Context Loading

Every stage skill starts by:

1. Reading this pipeline overview.
1. Reading exactly the artifacts listed in that stage skill.

Do not bulk-load the whole plan directory.

## Stage Skills

Each stage skill contains the full process, templates, and rules for that step:

- `~/.agents/skills/q-question/SKILL.md`
- `~/.agents/skills/q-research/SKILL.md`
- `~/.agents/skills/q-design/SKILL.md`
- `~/.agents/skills/q-design-product/SKILL.md`
- `~/.agents/skills/q-outline/SKILL.md`
- `~/.agents/skills/q-plan/SKILL.md`
- `~/.agents/skills/q-workspace/SKILL.md`
- `~/.agents/skills/q-implement/SKILL.md`
- `~/.agents/skills/q-review/SKILL.md`
- `~/.agents/skills/q-review-plan/SKILL.md`
- `~/.agents/skills/q-review-implementation/SKILL.md`
- `~/.agents/skills/q-research-for-review/SKILL.md`
- `~/.agents/skills/q-address-review-research/SKILL.md`

## Rules

- When a stage needs fresh discovery, use that stage's preferred read-only discovery/analyzer flow and write artifacts under `context/[stage]/`.
- Each stage reads artifacts from prior stages as directed by its skill. Do not skip stages for non-trivial work.
- Question, Research, and Design are human gates. Product Design is an optional human gate when product coverage is needed. Outline and plan are LLM-reviewed gates before implementation.
- `/q-review [outline.md]` and `/q-review [plan.md]` should revise planning docs toward readiness, including `design-product.md` when present, not merely report issues.
- `/q-implement` uses `/q-resume` checkpoint handoffs for intermediate slices and only hands off to `/q-review` after all slices are complete and verification passes.
- `/q-implement` and implementation-stage `/q-resume` work must happen in the fresh filesystem copy created/repaired by `/q-workspace` and recorded in `<workspace>`. Never use `git worktree`.
- Branching is not automatic. Follow the target repo's submission model after entering the workspace: use Graphite slice branches in repos that use Graphite. `cn-agents` uses this model too: create a branch for each tracked edit slice in the workspace, and use `/cn-agents-merge` after implementation/review is complete. For review-fixes plans whose parent stack is unmerged, `/q-workspace` must base the workspace on the parent stack top so `gt parent` of review-fix branches points at that top branch.
- `/q-review` must run `just sync-thoughts` after modifying planning artifacts. Final plan review advances to `/q-workspace`, which syncs the reviewed plan directory into the chosen implementation workspace before `/q-implement`.
- Keep `plan.md` status checkboxes updated during implementation.
- When looping back before implementation, update parent planning artifacts. When addressing implementation review follow-up, use the implementation review directory as the new plan dir.
- When a stage creates or updates an artifact, use `~/dotfiles/spec_metadata.sh` for timestamps and frontmatter.
- Stage completion XML should include the full path to the created artifact in `<artifact>` and the exact next `/q-*` command in `<next>`.
- Preserve the stage completion XML after follow-ups: answer the follow-up if needed, then re-emit the fenced `xml` `<qrspi-result>` with updated `<summary>`, `<artifact>`, and `<next>`, followed by the mandatory concise human summary.
