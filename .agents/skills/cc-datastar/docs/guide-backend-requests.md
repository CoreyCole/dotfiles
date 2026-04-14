# Backend Requests

Source: https://data-star.dev/guide/backend_requests

## Sending Signals

By default, all non-local signals are transmitted with backend requests. For GET requests, signals appear as a `datastar` query parameter; otherwise they're sent as JSON body data.

By sending **all** signals in every request, the backend has full access to the frontend state. While not recommended, partial signal transmission is possible using the `filterSignals` option.

### Nesting Signals

Signals support nested structures using:
- Dot-notation: `data-signals:foo.bar="1"`
- Object syntax: `data-signals="{foo: {bar: 1}}"`
- Two-way binding: `data-bind:foo.bar`

## Reading Signals

Backend SDKs provide helper functions to extract signals from requests. For GET requests, decode the `datastar` query parameter; for other methods, parse the JSON request body.

## SSE Events

Datastar streams Server-Sent Events from backend to browser without special plumbing. SDKs handle header configuration and event formatting.

Two primary functions:
- **PatchElements()**: Updates DOM elements by ID
- **PatchSignals()**: Modifies frontend signal state

Multiple events can be sent in a single response, enabling complex state updates.

### data-indicator Attribute

The `data-indicator` attribute sets a signal to `true` during request transmission and `false` otherwise, enabling loading indicators during network requests.

## Backend Actions

Datastar supports HTTP methods via dedicated actions: `@get()`, `@post()`, `@put()`, `@patch()`, and `@delete()`. This enables various backend operations triggered by user interactions.

One of the benefits of using SSE is that we can send multiple events (patch elements and patch signals) in a single response.
