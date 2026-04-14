---
name: cc-datastar
description: Use when building or modifying Datastar-powered UI — SSE streams, templ components, form handlers, signals, morph patterns, loading indicators. Enforces the Tao of Datastar (backend is source of truth, CQRS, fat morph, signals sparingly). Use for any work touching .templ files, SSE handlers, or Datastar attributes.
references:
  - docs/guide-getting-started.md
  - docs/guide-reactive-signals.md
  - docs/guide-datastar-expressions.md
  - docs/guide-backend-requests.md
  - docs/guide-tao-of-datastar.md
  - docs/reference-attributes.md
  - docs/reference-actions.md
  - docs/reference-rocket.md
  - docs/reference-sse-events.md
  - docs/reference-security.md
---

# The Tao of Datastar

Source: https://data-star.dev/guide/the_tao_of_datastar

**Before writing any Datastar code, internalize these principles.** The Tao is not optional guidance — it is the correct way to use Datastar. Violating these principles produces code that fights the framework and creates maintenance debt. If your approach conflicts with the Tao, your approach is wrong.

## The Principles

### Backend Is Source of Truth

All application state lives in the backend. The frontend renders what the backend sends. Period.

**Never do this:**

- Cache application state in signals
- Derive computed values on the frontend that the backend should own
- Assume frontend state is current without fetching from the backend
- Store anything in signals that needs to survive a page refresh

**Always do this:**

- Store state in your DB/session
- Push state to the frontend via SSE `PatchElementTempl` or `PatchSignals`
- Re-query the backend on every state change notification

### Use Signals Sparingly

Signals are **only** for two things:

1. UI interactions — toggling element visibility (`$showMenu`, `$showDetails`)
1. Binding form inputs to send new state to the backend

**If you need more than a handful of boolean toggles, you are fighting the framework.** Move the logic to the backend.

Signals beginning with underscores (`_`) are excluded from backend requests by default — use these for purely local UI state like `$_loading`.

### In Morph We Trust

Send the **full component** from the backend. Datastar morphs the DOM, updating only what changed while preserving signal state, focus, and scroll position. This is called "fat morph."

**Never do this:**

- Try to patch individual elements or manage fine-grained DOM updates
- Use `ExecuteScript` to update content (use it only for redirects, scroll-to-bottom, or similar one-shot browser actions)
- Build custom frontend JavaScript to handle streaming content

**Always do this:**

- Re-render the full component server-side and send via `PatchElementTempl`
- Put a stable `id` on every element you morph
- Use `data-ignore-morph` on elements that should not be touched (textareas with in-progress edits)
- For high-frequency updates (streaming tokens), accumulate on the backend and morph periodically (~10Hz) — Brotli compression makes this efficient (200:1 ratios common)

### CQRS: One Stream for Reads, Short POSTs for Writes

Every page opens a single long-lived SSE stream via `data-init="@get('/stream')"`. All state updates flow through this stream as fat morphs. Write operations use short-lived `@post` requests. The stream re-renders after each write.

```html
<div id="main" data-init="@get('/page/stream')">
    <button data-on-click="@post('/page/action')">Do something</button>
</div>
```

### No Optimistic Updates

Never update the UI as if an operation succeeded before the backend confirms it. Show a loading indicator, wait for the backend, let the SSE morph deliver the confirmed state. Optimistic updates deceive the user.

### Page Navigation via Anchor Tags

Use `<a>` tags for navigation. Let the browser manage history. Never manage browser history yourself. Each page is a resource with its own URL.

```html
<!-- Filter tabs — separate URLs, not signals -->
<a href="/pipelines">All</a>
<a href="/pipelines?type=qrspi">QRSPI</a>
```

### Compress SSE Streams

Use Brotli compression on SSE responses. Fat morph sends large DOM chunks — compression ratios of 200:1 are common.

### Escape User Input

Never trust user input in Datastar expressions — they execute JavaScript. Always escape to prevent XSS. When escaping isn't feasible, use `data-ignore` to prevent Datastar from processing the element.

## Common Mistakes (Do Not Do These)

1. **Using signals for application state** — Signals are UI toggles only. Track data in the backend, morph it down.
1. **Fine-grained element patching** — Don't update individual elements. Send the full component. Trust the morph.
1. **Missing `id` on patched elements** — Every `PatchElementTempl` target must have a stable `id`.
1. **Missing parent `<form>` for `contentType: 'form'`** — Silent failure. `@post` with `contentType: 'form'` **requires** a parent `<form>` element or Datastar throws `FetchClosestFormNotFound`.
1. **Using signals for form inputs** — Use `name` attributes on `<input>`, `<select>`, `<textarea>`. Not signals.
1. **Optimistic updates** — Never update UI before backend confirms. Loading indicators only.
1. **`ExecuteScript` for streaming or data updates** — Use periodic morph instead. `ExecuteScript` is for redirects and scroll-to-bottom only.
1. **Forgetting `data-ignore-morph` on active textareas** — SSE morphs clobber in-progress text.
1. **Managing browser history** — Use `<a>` tags. Let the browser handle it.
1. **Overcomplicating with signals** — More than a few boolean toggles means you're doing it wrong.

______________________________________________________________________

## Patterns (How to Do It Right)

### CQRS Stream Handler

```go
func (s *Service) HandleStream(c echo.Context) error {
    sse := datastar.NewSSE(c.Response().Writer, c.Request())
    ch := s.notifier.Subscribe(id)
    defer s.notifier.Unsubscribe(id, ch)

    // Initial render — full component
    data := s.LoadData(c.Request().Context())
    sse.PatchElementTempl(MyComponent(data))

    for {
        select {
        case <-ch:
            // State changed — re-query, re-render full component
            data = s.LoadData(c.Request().Context())
            sse.PatchElementTempl(MyComponent(data))
        case <-c.Request().Context().Done():
            return nil
        }
    }
}
```

### Streaming Content (High-Frequency Updates)

Accumulate events into a buffer on the backend, periodically morph at ~10Hz. No `ExecuteScript`, no custom frontend JS.

```go
var buf streamBuffer
ticker := time.NewTicker(100 * time.Millisecond)
defer ticker.Stop()

for {
    select {
    case event := <-eventCh:
        buf.Apply(event)
    case <-ticker.C:
        if buf.Dirty() {
            sse.PatchElementTempl(streamView(&buf))
            buf.MarkClean()
        }
    case <-c.Request().Context().Done():
        return nil
    }
}
```

### Forms

Always HTML forms with `name` attributes and `contentType: 'form'`. Never signals for form values.

```templ
templ MyForm() {
    <form id="my-form">
        <input type="text" name="title" placeholder="Title"/>
        <select name="type">
            <option value="a">Option A</option>
        </select>
        <textarea name="description" data-ignore-morph placeholder="Description"/>
        <button data-on-click="el.classList.add('loading'); @post('/submit', {contentType: 'form'})">
            Submit
            <span>Submitting...</span>
        </button>
    </form>
}
```

### Loading Indicators (CQRS Mode)

Manually add loading class on click. The SSE morph removes it (server-rendered state doesn't include the class):

```html
<button data-on-click="el.classList.add('loading'); @post('/action', {contentType: 'form'})">
    Do something
    <span>Working...</span>
</button>
```

### Loading Indicators (Non-CQRS)

```html
<button data-indicator="_loading" data-on-click="@post('/action')">
    Do something
    <span data-show="$_loading">Loading...</span>
</button>
```

### Accessibility

```html
<button data-on-click="$menuOpen = !$menuOpen"
        data-attr-aria-expanded="$menuOpen ? 'true' : 'false'">
    Toggle Menu
</button>
<div data-show="$menuOpen" data-attr-aria-hidden="$menuOpen ? 'false' : 'true'">
    Menu content
</div>
```

______________________________________________________________________

## Quick Reference

### Attributes

- `data-signals` — Initialize signals (JSON object)
- `data-bind` — Two-way bind form input to signal
- `data-on-[event]` — Event handler (`data-on-click`, `data-on-change`, `data-on-submit`)
- `data-text` — Set text content from expression
- `data-show` — Show/hide element from expression
- `data-class` — Add/remove CSS classes from expression
- `data-attr-[name]` — Set HTML attribute from expression
- `data-indicator` — Signal set to true during fetch requests
- `data-init` — Run action on initialization (used for CQRS stream)
- `data-ignore-morph` — Exclude element from morphing
- `data-ignore` — Prevent Datastar processing entirely

### Actions

- `@get('/url')` — Long-lived SSE stream (reads)
- `@post('/url')` — Short-lived request (writes)
- `@post('/url', {contentType: 'form'})` — POST form data from parent `<form>`
- `@put`, `@patch`, `@delete` — Other HTTP methods
- `@setAll(value, filter?)` — Set matching signals
- `@toggleAll(filter?)` — Toggle matching boolean signals

### Go SDK

```go
sse := datastar.NewSSE(c.Response().Writer, c.Request())
sse.PatchElementTempl(MyComponent())                         // morph by ID (preferred)
sse.PatchSignals(map[string]interface{}{"loading": false})   // patch signal values
sse.ExecuteScript("window.location.href = '/new-page'")      // rare — redirects only
```

### SSE Event Format

```
event: datastar-patch-elements
data: elements <div id="foo">Hello world!</div>

event: datastar-patch-signals
data: signals {foo: 1, bar: 2}
```

For full attribute reference, action options, and SSE event details, see the `docs/` reference files.
