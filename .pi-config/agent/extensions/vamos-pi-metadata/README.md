# Vamos Pi metadata extension

Writes machine-local Pi/Vamos session metadata events to:

```text
~/.local/share/vamos/pi-sessions/events.jsonl
```

Pi auto-discovers this extension from `~/.pi/agent/extensions/vamos-pi-metadata/index.ts` via the dotfiles symlink:

```text
~/.pi -> ~/dotfiles/.pi-config
```

Events use schema version `1` and include session lifecycle events plus a normalized `qrspi_result` event when the final assistant message contains a fenced QRSPI YAML result.

The event log is append-only and consumed by Vamos terminal metadata indexing. It is local routing/projection metadata, not durable project state.
