# Reactive Signals

Source: https://data-star.dev/guide/reactive_signals

## Introduction

In a hypermedia approach, the backend drives state to the frontend and acts as the primary source of truth. The backend determines which actions users can take next by patching appropriate DOM elements.

Sometimes frontend state driven by user interactions is needed. Click, input and keydown events are some of the more common user events that you'll want your frontend to be able to react to.

Datastar uses **signals** to manage frontend state — reactive variables that automatically track and propagate changes in Datastar expressions. Signals are denoted using the `$` prefix.

## Data Attributes

### `data-bind`

Sets up two-way data binding on HTML elements that receive user input: `input`, `textarea`, `select`, `checkbox`, `radio`, and web components.

```html
<input data-bind:foo />
```
or
```html
<input data-bind="foo" />
```

Hyphenated names are automatically converted to camel case: `data-bind:foo-bar` creates a signal named `$fooBar`.

### `data-text`

Sets the text content of an element to a signal's value.

```html
<input data-bind:foo-bar />
<div data-text="$fooBar"></div>
```

With expressions:
```html
<input data-bind:foo-bar />
<div data-text="$fooBar.toUpperCase()"></div>
```

### `data-computed`

Creates a new read-only signal derived from a reactive expression. Its value automatically updates when any signals in the expression change.

```html
<input data-bind:foo-bar />
<div data-computed:repeated="$fooBar.repeat(2)" data-text="$repeated"></div>
```

### `data-show`

Shows or hides an element based on whether an expression evaluates to true or false.

```html
<input data-bind:foo-bar />
<button data-show="$fooBar != ''">Save</button>
```

To prevent a flash of unwanted content before Datastar processes the attribute:
```html
<button data-show="$fooBar != ''" style="display: none">Save</button>
```

### `data-class`

Adds or removes element classes based on an expression.

```html
<input data-bind:foo-bar />
<button data-class:success="$fooBar != ''">Save</button>
```

Multiple classes:
```html
<button data-class="{success: $fooBar != '', 'font-bold': $fooBar == 'strong'}">Save</button>
```

### `data-attr`

Binds any HTML attribute value to an expression.

```html
<input data-bind:foo />
<button data-attr:disabled="$foo == ''">Save</button>
```

Multiple attributes:
```html
<button data-attr="{disabled: $foo == '', 'aria-hidden': $foo}">Save</button>
```

### `data-signals`

Patches one or more signals into existing signals.

```html
<div data-signals:foo-bar="1"></div>
```

Nested signals:
```html
<div data-signals:form.baz="2"></div>
```

Multiple signals:
```html
<div data-signals="{fooBar: 1, form: {baz: 2}}"></div>
```

### `data-on`

Attaches event listeners and runs expressions when events are triggered.

```html
<input data-bind:foo />
<button data-on:click="$foo = ''">Reset</button>
```

Custom events:
```html
<div data-on:my-event="$foo = ''">
    <input data-bind:foo />
</div>
```

## Frontend Reactivity

```html
<div data-signals:hal="'...'">
    <button data-on:click="$hal = 'Affirmative, Dave. I read you.'">
        HAL, do you read me?
    </button>
    <div data-text="$hal"></div>
</div>
```

## Patching Signals from Backend

Frontend signals can be patched (added, updated, removed) from the backend using backend actions, similar to patching elements.

```html
<div data-signals:hal="'...'">
    <button data-on:click="@get('/endpoint')">
        HAL, do you read me?
    </button>
    <div data-text="$hal"></div>
</div>
```

If a response has `content-type: application/json`, signal values are patched into frontend signals using JSON Merge Patch (RFC 7396).

### SSE Event Format

```
event: datastar-patch-signals
data: signals {hal: 'Affirmative, Dave. I read you.'}
```

### Go SDK

```go
sse := datastar.NewSSE(w, r)
sse.PatchSignals([]byte(`{hal: 'Affirmative, Dave. I read you.'}`))
time.Sleep(1 * time.Second)
sse.PatchSignals([]byte(`{hal: '...'}`))
```
