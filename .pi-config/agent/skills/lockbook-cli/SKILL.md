---
name: lockbook-cli
description: Uses the Lockbook CLI to list, create, upload, download, edit, share, and synchronize Lockbook files. Use when asked to "upload to Lockbook", "copy into Lockbook", "share through Lockbook", "export from Lockbook", or work with the `clients/cli` command surface.
allowed-tools: Read, Bash
---

# Lockbook CLI

Use Lockbook's CLI commands to operate on the encrypted Lockbook file tree.

## Step 1: Select the CLI executable

Prefer an installed binary:

```bash
command -v lockbook
```

When working in the Lockbook source repository and no binary is installed, prefix commands with:

```bash
cargo run -p lockbook --
```

Call the selected form `lockbook` in the examples below. Run source commands from the repository root.

## Step 2: Inspect the destination

Confirm the account and destination before writing:

```bash
lockbook account status
lockbook list --paths /
lockbook list --paths /hermes-lockbook/
```

Create a missing destination folder:

```bash
lockbook new /hermes-lockbook/
lockbook sync
```

Do not export account credentials or use `lockbook account export`.

## Step 3: Upload files or directories

Import a local file or an entire local directory into an existing Lockbook folder:

```bash
lockbook copy <local-path> <lockbook-destination-folder>
lockbook sync
```

To upload a QRSPI plan directory while preserving the plan directory itself:

```bash
lockbook copy \
  thoughts/CoreyCole/plans/2026-07-30_23-03-21_lockbook-hermes-cli-relay \
  /hermes-lockbook/
lockbook sync
```

This creates `/hermes-lockbook/2026-07-30_23-03-21_lockbook-hermes-cli-relay/` and imports its descendants. Pass the plan directory—not `plan-dir/*`—so its name is preserved.

List the imported tree to verify it:

```bash
lockbook list --recursive --paths /hermes-lockbook/2026-07-30_23-03-21_lockbook-hermes-cli-relay/
```

Treat `copy` as an import operation, not an in-place mirror. Inspect the destination before repeating an upload; do not assume rerunning it updates an existing imported tree without conflicts or duplicates.

## Step 4: Use other file commands

| Task | Command |
|---|---|
| Create a file or folder | `lockbook new <lockbook-path>` |
| List a folder | `lockbook list --paths <lockbook-path>` |
| List recursively | `lockbook list --recursive --paths <lockbook-path>` |
| Print a document | `lockbook stream out <lockbook-path>` |
| Replace from stdin | `lockbook stream in <lockbook-path>` |
| Append from stdin | `lockbook stream in --append <lockbook-path>` |
| Export to disk | `lockbook export <lockbook-path> <local-directory>` |
| Move | `lockbook move <source> <destination-folder>` |
| Rename | `lockbook rename <target> <new-name>` |
| Delete | `lockbook delete <target>` |
| Share read-only | `lockbook share new --read-only <target> <username>` |
| Share writable | `lockbook share new <target> <username>` |
| Synchronize | `lockbook sync` |

Use `lockbook --help` or inspect `clients/cli/src/main.rs` when argument order is uncertain.

## Step 5: Validate completion

Require all of the following before reporting success:

1. `lockbook copy` exits successfully.
2. `lockbook sync` reports success.
3. Recursive listing shows the expected plan directory and artifacts.
4. No account private key, Hermes credential, or host-local configuration was uploaded.

Report the source path and resulting Lockbook path.
