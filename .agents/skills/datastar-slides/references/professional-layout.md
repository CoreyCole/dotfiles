# Professional slide layout standard

Use this when turning a document into a Datastar slide deck for Jim.

## Control the canvas

- Use a centered presentation canvas with a deliberate maximum width, such as `width: min(100%, 1500px)`, rather than an unrestricted full-browser layout.
- Do not use a narrow content column for every slide. Select a presentation-scale canvas and responsive outer margins.
- Keep text measures readable, but do not solve readability by applying one small `max-width` to all slide content.

## Cards and diagrams

- Give comparison cards, flow boxes, and other visual units deliberate fixed or bounded widths.
- Use centered flex or grid groups for diagrams. A flow chart should occupy only the width its boxes and arrows need.
- Do not use `1fr` flow-box columns when it stretches small labels across the entire slide.
- Use generous, consistent height and padding so cards look like presentation elements rather than web panels.

## Review questions

Before publishing, inspect each slide for:

1. A controlled presentation canvas, not a full-width web page.
2. Clear visual groups with stable card dimensions.
3. Flow-chart boxes snug around their content.
4. A single main message per slide, with supporting detail subordinate to it.
