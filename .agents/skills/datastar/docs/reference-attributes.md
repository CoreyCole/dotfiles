# Attributes Reference

Source: https://data-star.dev/reference/attributes

## Core Attributes

### `data-attr`
Sets HTML attribute values to expressions.
```html
<div data-attr:aria-label="$foo"></div>
<div data-attr="{'aria-label': $foo, disabled: $bar}"></div>
```

### `data-bind`
Two-way data binding between signals and form elements (input, select, textarea, web components).
```html
<input data-bind:foo />
<input data-bind="foo" />
```
Features: automatic signal creation, type preservation, file upload (base64), array support for checkboxes.
Casing modifiers: `__case.camel`, `__case.kebab`, `__case.snake`, `__case.pascal`

### `data-class`
Conditionally adds or removes CSS classes.
```html
<div data-class:font-bold="$foo == 'strong'"></div>
<div data-class="{success: $foo != '', 'font-bold': $foo == 'strong'}"></div>
```

### `data-computed`
Read-only signals computed from other signal expressions.
```html
<div data-computed:foo="$bar + $baz"></div>
```

### `data-effect`
Executes expressions on page load and whenever dependent signals change.
```html
<div data-effect="$foo = $bar + $baz"></div>
```

### `data-ignore`
Prevents Datastar processing on an element and its descendants.
```html
<div data-ignore>Datastar will not process this element.</div>
```
Modifier: `__self` — only ignores the element itself, not descendants.

### `data-ignore-morph`
Skips DOM morphing for an element and its children.
```html
<div data-ignore-morph>This element will not be morphed.</div>
```

### `data-indicator`
Creates a signal set to `true` while fetch requests are in flight.
```html
<button data-on:click="@get('/endpoint')"
        data-indicator:fetching
        data-attr:disabled="$fetching">
</button>
```

### `data-init`
Runs expressions when attributes are initialized (page load, DOM patches, attribute modifications).
```html
<div data-init="$count = 1"></div>
```
Modifiers: `__delay.500ms`, `__delay.1s`, `__viewtransition`

### `data-json-signals`
Displays reactive JSON-stringified signals for debugging.
```html
<pre data-json-signals></pre>
<pre data-json-signals="{include: /user/}"></pre>
```

### `data-on`
Attaches event listeners executing expressions when events trigger.
```html
<button data-on:click="$foo = ''">Reset</button>
<div data-on:my-event="$foo = evt.detail"></div>
```

Modifiers:
- `__once` — single execution
- `__passive` — prevents `preventDefault`
- `__capture` — capture phase
- `__delay.500ms`, `__delay.1s`
- `__debounce.500ms.leading`, `__debounce.1s.notrailing`
- `__throttle.500ms.noleading`, `__throttle.1s.trailing`
- `__viewtransition`
- `__window` — attaches to window
- `__outside` — triggers outside element
- `__prevent` — calls `preventDefault`
- `__stop` — calls `stopPropagation`

### `data-on-intersect`
Runs expressions when elements intersect the viewport.
```html
<div data-on-intersect="$intersected = true"></div>
```
Modifiers: `__once`, `__exit`, `__half`, `__full`, `__threshold.25`

### `data-on-interval`
Executes expressions at regular intervals (default: 1 second).
```html
<div data-on-interval="$count++"></div>
```
Modifiers: `__duration.500ms`, `__duration.1s`, `__leading`

### `data-on-signal-patch`
Runs expressions whenever any signals change.
```html
<div data-on-signal-patch="console.log('A signal changed!')"></div>
```

### `data-preserve-attr`
Preserves attribute values during DOM morphing.
```html
<details open data-preserve-attr="open">
    <summary>Title</summary>
    Content
</details>
```

### `data-ref`
Creates signals as references to DOM elements.
```html
<div data-ref:foo></div>
```

### `data-show`
Shows or hides elements based on boolean expressions.
```html
<div data-show="$foo"></div>
```

### `data-signals`
Patches signals into the existing signal store.
```html
<div data-signals:foo="1"></div>
<div data-signals="{foo: {bar: 1, baz: 2}}"></div>
<div data-signals="{foo: null}"></div>
```
Signals beginning with underscores excluded from backend requests by default.
Signal names cannot contain double underscores (`__`).
Modifiers: `__ifmissing`

### `data-style`
Sets inline CSS properties reactively.
```html
<div data-style:display="$hiding && 'none'"></div>
<div data-style:background-color="$red ? 'red' : 'blue'"></div>
```

### `data-text`
Binds element text content to expressions.
```html
<div data-text="$foo"></div>
```

## Processing Rules

### Attribute Evaluation Order
Attributes evaluated depth-first through the DOM in order they appear. Create indicator signals before initiating fetch requests:
```html
<div data-indicator:fetching data-init="@get('/endpoint')"></div>
```

### Attribute Casing
Data attributes follow HTML case-insensitivity. Hyphenated names convert to camel case for signals:
- Signal-defining attributes (`data-bind:my-signal`) -> `$mySignal`
- Non-signal attributes (`data-class:text-blue-700`) -> `text-blue-700` (kebab case)

### Aliasing
Custom aliases available through bundler. Datastar maintains `data-star-*` aliased version:
```html
<script type="module"
        src="https://cdn.jsdelivr.net/gh/starfederation/[email protected]/bundles/datastar-aliased.js">
</script>
```

## Pro Attributes

Pro attributes extend core Datastar with advanced functionality. Available with Datastar Pro license.

### `data-animate`
Enables animation of element attributes over time. Animated attributes are updated reactively whenever signals used in the expression change.

### `data-custom-validity`
Adds custom validation messaging to form elements using expressions. Empty string = valid, non-empty = invalid with custom error message.
```html
<form>
    <input data-bind:foo name="foo" />
    <input data-bind:bar name="bar"
           data-custom-validity="$foo === $bar ? '' : 'Values must be the same.'" />
    <button>Submit form</button>
</form>
```

### `data-match-media`
Sets a signal to whether a media query matches and keeps it in sync.
```html
<div data-match-media:is-dark="'prefers-color-scheme: dark'"
     data-computed:theme="$isDark ? 'dark' : 'light'"></div>
```

### `data-on-raf`
Runs an expression on every `requestAnimationFrame` event.
```html
<div data-on-raf="$count++"></div>
```
Modifiers: `__throttle.500ms`, `__throttle.1s`, `__throttle.noleading`, `__throttle.trailing`

### `data-on-resize`
Runs an expression whenever an element's dimensions change.
```html
<div data-on-resize="$count++"></div>
```
Modifiers: `__debounce.500ms`, `__debounce.1s`, `__debounce.leading`, `__debounce.notrailing`, `__throttle.500ms`, `__throttle.1s`

### `data-persist`
Persists signals in local storage between page loads.
```html
<div data-persist></div>
<div data-persist="{include: /foo/, exclude: /bar/}"></div>
<div data-persist:mykey></div>
```
Modifiers: `__session` — use session storage instead of local storage

### `data-query-string`
Syncs query string params to signal values on page load, and signal values to query string params on change.
```html
<div data-query-string></div>
<div data-query-string="{include: /foo/, exclude: /bar/}"></div>
```
Modifiers: `__filter` (omit empty values), `__history` (adds history entries on change)

### `data-replace-url`
Replaces the URL in the browser without reloading the page.
```html
<div data-replace-url="`/page${page}`"></div>
```

### `data-rocket`
Creates a Rocket web component. See `reference-rocket.md` for details.

### `data-scroll-into-view`
Scrolls the element into view. Useful after backend DOM updates.
```html
<div data-scroll-into-view></div>
```
Modifiers: `__smooth`, `__instant`, `__auto`, `__hstart`, `__hcenter`, `__hend`, `__hnearest`, `__vstart`, `__vcenter`, `__vend`, `__vnearest`, `__focus`

### `data-view-transition`
Sets the `view-transition-name` style attribute explicitly.
```html
<div data-view-transition="$foo"></div>
```

## Expressions

Expressions support standard JavaScript including operators, function calls, ternary expressions, and literals. An `el` variable references the current element:
```html
<div id="bar" data-text="$foo + el.id"></div>
```
