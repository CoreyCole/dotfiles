# Getting Started

Source: https://data-star.dev/guide/getting_started

## Installation

### CDN

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/[email protected]/bundles/datastar.js"></script>
```

### Self-hosted

Download the script or create a custom bundle using the bundler, then include it from the appropriate path.

### Package Manager

```javascript
// @ts-expect-error (only required for TypeScript projects)
import 'https://cdn.jsdelivr.net/gh/starfederation/[email protected]/bundles/datastar.js'
```

## data-* Attributes

Data-* HTML attributes form the core of Datastar, enabling reactivity to your frontend and interaction with your backend in a declarative way.

Developer tools: VSCode extension and IntelliJ plugin provide autocompletion for available data-* attributes.

### data-on Attribute

The `data-on` attribute attaches event listeners and executes expressions.

```html
<button data-on:click="alert('I\'m sorry, Dave. I\'m afraid I can\'t do that.')">
    Open the pod bay doors, HAL.
</button>
```

## Patching Elements

The backend drives the frontend by patching (adding, updating and removing) HTML elements in the DOM. Morphing is the default strategy, ensuring only modified parts of the DOM are updated, and that only data attributes that have changed are reapplied.

### @get() Action

```html
<button data-on:click="@get('/endpoint')">
    Open the pod bay doors, HAL.
</button>
<div id="hal"></div>
```

Expected backend response:

```html
<div id="hal">
    I'm sorry, Dave. I'm afraid I can't do that.
</div>
```

Actions in Datastar are helper functions that have the syntax `@actionName()`.

### HTML Response Handling

When responses have a `content-type` of `text/html`, top-level HTML elements will be morphed into the existing DOM based on the element IDs.

This is called "Patch Elements" because multiple elements can be patched simultaneously.

## Server-Sent Events (SSE)

### Event Format

```
event: datastar-patch-elements
data: elements <div id="hal">
data: elements     I'm sorry, Dave. I'm afraid I can't do that.
data: elements </div>

```

SSE events must be followed by two newline characters.

### Streaming Example

```
event: datastar-patch-elements
data: elements <div id="hal">
data: elements     I'm sorry, Dave. I'm afraid I can't do that.
data: elements </div>

event: datastar-patch-elements
data: elements <div id="hal">
data: elements     Waiting for an order...
data: elements </div>

```

Because we can send as many events as we want in a stream, and because it can be a long-lived connection, we can extend the example above to first send HAL's response and then, after a few seconds, reset the text.

## SDK Code Examples

### Go

```go
import (
    "github.com/starfederation/datastar-go/datastar"
    time
)

sse := datastar.NewSSE(w,r)
sse.PatchElements(
    `<div id="hal">I'm sorry, Dave. I'm afraid I can't do that.</div>`
)
time.Sleep(1 * time.Second)
sse.PatchElements(
    `<div id="hal">Waiting for an order...</div>`
)
```

### Python

```python
from datastar_py import ServerSentEventGenerator as SSE
from datastar_py.sanic import datastar_response

@app.get('/open-the-bay-doors')
@datastar_response
async def open_doors(request):
    yield SSE.patch_elements('<div id="hal">I\'m sorry, Dave. I\'m afraid I can\'t do that.</div>')
    await asyncio.sleep(1)
    yield SSE.patch_elements('<div id="hal">Waiting for an order...</div>')
```

### TypeScript/JavaScript (Node.js)

```javascript
ServerSentEventGenerator.stream(req, res, (stream) => {
    stream.patchElements(`<div id="hal">I'm sorry, Dave. I'm afraid I can't do that.</div>`);

    setTimeout(() => {
        stream.patchElements(`<div id="hal">Waiting for an order...</div>`);
    }, 1000);
});
```

The Datastar Inspector can be used to monitor and inspect SSE events received by Datastar.
