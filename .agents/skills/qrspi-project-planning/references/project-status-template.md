# Project Status Template

Use when creating a project-level milestone-planning status/dependency artifact.

## Rules

- Keep exact paths and recovery state here, not in `AGENTS.md`.
- Update when milestone QRSPI stages complete, human approvals are recorded, plans are reviewed, tickets are created, or architecture/spec work consumes milestone outlines.
- Linear may mirror high-level status, but this artifact is canonical for paths/gates.

## Template

```markdown
---
date: [metadata]
researcher: [name]
last_updated_by: [name]
git_commit: [hash]
branch: [branch]
repository: [repository]
stage: plan
artifact: milestone-planning-status
plan_dir: [project-plan-dir]
---

# Milestone Planning Status: [Project Name]

## Purpose
Canonical live status/dependency table for milestone planning. Update when milestone QRSPI stages complete, human approvals are recorded, plans are reviewed, tickets are created, or architecture/spec work consumes milestone outlines.

## Update Rules
- Project `AGENTS.md` points here; do not copy this table into `AGENTS.md`.
- Milestone sessions update their own row and dependency rows.
- Human approvals link to `reviews/.../review-human.md`.
- Architecture/spec work updates consumption status after using reviewed milestone outlines.
- Linear mirrors high-level team-visible status only.

## Planning Status
| Issue | Milestone | Milestone memory | Planning state | Question | Research | Design review | Outline review | Plan review | Ticket descriptions | Created tickets | Architecture/spec consumed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [ISSUE] | [Milestone name] | `milestones/[slug]/AGENTS.md` | not-started | — | — | — | — | — | — | — | no |

## Cross-Milestone Dependencies
| Source milestone | Dependent milestone | Type | Artifact | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | No dependencies recorded yet. |
```
