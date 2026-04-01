# Actions Reference

Source: https://data-star.dev/reference/actions

Actions are helper functions for use in expressions. The `@` prefix designates secure actions that prevent arbitrary JavaScript execution through `Function()` constructors in a sandboxed environment.

## Core Actions

### `@peek(callable: () => any)`
Accesses signals without subscribing to changes.
```html
<div data-text="$foo + @peek(() => $bar)"></div>
```

### `@setAll(value: any, filter?: {include: RegExp, exclude?: RegExp})`
Sets matching signals to a specified value.
- Match single signal: `{include: /^foo$/}`
- Match pattern: `{include: /^user\./}`
- Exclude pattern: `{include: /.*/, exclude: /_temp$/}`

### `@toggleAll(filter?: {include: RegExp, exclude?: RegExp})`
Toggles boolean values of matching signals.

## Backend Actions

### HTTP Methods
- `@get(uri: string, options={})`
- `@post(uri: string, options={})`
- `@put(uri: string, options={})`
- `@patch(uri: string, options={})`
- `@delete(uri: string, options={})`

All send requests via Fetch API with zero or more SSE events in responses. Signals are sent as query parameters for GET requests, JSON body otherwise.

### Options

| Option | Description |
|--------|-------------|
| `contentType` | `'json'` (default) or `'form'` |
| `filterSignals` | Include/exclude patterns for signals |
| `selector` | Form selector for form submissions |
| `headers` | Custom request headers |
| `openWhenHidden` | Keep connection open in background tabs (default: false for GET, true for others) |
| `payload` | Override fetch payload |
| `retry` | `'auto'` (network errors), `'error'` (4xx/5xx), `'always'` (non-204), `'never'` |
| `retryInterval` | 1000ms default |
| `retryScaler` | Multiplier for wait times (default: 2) |
| `retryMaxWaitMs` | 30000ms maximum |
| `retryMaxCount` | 10 attempts maximum |
| `requestCancellation` | `'auto'`, `'cleanup'`, `'disabled'`, or AbortController |

### Request Cancellation
By default, new requests on an element cancel existing ones. Control with the `requestCancellation` option or custom AbortController instances.

### Response Handling

Automatically handles:
- `text/event-stream` — SSE responses
- `text/html` — DOM patching with headers: `datastar-selector`, `datastar-mode`, `datastar-use-view-transition`
- `application/json` — Signal patching with optional `datastar-only-if-missing` header
- `text/javascript` — Script execution with optional `datastar-script-attributes` header

### Events

Backend actions trigger `datastar-fetch` events: `started`, `finished`, `error`, `retrying`, `retries-failed`.

```html
<div data-on:datastar-fetch="
    evt.detail.type === 'error' && console.log('Fetch error encountered')
"></div>
```
