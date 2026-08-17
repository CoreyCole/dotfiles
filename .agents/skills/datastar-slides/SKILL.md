---
name: datastar-slides
description: Create or fix static HTML slide decks powered by Datastar signals. Use when asked to make "datastar slides", "HTML slide deck", "slide deck with Datastar buttons", "arrow-key slides", or fix broken Datastar slide navigation. Covers v1 colon attribute syntax, local UI signals, keyboard handlers, dot indicators, and compact slide layout.
layout_reference: references/professional-layout.md
---

Build static HTML slide decks that use Datastar only for local UI interaction: current slide, next/prev buttons, keyboard navigation, and active dot indicators.

## Step 1: Use Datastar v1 syntax

Use Datastar v1 colon-qualified attributes. Do not use old hyphen event/attribute syntax.

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.2/bundles/datastar.js"></script>

<html lang="en" data-signals="{slide: 0, total: 3}">
<body data-on:keydown__window="evt.key === 'ArrowRight' ? $slide = Math.min($total - 1, $slide + 1) : evt.key === 'ArrowLeft' ? $slide = Math.max(0, $slide - 1) : null">
  <button data-on:click="$slide = Math.max(0, $slide - 1)"
          data-attr:disabled="$slide === 0 ? true : false">Prev</button>
</body>
</html>
```

Correct forms:

| Need | Use | Do not use |
|---|---|---|
| Click handler | `data-on:click` | `data-on-click` |
| Keydown handler | `data-on:keydown__window` | `data-on-keydown__window` |
| Disabled attribute | `data-attr:disabled` | `data-attr-disabled` |
| Active class | `data-class:active` | manual JS class toggles |
| Visibility | `data-show` | manual JS display toggles |

## Step 2: Keep slide state small and local

Use signals only for UI interaction, normally:

```html
data-signals="{slide: 0, total: 5}"
```

Rules:

- `slide` is zero-based.
- `total` is the number of slides, not the last index.
- Next button uses `Math.min($total - 1, $slide + 1)`.
- Previous button uses `Math.max(0, $slide - 1)`.
- Each slide uses `data-show="$slide === N"`.
- If slide count changes, update both `total` and dot buttons.

## Step 3: Use this minimal deck skeleton

```html
<!doctype html>
<html lang="en" data-signals="{slide: 0, total: 3}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.2/bundles/datastar.js"></script>
  <style>
    .slide { min-height: 70vh; display: grid; align-content: center; }
    .dot.active { background: currentColor; }
  </style>
</head>
<body data-on:keydown__window="evt.key === 'ArrowRight' ? $slide = Math.min($total - 1, $slide + 1) : evt.key === 'ArrowLeft' ? $slide = Math.max(0, $slide - 1) : null">
  <main>
    <section class="slide" data-show="$slide === 0">...</section>
    <section class="slide" data-show="$slide === 1">...</section>
    <section class="slide" data-show="$slide === 2">...</section>

    <nav aria-label="Slide controls">
      <button data-on:click="$slide = Math.max(0, $slide - 1)"
              data-attr:disabled="$slide === 0 ? true : false">← Prev</button>

      <button class="dot" data-class:active="$slide === 0" data-on:click="$slide = 0" title="Slide 1"></button>
      <button class="dot" data-class:active="$slide === 1" data-on:click="$slide = 1" title="Slide 2"></button>
      <button class="dot" data-class:active="$slide === 2" data-on:click="$slide = 2" title="Slide 3"></button>

      <button data-on:click="$slide = Math.min($total - 1, $slide + 1)"
              data-attr:disabled="$slide === $total - 1 ? true : false">Next →</button>
    </nav>
  </main>
</body>
</html>
```

## Step 4: Establish the narrative before layout

When a deck presents an existing report, design, or plan, treat that source as the content contract. Do not invent a simplified problem statement from code or from a title.

Before editing the deck:

1. Read the source document.
1. Map each proposed slide to a source section.
1. Ask the user one slide at a time when the message, audience, or claim is unclear.
1. Keep the same problem, benefit, scope, and exclusions as the source document.
1. Remove a slide when it repeats or flattens the source story. Do not add a generic feature slide only because it looks balanced.

For a non-technical deck, separate these facts on the relevant slides:

- the prior user or Product problem;
- the new design benefit;
- the exact claim that is safe for the current scope;
- the detailed source for complete coverage, such as a CSV.

Do not collapse distinct fields into one visual row when the source contract lists them separately. Preserve priority order where the source establishes one.

When the design uses server-rendered content with a thin client, state the boundary exactly: the backend renders action-specific summary and detail content; the frontend provides the container. New event types must not imply frontend changes unless the product explicitly requires them. If backend rendering supports per-event overrides, mention that capability without implying a matching frontend implementation.

## Step 4: Align the deck to its source narrative before writing

When a deck presents an existing report, roadmap, or Markdown document, read that source first. Map every slide to a section of the source before editing HTML.

- Do not replace milestone structure with broad product-area groups when the source tells a milestone story.
- Keep the source's exact distinctions. For example, do not merge metadata fields or collapse separate problems into one vague claim.
- Put only high-level coverage in slides. Link to the CSV or inventory for every action when the source uses it as the complete record.
- If the user asks to grill the deck, review one slide at a time. Ask what claim it makes, what source section proves it, and what detail must stay visible. Do not revise the deck until the slide-by-slide decisions are clear.

## Step 5: Format content for presentation

Prefer slide content that is readable at presentation distance:

- One clear title per slide.
- 3-5 bullets max unless using a timeline/table layout.
- Use compact font classes for long titles.
- For title slides, keep the title on one line and format subtitle as a list when it has multiple items.
- For timelines, prefer rows/columns with dates visually separated from event text.
- Do not add visible helper text like “Use arrow keys”; arrow-key support should be silent unless explicitly requested.

### Presentation geometry

Use a centered presentation canvas with a generous but bounded width. Do not let every slide element stretch across the full browser viewport.

- Use a slide canvas such as `width: min(100%, 1500px); margin: 0 auto;` for a wide deck.
- Use fixed or bounded widths for comparison cards, flow-chart boxes, and other repeated visual units.
- Keep diagram boxes snug around their content. Center the whole diagram group instead of making each box a `1fr` column.
- Do not remove all `max-width` limits after feedback that a deck is too narrow. Increase the canvas width and preserve deliberate, professional geometry.
- Give the frontend/backend flow a final frontend box. A diagram must show every step named in the source.

Useful CSS patterns:

```css
.title-slide h1 { font-size: clamp(40px, 7vw, 76px); white-space: nowrap; }
.compact-slide h2 { font-size: clamp(28px, 3.5vw, 44px); }
.compact-slide li { font-size: clamp(22px, 2.5vw, 34px); }
.timeline .date { display: block; color: var(--accent); font-weight: 850; }
.timeline .title { display: block; }
```

### Professional layout discipline

Do not make every slide component stretch across the full browser width. Use a centered presentation canvas with a generous controlled maximum width, then give diagrams and comparison cards deliberate fixed or bounded widths. For example, a flow diagram should use fixed-width boxes centered as a group; arrows should stay narrow; boxes should not expand merely because the viewport is wide.

When converting an approved Markdown narrative into slides, grill the story slide by slide before editing. For each slide, map it to its exact source section, state its single message, and identify facts that must not be compressed. Keep the complete project/milestone structure when the document uses it; do not flatten it into a few broad product groups just to reduce slide count.

## Step 6: Debug broken navigation

Check these first:

1. CDN loads and uses v1.0.2 or compatible v1 build.
1. Attributes use colon syntax: `data-on:click`, `data-attr:disabled`, `data-class:active`.
1. Root element has `data-signals` with `slide` and `total`.
1. `total` matches the actual slide count.
1. Dot count matches slide count.
1. Keyboard handler is attached with `data-on:keydown__window`.
1. Active dot has `data-class:active="$slide === N"` plus CSS for `.active`.

Use `rg "data-on-|data-attr-" file.html` to find old broken syntax.

## Step 7: Verify before done

After editing:

- Run `rg "data-on-|data-attr-" <deck>.html`; it should return no old event/attribute syntax.
- Run `rg "data-on:|data-attr:|data-class:" <deck>.html` and inspect expected handlers.
- Open the deck in a browser when possible.
- Confirm buttons, arrow keys, disabled states, and active dot indicator work.
