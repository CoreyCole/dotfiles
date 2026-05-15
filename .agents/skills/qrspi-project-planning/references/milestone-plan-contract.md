# Milestone Plan Contract

Use when creating or reviewing a milestone `plan.md`.

A milestone plan is valid when it operationalizes an approved milestone outline into Linear ticket creation and routing/status updates. It is not a code implementation plan.

## Preconditions

- Milestone `design.md` automated review complete.
- Design human approval recorded as `review-human.md` when project policy requires it.
- Milestone `outline.md` automated review complete.
- Outline human approval recorded as `review-human.md`.
- Project status artifact current enough to update.

## Required sections

1. **Goal**

   - create/update future tickets and routing docs from approved outline

1. **Preconditions**

   - links to design/outline reviews and human approvals

1. **Ticket creation table**

   - title
   - type: implementation/spec/test/docs/process
   - milestone/project fields
   - dependencies/relations
   - source outline sections
   - do-not-create-if guard for conditional scope

1. **Ticket description doc index**

   - separate Markdown docs under `context/plan/linear-ticket-descriptions/`
   - plan references them; does not inline long descriptions

1. **Linear fields and relations**

   - assignee/status/cycle/labels/project/milestone
   - blocks/blocked-by/related relationships

1. **Status/doc update steps**

   - project status artifact
   - milestone `AGENTS.md`
   - Linear project log if Linear changed

1. **Ticket directory creation steps**

   - create dirs only after Linear IDs exist
   - use `NN-issue-slug/` or project convention
   - create routing-only ticket `AGENTS.md`

1. **Execution checklist**

   - ordered mutation steps
   - verification after each mutation group

1. **Rollback/correction steps**

   - duplicate ticket handling
   - wrong fields/relations correction
   - status artifact correction

1. **Out of scope**

   - no code implementation design beyond approved outline
   - no architecture/spec synthesis

## Ticket description docs

Each description doc should contain:

- title
- goal
- user stories/gaps covered
- source artifacts
- expected output/evidence
- dependencies/relations
- suggested next command after ticket exists
- do-not-create-if guard when conditional

## Anti-patterns

- Inline giant ticket descriptions in `plan.md`.
- Creating ticket dirs before Linear IDs exist.
- Turning milestone plan into implementation slices.
- Creating tickets from unapproved outline.
- Updating Linear without updating repo status artifacts.
