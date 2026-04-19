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

## `youtube` command

### `c youtube plan-layout`

Generate a deterministic dry-run migration plan for the YouTube notes library.

```bash
c youtube plan-layout --root ~/.hermes/notes/videos --format text
```

Optional flags:
- `--root` (default `~/.hermes/notes/videos`)
- `--format` (`json` or `text`, default `json`)

What it does right now:
- scans flat per-video note directories under the root
- parses `notes.md` frontmatter plus `video-metadata.json` / `metadata.json` when present
- resolves channel identity in this order: `channel_id` -> `uploader_id` -> URL -> normalized display name
- proposes canonical target paths under `channels/<channel-dir>/<year>/<date>_<slug>--<video_id>`
- builds in-memory channel and video registries
- emits a manual-review bucket instead of guessing when required metadata is missing

Current scope: dry-run planning only. It does not move files or write registries yet.
