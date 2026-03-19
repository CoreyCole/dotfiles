# Safe Editing Pattern

When modifying any Omarchy config:

### 1. Read Current Config

```bash
cat ~/.config/<app>/config
```

### 2. Backup Before Changes

```bash
cp ~/.config/<app>/config ~/.config/<app>/config.bak.$(date +%s)
```

### 3. Make Changes

Use the Edit tool. Preserve existing structure and comments.

### 4. Apply Changes

```bash
# For most apps, use the restart command
omarchy-restart-<app>

# Or reset to defaults (creates backup automatically)
omarchy-refresh-<app>
```

### 5. Explain What You Did

After completing changes, include a **Learn More** section to help the user understand what happened:

```
> **Learn More**
>
> [Explain what file(s) were modified or commands were run]
> [Explain why these changes achieve the user's goal]
> [Explain key config options that were set and what they control]
```

**Example:**

> **Learn More**
>
> Modified `~/.config/hypr/looknfeel.conf` to change window gaps.
> The `gaps_in` setting controls space between adjacent windows (set to 5px).
> The `gaps_out` setting controls space between windows and screen edges (set to 10px).
