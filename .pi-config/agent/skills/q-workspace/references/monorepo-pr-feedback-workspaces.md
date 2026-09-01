# Monorepo PR-feedback workspace pattern

When preparing to address monorepo stack feedback, keep the canonical morning-sync checkout on `develop`.

Pattern used successfully:

1. Verify canonical checkout:
   - path: `/Users/swarm/cn/chestnut-flake/monorepo-swarm`
   - branch: `develop`
   - clean status
2. Create a copied sibling workspace, e.g. `/Users/swarm/cn/chestnut-flake/monorepo-<slug>-pr-feedback`.
   - A copy made from current trunk can contain local ignored directories such as `.cn/` or `.ranger/`. After `gt get` checks out an older branch, that branch may not yet ignore them, so they can become untracked and block `gt restack`.
   - Move only those known copied local-only directories to a temporary sibling backup before restacking. Do not use broad `git clean` or delete unknown files. After rebasing, restore only directories the rebased branch now ignores (`git check-ignore -v <path>`); otherwise keep the implementation workspace clean and remove only the temporary copy you created.
3. In the copy, run `gt get --no-interactive <stack-top-branch>` to recover the submitted stack tip.
4. For a rebase request, unfreeze the teammate branch when needed, use `gt restack`, and resolve each old commit against current `develop` history. Prefer evolved trunk behavior when the old change has since landed independently; regenerate generated conflicts from source.
5. Run focused tests plus clean-status, diff-check, conflict-marker, ancestry, and canonical-checkout safety checks.
6. Fold compatibility edits into their owning commits with `gt absorb` where safe; use `gt modify` only for deliberate unabsorbable compatibility hunks.
7. Submit with `gt submit --no-edit --no-interactive`, then read back the PR head SHA and mergeability. A local-only rebase is not completion when the human asked to rebase the PR.
8. For ordinary feedback edits, use `gt modify --into <comment-pr-branch>` when targeting a downstack PR, then `gt submit --no-edit --no-interactive` and read back the PR.
5. Before finishing, verify `monorepo-swarm` is still clean on `develop`.
6. Name any copied workspace or temporary support directory under `~/cn/chestnut-flake` with a non-dot `monorepo-*` prefix. The flake ignores `monorepo*/`; a name such as `.monorepo-*` bypasses that rule and pollutes the flake checkout.

Why: `monorepo-swarm` is used by morning sync automation; leaving it on a feature/review branch breaks that workflow. Non-dot `monorepo-*` names also keep copied workspace state and local logs out of chestnut-flake git status.