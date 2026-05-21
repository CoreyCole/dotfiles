---
name: q-question
description: Decompose a ticket or task into neutral research questions for the QRSPI pipeline. Start with a brief creative brainstorm, then interview the lead engineer on desired outcomes, goals, design principles, and tradeoffs before finalizing the questions.
---

# Question — Decompose the Ticket

> **Pipeline overview:** `~/.agents/skills/qrspi-planning/SKILL.md`

## Runtime XML contract

Every response that completes a QRSPI workflow node must include a fenced `xml` block containing `<qrspi-result>`, followed by a mandatory concise human summary. Do not use prose-only `Artifact` / `Summary` / `Next` completion responses.

Required shape:

```xml
<qrspi-result>
  <stage>[canonical node id]</stage>
  <status>complete</status>
  <outcome>[node-specific branch outcome]</outcome>
  <workspace>[absolute implementation workspace when known]</workspace>
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

`status` is lifecycle. `outcome` selects the graph branch. `<next>` is display/debug only; runtime transitions are graph-authoritative. Complete results must include `<outcome>`. Review stages must use explicit node IDs (`review-design`, `review-outline`, `review-plan`, or `review-implementation`), never `review`.

You are the first stage of the QRSPI pipeline. Convert an underspecified request into 3-7 specific, answerable research questions.

## Goal

Establish with ~95% confidence what the user actually wants. Start by investigating context, then run a brief creative brainstorm of possible question areas, decision branches, tensions, and unknowns. Interview the lead engineer until there is shared understanding of desired outcome, goals, design principles, and tradeoffs before locking the research agenda. Do not try to resolve every factual uncertainty in this phase — some questions should be intentionally deferred to research.

## When Invoked

0. **Load context:**
   - Read `~/.agents/skills/qrspi-planning/SKILL.md` (pipeline overview)
   - If a plan directory was provided (follow-up pass), load existing artifacts:
     - `[plan_dir]/AGENTS.md`
     - All files in `[plan_dir]/questions/`
     - `[plan_dir]/design.md`
     - `[plan_dir]/outline.md`
     - All files in `[plan_dir]/research/`
     - All files in `[plan_dir]/prds/`
     - Relevant files in `[plan_dir]/context/question/` when present
     - Existing files in `[plan_dir]/context/brainstorms/` when present
     - For implementation-review follow-up plan dirs under `[parent_plan_dir]/reviews/*_implementation-review/`, treat that timestamped review directory as the plan directory; do not climb to or mutate the parent plan's `design.md` / `outline.md`
     - For planning-review follow-up dirs under `[parent_plan_dir]/reviews/*_[outline|plan]-review/`, treat the review directory as a lightweight research workspace; question docs still go under its `questions/`, and later `/skill:q-address-review-research` applies fixes to the parent docs
1. **If a ticket path, plan directory, artifact path, review-context-doc path, or description was provided**, read it fully and begin.
1. **If no parameters**, respond:

```
I'll help decompose a ticket into research questions.

Please provide:
1. The ticket, issue, or feature description (or a file path to one)
2. Any additional context

Tip: `/q-question thoughts/shared/tickets/ENG-1234.md`
2nd pass: `/q-question thoughts/[git_username]/plans/[timestamp]_[plan-name]`
Review follow-up: `/skill:q-question thoughts/[git_username]/plans/[timestamp]_[plan-name]/reviews/YYYY-MM-DD_HH-MM-SS_implementation-review/review.md`
Or, if the follow-up plan already exists: `/skill:q-question thoughts/[git_username]/plans/[timestamp]_[plan-name]/reviews/YYYY-MM-DD_HH-MM-SS_implementation-review`
```

Then wait for input.

## Process

1. **Gather metadata** by running `~/dotfiles/spec_metadata.sh`. Use its `Git Username` and `Timestamp For Filename` output for the plan directory, question filename, and frontmatter fields.

1. **Determine the plan directory**:

   - New work: create `thoughts/[git_username]/plans/[timestamp]_[plan-name]/`
   - Follow-up pass: reuse the existing plan directory exactly
   - Review follow-up plan: if the input is inside `[parent_plan_dir]/reviews/*/`, reuse that timestamped review directory exactly
   - Review artifact seed: if the input is `[parent_plan_dir]/reviews/*_implementation-review/review.md` or an implementation review directory, create or reuse that directory as a new review-directory QRSPI plan directory
   - Planning review seed: if the input is `[parent_plan_dir]/reviews/*_[outline|plan]-review/review.md` or a planning review directory, reuse that directory as a lightweight research workspace, not as a full nested QRSPI plan

1. **Ensure scaffolding exists**:

   - Copy `AGENTS.md` into plan dir from `~/.agents/skills/qrspi-planning/_AGENTS.md` if missing
   - Ensure `[plan_dir]/prds/`, `[plan_dir]/questions/`, `[plan_dir]/research/`, `[plan_dir]/adrs/`, `[plan_dir]/handoffs/`, and `[plan_dir]/reviews/` exist
   - For normal top-level plans and implementation-review follow-up plans, also ensure `[plan_dir]/context/{brainstorms,question,research,design,design-product,outline,plan,implement}/` exists
   - For planning-review research workspaces, ensure `[plan_dir]/context/{brainstorms,research}/` exists for brainstorm notes and `/skill:q-research-for-review` locator/analyzer artifacts
   - For review-directory follow-up plans and planning-review research workspaces, do not create a separate copied review seed in `context/question/`; the first artifact is the review follow-up question doc in `questions/`

1. **Create the brainstorm artifact before interviewing** at `[plan_dir]/context/brainstorms/YYYY-MM-DD_HH-MM-SS_[topic-name].md`.

   - Use `~/dotfiles/spec_metadata.sh` timestamp/frontmatter.
   - Start it with sections for `Problem framing`, `Source context`, `Language / Domain Model`, `Alignment`, `Decision branches`, `Interview log`, `ADR candidates for design`, and `Rationale to preserve for design`.
   - Keep it structured. Do not append every human turn as another bullet in one growing list.
   - Use `Source context` for the user prompt/ticket, code/docs/past thoughts checked, and what was found.
   - Use `Language / Domain Model` opportunistically. Include `Canonical terms`, `Relationships`, `Flagged ambiguities`, and optional `Example scenario / dialogue`; write `None yet.` when no domain clarification is needed. This section follows the discipline of `grill-with-docs` `CONTEXT.md`, but stays inside the brainstorm artifact.
   - Use `Alignment` for desired outcome, scope, non-goals, design principles, and tradeoffs to preserve. Do not use it to select an implementation approach.
   - Use subsections under `Interview log` grouped by decision topic. For each topic, record:
     - `Prompt` — the question/recommendation posed, in one line.
     - `User decision` — confirmed/rejected/adjusted guidance.
     - `Rationale` — why this matters for design/research.
     - `Next implication` — what branch/question this unlocks.
   - Use `ADR candidates for design` for hard-to-reverse/surprising/tradeoff decisions that q-design should reconsider after research. Do not write ADRs in q-question.
   - Maintain `Rationale to preserve for design` as categorized bullets that match the topic. Rewrite/merge bullets as understanding changes instead of appending duplicate chronology.
   - Append/update it after each confirmed lead-engineer decision or clarification, plus investigation summaries and branch maps. Capture decisions, rejected branches, constraints, tradeoffs, and why the next question changed. Do not dump a raw transcript.
   - For review-directory follow-up plans and planning-review research workspaces, write the brainstorm artifact directly under that directory's `context/brainstorms/`.

1. **Read ticket/PRDs and linked docs fully**.

   - If invoked on a canonical review artifact at `[parent_plan_dir]/reviews/*/review.md`, read it fully and treat it as the source problem statement for the review follow-up loop.
   - If invoked inside `[parent_plan_dir]/reviews/*/`, read any existing `questions/*.md`, `prds/*`, and `review.md` if present.

1. **For Linear tickets, capture complete ticket context before brainstorming**:

   - Trigger when input is a Linear identifier/link/export or the ticket text clearly references Linear.
   - Create `[plan_dir]/context/question/linear/images/` as needed; this stores ticket assets, not copied review seeds.
   - Run `linear-cli i get [ISSUE] --output json` and `linear-cli cm list [ISSUE] --all --output json`; save results under `[plan_dir]/context/question/linear/issue.json` and `comments.json`, plus a readable `comments.md` with author/date/body. Always include `--all` so paginated comments are not missed.
   - Extract `https://uploads.linear.app/...` URLs from the issue description and every comment.
   - Download image uploads to `[plan_dir]/context/question/linear/images/` using `linear-cli up fetch [URL] -f [path]`; preserve extensions. Use a temporary filename first if the helpful title depends on viewing the image.
   - Name images `[issue]_[helpful-title]_[source]_[NN].[ext]`, where helpful-title comes from nearby text, alt text, comment context, or visible screenshot purpose after reading the image. Do not leave opaque upload IDs as the only title.
   - Read each downloaded image before the interview; include the image paths, source comment/description, and why they matter in the `Brainstorm Summary`.
   - Treat comment text as source context for brainstorm/interview and research-question scope, not as settled design truth.

1. **Populate `prds/` when relevant**:

   - Store relevant PRDs, ticket exports, screenshots under `[plan_dir]/prds/`
   - Prefer descriptive filenames and preserve history

1. **Investigate before asking**:

   - Before interviewing the engineer, do lightweight context discovery using basic `rg`, `find`, `ls`, or targeted reads based on the ticket/PRD.
   - Use the results to validate terminology, identify likely entry points, and spot obvious implementation files, tests, docs, or configs.
   - If the prompt, ticket, docs, code, or engineer indicate prior related work, do a bounded search of relevant `thoughts/` plan dirs and read only promising artifacts such as `AGENTS.md`, `questions/*.md`, `design.md`, or `done.md`. Do not perform broad historical archaeology by default.
   - If a question can be answered by exploring the codebase, docs, or relevant past plan artifacts, explore first instead of asking the engineer.
   - Share a short "what I found" summary, then ask the engineer to confirm or adjust the synthesized understanding before moving into research-question finalization.
   - Append the findings and why they matter to the brainstorm artifact.
   - Do NOT try to map the whole area or deeply analyze the implementation at this stage.

1. **Start with a short creative brainstorm before converging**:

   - Sketch a few plausible question areas, tensions, unknowns, forks in the road, and decision-tree branches.
   - Use the brainstorm to expose hidden assumptions, dependencies between decisions, and missing context.
   - Keep it short and exploratory — this is for discovering better questions, not proposing solutions.
   - Use `/grill-me` style for brainstorm/interview turns: be extremely concise; sacrifice grammar for concision.
   - Append the branch map, tensions, and discarded/kept paths to the brainstorm artifact.
   - Do not commit to an approach during the brainstorm.

1. **Interview the lead engineer before finalizing questions**:

   - Treat the human in chat as the lead engineer / design owner unless told otherwise.
   - Interview relentlessly but respectfully: walk down each important branch of the decision tree until shared understanding is reached.
   - Resolve dependencies between decisions one-by-one; do not ask about a downstream choice before its upstream premise is clear.
   - Ask questions one at a time by default. If several independent questions truly need batch input, use `/answer`, but keep each item focused.
   - Keep interview questions and recommendations extremely concise. Sacrifice grammar for concision.
   - For each human-judgment question, provide your recommended answer and why, then ask the engineer to confirm, reject, or adjust it.
   - Focus on desired outcome, goals, design principles, scope, non-goals, constraints, risks, success criteria, and tradeoffs.
   - Align on how the work should proceed through QRSPI, but do not choose or recommend the implementation approach; q-research should inform q-design's tradeoffs.
   - When the engineer uses fuzzy or conflicting language, soft-normalize it to QRSPI terms and ask only when the mismatch affects scope or semantics.
   - Let the engineer explicitly defer open factual or codebase questions to the research phase when appropriate.
   - Append each confirmed answer's rationale, resulting decision, and next-question implication to the brainstorm artifact. Do not record tentative chat as settled context.

   If confidence is below ~95%, continue the interview. Do not guess.

1. **Optionally read a few surfaced files yourself** — only enough to sharpen the research questions, not to answer them or form a solution.

1. **Finalize the brainstorm artifact** with a concise `Rationale to preserve for design` section. Then write a concise `Brainstorm Summary` for the question doc from that artifact. Capture the important design context surfaced during investigation, brainstorm, and interview:

- For review-seeded follow-up work, summarize which review findings are in scope for this new loop, which are intentionally deferred, and any requested outcome or sequencing guidance from the lead engineer.
- desired outcome
- explicit design details or constraints already established
- Linear comments and downloaded image paths when they informed context
- decisions already made
- tradeoffs, risks, non-goals, or tensions that research should keep in view

11. **Update `[plan_dir]/AGENTS.md` as the plan entrypoint**.

- Always add or refresh concise pointers to the canonical q-question artifacts:
  - Brainstorm / alignment: `[plan_dir]/context/brainstorms/...`
  - Research agenda: `[plan_dir]/questions/...`
- Add durable highlights only when future stages could be harmed by missing them: confirmed constraints, non-goals, naming choices, domain ambiguities, tradeoffs, or ADR candidates.
- Keep it curated and stable.
- Do not copy the whole brainstorm summary or domain model into AGENTS.

12. **Write 3-7 research questions** to a new timestamped file under `[plan_dir]/questions/`. Questions must be:

- Specific and independently answerable
- Neutral
- Fact-focused

13. **Include Codebase References** section with suggested starting points.

## Output Template

Write to `thoughts/[git_username]/plans/[timestamp]_[plan-name]/questions/YYYY-MM-DD_HH-MM-SS_topic-name.md`:

```markdown
---
date: [ISO datetime with timezone]
researcher: [git_username]
last_updated_by: [git_username]
git_commit: [current commit hash]
branch: [current branch]
repository: [repository name]
stage: question
ticket: "[ticket reference if any]"
plan_dir: "thoughts/[git_username]/plans/[timestamp]_[plan-name]"
question_doc: "thoughts/[git_username]/plans/[timestamp]_[plan-name]/questions/YYYY-MM-DD_HH-MM-SS_topic-name.md"
brainstorm_doc: "thoughts/[git_username]/plans/[timestamp]_[plan-name]/context/brainstorms/YYYY-MM-DD_HH-MM-SS_topic-name.md"
prev_question_docs:
  - "thoughts/[git_username]/plans/[timestamp]_[plan-name]/questions/..."
---

# Research Questions: [Ticket Title]

## Brainstorm Summary
- [Validated desired outcome from investigation/brainstorm/interview]
- [Design principles, constraints, scope, and non-goals already established]
- [Concise language/domain notes needed to understand what to look for; avoid solution hypotheses]
- [Tradeoffs to preserve and ADR candidates for q-design, if any]
- [Open tensions intentionally deferred to research]
- [Linear comments/images used as context, with paths like `context/question/linear/images/...` when applicable]

## Context
[1-3 sentence summary of validated user need. No solution proposal.]

## Brainstorm Artifact
- `context/brainstorms/YYYY-MM-DD_HH-MM-SS_topic-name.md` — full interview rationale and decision branches for design.

## Questions
1. [Specific question about current behavior, data flow, or architecture]
2. [Question about existing patterns or conventions]
3. [Question about edge cases, constraints, or dependencies]
4. [Question about test coverage or gaps]
...

## Codebase References
- `path/to/relevant/file.ext` — [why it's relevant]
- `path/to/another/file.ext` — [why it's relevant]
```

## Response

When the question doc is written, emit this fenced XML result, followed by the mandatory concise human summary.

Post-XML natural summary format for this stage: list research questions as concisely as possible, one question per line. Caveman speak. Few words. Most important words only. Use:

```text
Questions:
- [few-word question?]
- [few-word question?]
```

```xml
<qrspi-result>
  <stage>question</stage>
  <status>complete</status>
  <outcome>complete</outcome>
  <policy>
    <autoMode>[current persisted policy]</autoMode>
    <enablePlanReviews>[current persisted policy]</enablePlanReviews>
    <invalidResultRetryLimit>[current persisted policy or 1]</invalidResultRetryLimit>
  </policy>
  <summary>
    <plan-goal>[overall plan/workflow goal]</plan-goal>
    <stage-completed>[what this stage produced]</stage-completed>
    <key-decisions>[decisions, risks, or why next step is safe]</key-decisions>
  </summary>
  <artifact>thoughts/.../questions/YYYY-MM-DD_HH-MM-SS_topic-name.md</artifact>
  <next>/q-research thoughts/.../questions/YYYY-MM-DD_HH-MM-SS_topic-name.md</next>
</qrspi-result>
```

Always include the complete `thoughts/.../questions/YYYY-MM-DD_HH-MM-SS_topic-name.md` path.

## Rules

- If invoked on an implementation review artifact from `/q-review`, create or reuse the timestamped `reviews/*_implementation-review/` directory as the QRSPI plan and treat that review as source material for the review follow-up loop. Do not continue the parent implementation plan in-place.
- If invoked on a planning review artifact from `/q-review`, reuse the timestamped `reviews/*_[outline|plan]-review/` directory as a lightweight research workspace. Write neutral questions under its `questions/`; after `/skill:q-research-for-review`, `/skill:q-address-review-research` applies fixes to the parent planning docs.
- For review-directory follow-up plans and planning-review research workspaces, write the question doc directly under `questions/`; do not create a separate copied review context under `context/question/`.
- Never overwrite or append review-follow-up design/outline work into the parent plan's `design.md` or `outline.md` from `q-question`.
- For review-seeded follow-up work, convert review findings into neutral research questions rather than copying review recommendations as settled solutions.
- Do NOT include preferred solutions in questions.
- Do NOT propose approaches or pseudocode.
- Always investigate lightweight codebase context before asking the engineer questions.
- For Linear tickets, always fetch issue comments before brainstorming and download/read Linear image uploads into `[plan_dir]/context/question/linear/images/` before writing the question doc.
- If a question can be answered by exploring the codebase, explore the codebase instead of asking the engineer.
- Always create and maintain `[plan_dir]/context/brainstorms/YYYY-MM-DD_HH-MM-SS_[topic-name].md` during the brainstorm/interview before writing questions.
- Keep brainstorm artifacts organized by decision topic, not chronological append-only bullets. Rewrite sections to stay readable as the interview evolves.
- Include opportunistic `Language / Domain Model`, `Alignment`, and `ADR candidates for design` sections in the brainstorm artifact; write `None yet.` when they do not apply.
- Update the brainstorm artifact after each confirmed lead-engineer decision or clarification, not after every tentative discussion turn.
- Always start with a short creative brainstorm before converging on the final questions.
- Always ask the lead engineer before proceeding to write the question doc.
- Ask interview questions one at a time by default; use `/answer` only when batching independent questions is genuinely clearer.
- For each human-judgment question, include your recommended answer and concise reasoning.
- Walk down decision-tree branches and resolve dependencies between decisions before finalizing questions.
- Keep the interview structure flexible — it is not a fixed questionnaire.
- The question phase should focus on the desired outcome, goals, design principles, and tradeoffs.
- The first section of the question doc must be a concise `Brainstorm Summary` so downstream stages inherit the key design context.
- The `Brainstorm Summary` should capture validated human guidance, relevant codebase context, language/domain notes, and tradeoffs to preserve, not speculative agent solutions.
- Keep research questions unbiased and fact-focused. The brainstorm can explain why we care; the questions should ask what the codebase/docs/tests actually do.
- Some questions may be intentionally deferred to the research phase.
- Do NOT write the question doc until the lead-engineer interview is complete.
- Treat the user's first request as a hypothesis, not a spec.
- Do NOT turn `q-question` into a mapping pass or deep analysis stage.
- Use extreme concision for the brainstorm/interview conversation, not as a special style rule for the final research questions doc.
- Keep it short: questions, not essays.
- Completion responses must be the fenced XML `<qrspi-result>` block required by the runtime contract, followed by the mandatory concise human summary.
- Post-XML summary for question stage: only concise question list; one question per line. Caveman clear. No extra explanation.
