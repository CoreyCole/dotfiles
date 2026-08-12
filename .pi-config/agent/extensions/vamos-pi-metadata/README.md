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

The event log is append-only and consumed by Vamos terminal metadata indexing. It is local routing/projection metadata, not durable project state.
