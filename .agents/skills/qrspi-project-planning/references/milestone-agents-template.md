# Milestone AGENTS.md Template

Use when scaffolding a milestone directory.

## Rules

- Keep routing-only and durable.
- Use because `AGENTS.md` auto-loads when agents read files in the milestone directory.
- Do not include live dashboards, long source summaries, proposed ticket descriptions, or implementation plans.
- Add only stable decisions from milestone-level QRSPI.

## Template

```markdown
# Milestone: [Name]

## Current focus
Run milestone-level QRSPI when this milestone starts. Do not create implementation/spec tickets until milestone `plan.md` is reviewed.

## Goal
[1-2 line milestone goal]

## Scope
- [What this milestone owns]

## Non-goals
- Detailed ticket implementation plans; ticket-level QRSPI owns those.
- Live status dashboard; update project status artifact instead.
- Long source summaries or ticket descriptions.

## Canonical pointers
- Project plan memory: `[relative path to project AGENTS.md]`
- Project milestone status: `[relative path to project status artifact]`
- Shared source map / process context: `[relative path if applicable]`
- Requirements index / canonical source docs: `[relative path(s) if applicable]`
- Milestone-plan dir: `milestone-plan/`
- Linear planning ticket: [ISSUE] [URL]

## Durable decisions
- None yet. Add only stable decisions from milestone-level QRSPI.

## Suggested next command
/q-milestone-question [project-plan-dir]/milestones/[NN-slug]/milestone-plan
```
