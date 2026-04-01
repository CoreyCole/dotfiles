# Rocket Reference

Source: https://data-star.dev/reference/rocket

**Status: Alpha — available in the Datastar Pro repo.**

Rocket is a Datastar Pro plugin that bridges Web Components with Datastar's reactive system. It allows you to create encapsulated, reusable components with reactive data binding.

> Rocket is a powerful feature, and should be used sparingly. For most applications, standard Datastar templates and global signals are sufficient. Reserve Rocket for cases where component encapsulation is essential, such as integrating third-party libraries or creating complex, reusable UI elements.

## Basic Example

```html
<template data-rocket:simple-counter
          data-prop:count="int (min 0)"
          data-prop:start="int (min 0)"
          data-prop:step="int (clamp 1 10) (= 1)"
>
  <script>
    $$count = $$start
  </script>
  <button data-on:click="$$count -= $$step">-</button>
  <span data-text="$$count"></span>
  <button data-on:click="$$count += $$step">+</button>
  <button data-on:click="$$count = $$start">Reset</button>
</template>
```

## Signal Scoping

- `$$` for component-scoped signals (isolated per instance)
- `$` for global signals (shared across the page)

Component signals are automatically cleaned up when the component is removed from the DOM.

Behind the scenes, `$$count` becomes something like `$._rocket.my_counter.id1.count`.

## Defining Components

```html
<template data-rocket:my-counter>
  <script>
    $$count = 0
  </script>
  <button data-on:click="$$count++">
    Count: <span data-text="$$count"></span>
  </button>
</template>

<!-- Usage -->
<my-counter></my-counter>
```

Components must be defined before being used in the DOM.

## Props

```html
<template data-rocket:progress-bar
          data-prop:value="int"
          data-prop:max="int (= 100)"
          data-prop:color="str (= 'blue')"
>
  <script>
    $$percentage = computed(() => Math.round(($$value / $$max) * 100))
  </script>
</template>
```

## Rocket Attributes

- `data-shadow-open` — open Shadow DOM
- `data-shadow-closed` — closed Shadow DOM
- `data-if` / `data-else-if` / `data-else` — conditional rendering (must be on `<template>`)
- `data-for` — iteration (must be on `<template>`)
- `data-key` — stable key for iterations

## Lifecycle

1. Template processed and component registered
2. DOM addition triggers instance creation and setup scripts
3. Component becomes reactive
4. DOM removal triggers `onCleanup` callbacks automatically

Note: This is a Datastar Pro feature and not part of the core open-source bundle.
