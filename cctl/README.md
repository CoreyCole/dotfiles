# cctl

## `contrib` command

Contributions exported as CSV files from a GitHub repository's merged PRs, with optional direct-push commits.

### `c contrib export`

```bash
c contrib export \
  --owner <owner> \
  --repo <repo> \
  --start-date 2026-01-01 \
  --end-date 2026-01-31 \
  --github-username alice,bob \
  --github-token <token> \
  --output ./contributions.csv
```

Use `--include-bots` to include bot users.

`--include-direct-push` includes main-branch commits that are not associated with a merged PR. Those rows are kept in the CSV with empty PR fields (`pr_number`, `pr_title`, `pr_url`, etc.).

### Example without bots and with username filter

```bash
c contrib export \
  --owner coreycole \
  --repo cctl \
  --start-date 2026-01-01 \
  --end-date 2026-01-31 \
  --github-username alice \
  --github-username bob \
  --output /tmp/cctl-contrib.csv
```

### Token requirements

For private repositories, the token must include `repo` scope (or broader).
For public repositories, `public_repo` is sufficient.

The token can be provided via `--github-token` or through the `GITHUB_TOKEN` environment variable.
