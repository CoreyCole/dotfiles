# Vamos Pi metadata extension

Writes machine-local Pi/Vamos session metadata events to:

```text
~/.local/share/vamos/pi-sessions/events.jsonl
```

Pi auto-discovers this extension from `~/.pi/agent/extensions/vamos-pi-metadata/index.ts` via the dotfiles symlink:

```text
~/.pi -> ~/dotfiles/.pi-config
```

Events use schema version `1` and include Pi session lifecycle events. QRSPI result YAML is not parsed, validated, or emitted.

For a Hermes-launched worker (`VAMOS_PLAN_DIR`), when Pi becomes idle without the canonical Pi result file for Pi's own session ID, the extension submits one follow-up reminder to create its durable artifact and run `vamos hermes pi done`. This keeps the worker active long enough to yield to Hermes without restoring legacy QRSPI result validation.

The event log is append-only and consumed by Vamos terminal metadata indexing. It is local routing/projection metadata, not durable project state.
