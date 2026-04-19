# cctl

## `contrib` command

Contributions are exported as CSV rows from a local repository checkout and branch history.

### `c contrib export`

```bash
c contrib export --start-date 2026-01-01 --end-date 2026-01-31
```

Optional flags:
- `--repo-dir` (default `.`)
- `--branch` (default `main`)
- `--output` (default `contributions.csv`)

Example with explicit repo and branch:

```bash
c contrib export \
  --start-date 2026-01-01 \
  --end-date 2026-01-31 \
  --repo-dir /path/to/repo \
  --branch main \
  --output /tmp/contrib.csv
```

`pr_number` is derived from the commit message when it matches supported PR patterns.
`commit_url` and `pr_url` are populated only when `origin` normalizes to a GitHub HTTPS URL. For non-GitHub remotes, those columns are left blank.
