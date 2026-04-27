---
name: pi-pr-comments
description: Address GitHub PR review comments in pi. Use when asked to handle PR comments, respond to review feedback, fix review comments, reply to GitHub PR comments, or work through unresolved review threads. Fetches comments with gh, batches triage with the user, applies fixes on the correct branch, and replies on GitHub using pi's /answer flow.
---

# Address PR Review Comments In Pi

Fetch unresolved GitHub PR review comments, triage them with the user in batches, make the agreed changes on the correct branch, and reply on the PR.

Arguments provided: $ARGUMENTS

## Step 1: Identify the PR

Parse `$ARGUMENTS` as one of:
- PR number
- PR URL
- branch name

Use this order:

1. If a PR number or URL is provided, extract the PR number.
2. If a branch name is provided, look up the PR:
   ```bash
   gh pr list --head {branch_name} --json number,title,headRefName --jq '.[0]'
   ```
3. If no arguments are provided, list recent open PRs and ask the user which PR to use:
   ```bash
   gh pr list --json number,title,headRefName,reviewDecision --jq '.[] | "#\(.number)\t\(.headRefName)\t\(.reviewDecision // "")\t\(.title)"'
   ```

If multiple PRs match a branch, stop and ask the user to choose explicitly.

## Step 2: Gather repo and PR metadata

Fetch repo identity:

```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'
```

Fetch PR metadata:

```bash
gh pr view {pr_number} --json number,title,author,headRefName,baseRefName,url
```

Record:
- repo
- PR number
- PR title
- PR author login
- head branch
- base branch
- PR URL

## Step 3: Fetch review comments and threads

Fetch inline review comments:

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --paginate
```

Also fetch top-level issue comments:

```bash
gh api repos/{owner}/{repo}/issues/{pr_number}/comments --paginate
```

Prefer threaded review context over isolated comments. Group inline comments by:
- root thread comment id (`in_reply_to_id` chain)
- file path
- line

Treat a thread as actionable only if its latest message is from a reviewer or another non-author participant asking for action. Skip:
- self-comments from the PR author that are just context
- approval-only or emoji-only comments
- stale sub-comments where a later reply already addressed the issue

If you cannot reliably determine resolved state from the available API output, be explicit about that and surface the likely-actionable threads instead of pretending the thread is resolved.

## Step 4: Read code context before asking the user

For each likely-actionable thread:
- read the referenced file
- inspect surrounding lines near the commented line
- understand whether the comment requests:
  - a code change
  - an explanation
  - a follow-up question
  - no action

Do not ask the user to triage comments blindly without code context.

## Step 5: Batch triage with the user

Batch comments into a single numbered triage message instead of interrupting the user one comment at a time.

For each item include:
- item number
- file and line
- reviewer
- short summary of the request
- your recommended action: `fix`, `reply`, or `skip`

Then ask the user to respond in a compact format, for example:

```text
1 fix
2 reply: this is intentional because ...
3 skip
```

After sending the batched triage prompt, use pi's execute-command flow to hand control back cleanly:
- if you asked multiple triage questions or requested a structured batch response, call `execute_command` with `/answer`
- reason example: `Collect batched PR comment triage decisions from the user before editing code.`

Use `/answer` only after you have already presented the batched choices to the user.

## Step 6: Record branch state before editing

Record the current branch:

```bash
git branch --show-current
```

Store it as `{original_branch}`.

All code changes should target the PR head branch.

## Step 7: Make the agreed code changes

For every item marked `fix`:
- read the target file again if needed
- make the smallest correct change
- keep comments grouped by file/branch so edits stay coherent
- run focused verification when possible

Prefer staying on the current branch only if it already is the PR branch.

If you need to move work onto the PR branch:
1. tell the user what branch you need
2. check for uncommitted changes
3. stash only if necessary
4. switch deliberately
5. restore the original branch when finished if you switched away from it

Do not silently discard or overwrite local changes.

## Step 8: Commit and push intentionally

Show the user the planned files and commit message before committing.

Use the repository's normal branch workflow if one exists. If the repo uses Graphite, prefer `gt modify` / `gt submit`; otherwise use normal git.

Do not push or submit silently if the repo workflow or branch state is unclear.

## Step 9: Reply on GitHub

After code is updated and pushed, reply to each addressed comment.

For inline PR comments:

```bash
gh api repos/{owner}/{repo}/pulls/comments/{comment_id}/replies -f body='{reply_text}'
```

For top-level issue comments:

```bash
gh api repos/{owner}/{repo}/issues/{pr_number}/comments -f body='{reply_text}'
```

Reply patterns:
- fixed comments: concise summary of what changed
- reply-only comments: use the user's explanation, tightened for clarity
- skipped comments: do not reply unless the user asked you to

Do not claim a comment is fixed unless the change is actually committed and pushed.

## Step 10: Summarize

Report:
- PR handled
- comments reviewed
- comments fixed
- comments replied to
- comments skipped
- branch(es) touched
- verification run
- any comments left unresolved intentionally

## Do Not

- Do not rely on imaginary tools like `AskUserQuestion`; in pi, ask directly in the conversation.
- Do not ask one question per comment when a single batched triage prompt will do.
- Do not switch branches without telling the user if there is any risk to local state.
- Do not pretend thread resolution data is authoritative if the API response does not provide it.
- Do not post `Fixed.` with no substance when you can say what changed.
- Do not push changes before the user has confirmed the triage plan when there is ambiguity.
