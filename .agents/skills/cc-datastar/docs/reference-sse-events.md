# SSE Events Reference

Source: https://data-star.dev/reference/sse_events

Responses to backend actions with content type `text/event-stream` can contain zero or more Datastar SSE events.

The backend SDKs can handle the formatting of SSE events for you, or you can format them yourself.

## `datastar-patch-elements`

Patches one or more elements in the DOM. Datastar morphs elements by matching top-level elements based on their ID.

```
event: datastar-patch-elements
data: elements <div id="foo">Hello world!</div>

```

Be sure to place IDs on top-level elements to be morphed, as well as on elements within them that you'd like to preserve state on (event listeners, CSS transitions, etc.).

### Options

| Key | Description |
|-----|-------------|
| `data: selector #foo` | Selects the target element using CSS selector |
| `data: mode outer` | Morphs outer HTML (default, recommended) |
| `data: mode inner` | Morphs inner HTML |
| `data: mode replace` | Replaces outer HTML |
| `data: mode prepend` | Prepends elements to target's children |
| `data: mode append` | Appends elements to target's children |
| `data: mode before` | Inserts elements before target as siblings |
| `data: mode after` | Inserts elements after target as siblings |
| `data: mode remove` | Removes target elements from DOM |
| `data: namespace svg` | Patches using SVG namespace |
| `data: namespace mathml` | Patches using MathML namespace |
| `data: useViewTransition true` | Whether to use view transitions (defaults to false) |
| `data: elements` | The HTML elements to patch |

### Remove example

```
event: datastar-patch-elements
data: selector #foo
data: mode remove

```

### Multi-line elements

```
event: datastar-patch-elements
data: selector #foo
data: mode inner
data: useViewTransition true
data: elements <div>
data: elements        Hello world!
data: elements </div>

```

### SVG namespace

```
event: datastar-patch-elements
data: namespace svg
data: elements <circle id="circle" cx="100" r="50" cy="75"></circle>

```

## `datastar-patch-signals`

Patches signals into existing signals on the page. The `onlyIfMissing` line determines whether to update signals only if they don't exist. The `signals` line should be a valid `data-signals` attribute.

```
event: datastar-patch-signals
data: signals {foo: 1, bar: 2}

```

### Remove signals

```
event: datastar-patch-signals
data: signals {foo: null, bar: null}

```

### Only if missing

```
event: datastar-patch-signals
data: onlyIfMissing true
data: signals {foo: 1, bar: 2}

```
