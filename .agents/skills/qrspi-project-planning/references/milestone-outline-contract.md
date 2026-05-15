# Milestone Outline Contract

Use when creating or reviewing a milestone `outline.md`.

A milestone outline is valid when it gives lead/product enough signal to sign off direction and gives architecture/spec work enough context to synthesize whole-system design.

## Required sections

1. **Milestone purpose**

   - what this milestone owns
   - what it explicitly does not own

1. **Current code/system state**

   - evidence-backed current capabilities
   - relevant services/tables/APIs/UI/jobs/tests
   - file refs where code behavior matters

1. **Source-doc / requirement state**

   - concise summaries only
   - canonical source links/paths
   - ambiguities and open product/data questions

1. **Target behavior user stories**

   - concise user stories
   - engineers can be users for technical enablement
   - every proposed ticket maps to at least one user story

1. **Gap map**

   - current → target
   - supported / partial / missing
   - requirement/source references

1. **Architecture/spec inputs**

   - cross-cutting decisions and constraints
   - system concepts the whole-system architecture/spec must consume
   - current-to-target implications

1. **Proposed ticket list**

   - title
   - goal
   - why it exists
   - dependencies
   - expected output/evidence
   - implementation/spec/test/docs/process classification

1. **Ticket traceability**

   - proposed ticket → user stories → gaps → dependencies → evidence

1. **Deferred to ticket-level QRSPI**

   - details intentionally not decided here
   - implementation specifics future ticket research/design must own

1. **Cross-milestone dependencies**

   - blockers/informs/test dependencies/open questions
   - owner and status

1. **Taxonomy change proposals**

   - proposed only; do not silently mutate project taxonomy

1. **Open human/product questions**

   - questions requiring judgment, not code lookup

## Anti-patterns

- Ticket list with no user-story/gap traceability.
- Long copied requirements.
- Implementation slice plan masquerading as milestone outline.
- Hidden taxonomy changes.
- Architecture/spec inputs missing or deferred to plan.
- Clean automated review treated as human approval.
