---
date: 2026-04-19T20:59:56-07:00
researcher: creative-mode-agent
last_updated_by: creative-mode-agent
git_commit: c17853f152992d191be230bfa7558b4cc80d0771
branch: feat/cctl-contrib-export-local-v2
repository: dotfiles
stage: question
ticket: "Draft a new `/q-review` skill for the QRSPI pipeline"
plan_dir: "thoughts/creative-mode-agent/plans/2026-04-19_20-00-55_pi-q-review-skill"
source_artifacts:
  - ".agents/skills/cc-validate-plan/SKILL.md"
---

# Q-Review Skill Brief

## Source Draft
The engineer provided a draft centered on validating implementation against a plan, verifying success criteria, running fast automated checks, and producing a structured validation report. The closest in-repo source artifact is `.agents/skills/cc-validate-plan/SKILL.md`.

## Engineer Clarifications
- `q-review` should do **both** plan validation and code review.
- `q-review` should **not edit any code**.
- The output should be a durable review artifact under `thoughts/.../plans/.../reviews/`.
- The review report should contain both the issues found and suggested ways to address them.
- The engineer will read the report and decide with the agent how to address issues; `q-review` should stop at the report.
- The next planned stage after review is a separate `q-test` stage for broader manual/integration testing with tools like Playwright and curl.
- `q-review` should use severity because it is useful.
- `q-review` should avoid expensive validation like Playwright runs and instead use fast commands such as build, lint, or similar quick checks.
- Important review concerns include whether tests are meaningful, whether mocks can be reduced in favor of more real code paths, whether errors are handled robustly, and whether code follows codebase best practices.
- The engineer is interested in review lanes/subagents for criteria such as plan adherence, test value, and error handling.
