# Human Review Template

Use when recording human approval after automated milestone design or outline review.

## Rules

- Write `review-human.md` beside the automated `review.md`.
- Record the actual human decision; do not fabricate approval.
- Include notes from final review, required edits, and explicitly deferred concerns.
- Keep concise.

## Template

```markdown
---
date: [metadata]
reviewer: [human name]
last_updated_by: [agent/user]
git_commit: [hash]
branch: [branch]
repository: [repository]
stage: human-review
artifact: review-human
related_artifact: [path to reviewed design.md or outline.md]
automated_review: [path to review.md]
---

# Human Review: [Artifact Name]

## Decision
[approved | approved with notes | not approved]

## Approved Artifact
- [path]

## Reviewer
- [name]

## Notes
- [concise final review comments]

## Required Edits Applied
- [edit or `None`]

## Deferred Concerns
- [concern, owner, follow-up artifact/ticket or `None`]

## Next Command
[expected next /q-* command]
```
