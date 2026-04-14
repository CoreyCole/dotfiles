# Datastar Expressions

Source: https://data-star.dev/guide/datastar_expressions

Datastar expressions are strings that are evaluated by `data-*` attributes. While they are similar to JavaScript, there are some important differences that make them more powerful for declarative hypermedia applications.

## Basics

```html
<div data-signals:foo="1">
    <div data-text="$foo"></div>
</div>
```

A variable `el` is available in every Datastar expression, representing the element that the attribute is attached to.

## JavaScript Integration

Datastar expressions support standard JavaScript operations including:
- Ternary operators (`?:`)
- Logical OR (`||`) and AND (`&&`)
- Property access (e.g., `$foo.length`)

## Multiple Statements

Multiple statements can be separated by semicolons:

```html
<button data-on:click="$landingGearRetracted = true; @post('/launch')">
    Force launch
</button>
```

Multi-line expressions require semicolons — line breaks alone are not sufficient to separate statements.

## Using JavaScript

Most of your JavaScript logic should go in `data-*` attributes, since reactive signals and actions only work in Datastar expressions.

### External Scripts

Functions should follow the principle of "props down, events up" — receiving input via arguments and returning results or dispatching custom events.

Asynchronous functions must dispatch custom events since Datastar will _not_ await them.

## Executing Scripts

Three approaches:

1. **Direct JavaScript Response** — When the backend returns `content-type: text/javascript`
2. **SSE Events** — Using `datastar-patch-elements` events containing script tags
3. **SDK Helpers** — The Go SDK's `ExecuteScript` function
