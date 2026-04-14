# Security Reference

Source: https://data-star.dev/reference/security

## Escape User Input

Never trust user input. This is critical when using Datastar expressions since they execute arbitrary JavaScript. Always escape user input to prevent Cross-Site Scripting (XSS) attacks.

## Avoid Sensitive Data

Signal values display in source code as plain text and users can modify them before sending requests. Never expose sensitive information in signals and always validate data on the backend.

## Ignore Unsafe Input

When escaping unsafe user input isn't feasible, use the `data-ignore` attribute to prevent Datastar from processing an element and its descendants.

## Content Security Policy

When implementing a Content Security Policy (CSP), the `script-src` directive must allow `'unsafe-eval'` because Datastar uses a `Function()` constructor to evaluate expressions.

```html
<meta http-equiv="Content-Security-Policy"
    content="script-src 'self' 'unsafe-eval';"
>
```
