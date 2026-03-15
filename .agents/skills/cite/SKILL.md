---
description: Research online verified sources like official documentation, provide links and direct quotes. Use when the user needs citations, references, or verified information from authoritative web sources.
---

# Cite — Verified Source Research

You are tasked with researching a topic online, finding authoritative sources, and producing a citation document with **verified quotes** — quotes that have been confirmed to exist in the fetched HTML of each source.

Arguments provided: $ARGUMENTS

## Process

### Step 1: Understand the Research Query

- If arguments were provided, use them as the research topic
- If no arguments provided, ask:
  ```
  What topic would you like me to research and cite sources for?

  Examples:
  - `/cite how does React server components streaming work`
  - `/cite Claude API tool_use format`
  - `/cite Go context cancellation best practices`
  ```
  Then wait for the user's input.

### Step 2: Dispatch Research to cite-researcher Agent

Spawn the **cite-researcher** agent with a detailed prompt:

- Include the full research question/topic
- Specify what kind of sources to prioritize (e.g., official docs, specs, tutorials)
- Request at least 3-5 citations if available
- Instruct it to verify all quotes against fetched HTML

If the topic is broad or multi-faceted, spawn **multiple cite-researcher agents in parallel**, each focused on a different aspect. For example:
- If researching "React Server Components", spawn one for "RSC streaming protocol" and another for "RSC data fetching patterns"

### Step 3: Final Verification

After receiving results from the cite-researcher agent(s):

1. **Review all verified citations** — ensure they look reasonable and relevant
2. **Re-verify a sample**: Pick 1-2 citations and use WebFetch yourself to confirm the quote exists at the cited URL. Search the fetched content for distinctive phrases from the quote.
3. **If re-verification fails**: Mark the citation as unverified and note the discrepancy
4. **Discard any citation where the quote cannot be confirmed**

### Step 4: Generate Citation Document

1. **Determine the filename**:
   - Run `git config user.name` to get the git username
   - Run `date '+%Y-%m-%d-%H-%M-%S'` to get the timestamp
   - Path: `thoughts/[git_username]/citations/YYYY-MM-DD-HH-MM-SS_[topic-slug].md`
   - Example: `thoughts/CoreyCole/citations/2026-03-14-18-30-00_react-server-components.md`

2. **Write the document** using this template:

```markdown
---
date: [ISO timestamp]
researcher: [git username]
topic: "[Research topic]"
tags: [citations, research, relevant-tags]
status: complete
sources_verified: true
citations_count: [number of verified citations]
---

# Citations: [Research Topic]

**Date**: [ISO timestamp]
**Researcher**: [git username]
**Query**: [Original research query]

## Summary

[2-4 sentence summary of what the research found, synthesizing across all citations]

## Verified Citations

### 1. [Source Title]
- **URL**: [full URL]
- **Accessed**: [ISO date]
- **Section**: [section/heading if identifiable]

> [Exact verified quote]

**Relevance**: [Why this citation matters to the research topic]

---

### 2. [Source Title]
[Same structure...]

---

## Unverified Citations

[Any citations that could not be verified. Include URL and attempted quote for manual follow-up.]

### [Source Title]
- **URL**: [full URL]
- **Attempted Quote**: "[quote that could not be verified]"
- **Reason**: [Why verification failed]

## Research Metadata

- **Searches performed**: [count]
- **Pages fetched**: [count]
- **Citations verified**: [count]
- **Citations discarded**: [count]
- **Sources consulted**: [list of domains]
```

### Step 5: Present Results

After writing the document, present a concise summary to the user:

```
Research complete! Found [N] verified citations for "[topic]".

Document saved to: `thoughts/[git_username]/citations/YYYY-MM-DD-HH-MM-SS_[topic].md`

Key findings:
- [Key finding 1 with source attribution]
- [Key finding 2 with source attribution]

All quotes have been verified against their source HTML.
```

## Important Guidelines

- **Verification is non-negotiable**: Every quote in the "Verified Citations" section MUST have been confirmed present in fetched HTML. If you can't verify it, it goes in "Unverified Citations".
- **Prefer official documentation**: Always check official docs before blogs or tutorials
- **Note version sensitivity**: Flag when information is specific to a version or may become outdated
- **No fabrication**: If sources are scarce, report that honestly rather than padding with unverified content
- **Blockquote format**: Always use `>` blockquote syntax for quotes in the final document
- **Re-verification is required**: Always re-verify at least 1-2 citations from the sub-agent's results yourself before finalizing
