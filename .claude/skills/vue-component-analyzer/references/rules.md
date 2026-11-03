# Scanner rules and manual checks

Each rule: what it detects, common false positives, recommended fix.

## Performance rules

### `vfor-missing-key` (high)
`v-for` with no `:key` in the opening tag (scanner checks the next 4 lines for multi-line tags).
- False positive: very long multi-line opening tags where `:key` sits further down.
- Fix: `:key="item.id"` (or `sku`, `month`, any stable unique field).

### `vfor-index-key` (medium)
`:key="index"` / `idx` / `i`.
- Fine when the list is static and never sorted, filtered or spliced.
- Fix: use a stable identifier. If none exists, build one in a computed (`${a.date}-${a.sku}`).

### `vfor-with-vif` (medium)
`v-if` on the same element as `v-for`. In Vue 3 `v-if` runs first and cannot see the loop variable, so this is often a bug as well as a perf issue.
- Fix: filter in a computed, or move `v-if` to a wrapping `<template>`.

### `template-computation` (medium)
`.filter/.sort/.map/.reduce/.find` inside a template expression. Re-runs on every render of the component.
- False positive: tiny arrays (a handful of items).
- Fix: move into a `computed`. Inside a `v-for`, precompute a lookup map in a computed.

### `in-place-sort` (low)
`.sort()` without an obvious copy in the same or the 2 previous lines.
- False positive: sorting a fresh API response before assigning it (no reactive state involved).
- Real problem: sorting a prop, a `ref`'s `.value`, or a shared module-level array. Mutating inside a `computed` causes extra triggers and hidden side effects.
- Fix: `toSorted()` or `[...arr].sort()`.

### `deep-watch` (low)
`watch(x, fn, { deep: true })` traverses the whole object on each change.
- Fix: watch a getter for the field you need (`watch(() => form.value.status, ...)`), or use a `computed`.

### `listener-leak` / `interval-leak` (high), `timeout-not-cleared` (low)
More `addEventListener` / `setInterval` / `setTimeout` calls than matching removals in the component.
- False positive: listener added on an element that is destroyed with the component; `{ once: true }` listeners; timeouts that always finish before unmount.
- Fix: remove in `onBeforeUnmount` / `onUnmounted`. For `window`/`document`/`matchMedia` listeners this is always required.

### `deep-ref-array` (info)
`const x = ref([])`. Every element becomes a reactive proxy when assigned.
- Matters only for large arrays (hundreds+ items) that are replaced wholesale and whose items are never mutated in place.
- Fix: `shallowRef([])`; trigger updates by reassigning `.value`.

### `eager-route` (medium)
Router file imports view components statically, so all views land in the main bundle.
- Fix: `component: () => import('./views/X.vue')`. Keep the landing route eager if first paint matters. Verify in `npm run build` output that per-view chunks appear.

### `large-component` / `large-template` / `large-script` (medium/low)
Size above thresholds (defaults: file 400, template 200, script 250 lines). Prefer project thresholds if defined.
- Fix: split by responsibility: chart sections into chart components, data loading into composables, modals into their own files.

## Reuse rules

### `duplicate-template`
Windows of 6+ structurally identical template lines (attribute values and interpolations normalized away) in 2+ files. One finding per file set; `~N lines` approximates the shared block size.
- False positive: generic wrappers (`<div class=""><div class="">...`) that only look alike after normalization. Open both locations and compare.
- Fix: shared presentational component with props/slots (page header, stat card, data table, empty state, modal shell, close button).

### `duplicate-css`
Same declaration body (3+ declarations) in 3+ files.
- Fix: move into a global stylesheet / utility class, or into the shared component the template duplication points to (often both findings describe the same component).

### `async-boilerplate`
3+ components each define `loading` + `error` refs and fetch in `onMounted`.
- Fix: composable, for example:
  ```js
  export function useAsyncData(fetcher, { immediate = true } = {}) {
    const data = shallowRef(null)
    const loading = ref(false)
    const error = ref(null)
    const reload = async (...args) => {
      loading.value = true
      error.value = null
      try {
        data.value = await fetcher(...args)
      } catch (err) {
        error.value = err
        console.error('useAsyncData:', err)
      } finally {
        loading.value = false
      }
    }
    if (immediate) onMounted(reload)
    return { data, loading, error, reload }
  }
  ```
  Keep each view's existing error message text and filter watchers.

### `component-family` (info)
3+ components sharing a name suffix (`*Modal`, `*Card`). Prompt to check for a `Base<Suffix>` with slots.

## Manual checks (scanner cannot detect)

- **Props destructured in `setup(props)`** (`const { items } = props`) lose reactivity. Use `toRefs(props)` or `props.items`.
- **Expensive methods in templates**, e.g. `{{ formatChart(data) }}` inside `v-for`. Move to a computed.
- **`v-if` on frequently toggled UI** (tabs, dropdowns, tooltips). `v-show` avoids remounting.
- **Watcher that only sets another ref** should be a `computed`.
- **Duplicate fetching**: child and parent fetch the same endpoint; lift the fetch or share via composable.
- **Unthrottled resize/scroll/input handlers** triggering API calls or heavy computation. Debounce.
- **Large static lists** (hundreds of rows) rendered all at once. Consider pagination; `v-memo` for rows that rarely change.
- **Heavy, rarely opened components** (modals, report views) imported eagerly into a parent. Use `defineAsyncComponent`.
- **Inline object/array literals passed as props** to child components with watchers: new reference every render, so the child's watcher fires every time.
- **Same formatting/helper function** defined in several components. Move to `utils/`.
