---
name: saas-redesign
description: Redesign a Vue 3 application's UI into a modern SaaS-style interface - left vertical sidebar navigation instead of a top nav bar, a design-token based spacing/type/color system, and consistent, polished page layouts. Use when the user asks to modernize, restyle, or "make it look like a SaaS app", move navigation to a sidebar, or unify spacing and visual polish across a Vue 3 app.
---

# SaaS Redesign for Vue 3 Apps

Turn an existing Vue 3 app into a clean SaaS-style interface. The goals, in priority order:

1. **Nothing breaks.** Every route, filter, modal, i18n string, and API call works exactly as before.
2. **Left sidebar navigation** replaces the top nav bar.
3. **One design system.** Spacing, type, color, radius, and shadow come from CSS custom properties, not ad-hoc values.
4. **Consistent pages.** Every view uses the same page header, card, table, and stat-tile patterns.

This is a visual and structural refactor. Do not change business logic, data flow, or API contracts.

## Ground rules

- **Read the project's own rules first** (`CLAUDE.md` files, `client/CLAUDE.md`, any design-system notes). Project rules win over this skill. For example, if the project says "no emojis in UI" or fixes a color palette, keep it. If the project requires a specific agent for `.vue` edits (e.g. `vue-expert`), delegate those edits to it and pass this skill's instructions along.
- **Work on a branch.** The redesign touches many files; keep it reviewable.
- **Keep existing class names working** while migrating. Remove a global class only once no component uses it (`grep` first).
- **No new dependencies** unless the user agrees. Plain CSS custom properties plus scoped styles are enough. Don't add Tailwind, a component library, or an icon package uninvited. Use inline SVG icons.
- **Comment non-obvious layout decisions** (z-index layers, sticky offsets, breakpoint behavior).

## Workflow

### Phase 1: Audit (read-only)

Build a picture before changing anything:

1. Find the app shell: usually `src/App.vue`. Note the nav markup, where global styles live, and what sits in the header (logo, language switcher, profile menu, global filter bar).
2. List routes from the router (`src/main.js` or `src/router/*`). Each one becomes a sidebar item.
3. Inventory global styles: grep for hardcoded colors (`#[0-9a-fA-F]{3,6}`), pixel spacings, font sizes, `box-shadow`, `border-radius`. Note the most common values; they seed the tokens.
4. List the shared UI patterns each view repeats: page header, cards, stat tiles, tables, badges, buttons, modals, empty/loading/error states.
5. **Take "before" screenshots** of every route with Playwright MCP (desktop 1440x900, and one mobile 390x844 if the app is used on mobile). Save them under `/tmp/saas-redesign/before/`.

Summarize the audit for the user in a few lines and confirm scope before Phase 2 if anything is ambiguous, e.g. whether the global filter bar moves into the top bar or stays above page content, or whether a dark sidebar or a light one is preferred.

### Phase 2: Design tokens

Create `src/styles/tokens.css` (or the project's equivalent) and import it once in `main.js`. Start from `references/tokens.css` in this skill and adapt it:

- Map the project's existing palette onto the token names instead of inventing new colors.
- Spacing uses a 4px scale (`--space-1` = 4px ... `--space-12` = 48px). Use these values only.
- Define layout tokens: `--sidebar-width`, `--sidebar-width-collapsed`, `--topbar-height`, `--content-max-width`.

Then replace hardcoded values in global styles with tokens. Do this mechanically and file by file, and rebuild after each file.

### Phase 3: App shell with sidebar

Restructure `App.vue` into this layout. `references/AppSidebar.vue` and `references/app-shell.md` hold a working template.

```
+----------+------------------------------------------+
|          |  Top bar: page title / filters / user    |
| Sidebar  +------------------------------------------+
|  logo    |                                          |
|  nav     |  <router-view> inside .page container    |
|  ...     |                                          |
|  footer  |                                          |
+----------+------------------------------------------+
```

Requirements:
- **`AppSidebar.vue` component**. Its nav items come from a single array (route path, i18n label key, icon). The active state uses `router-link`'s `active-class` / `exact-active-class`; don't re-implement it with `$route.path ===` comparisons.
- **Grouping**: put nav items into labelled sections when there are more than about 6 routes (e.g. "Operations", "Finance", "Analytics").
- **Collapse**: the sidebar collapses to an icon rail (with tooltips via `title` / `aria-label`). Persist the collapsed state in `localStorage`.
- **Responsive**: below 1024px the sidebar becomes an off-canvas drawer. Open it with a hamburger button in the top bar; close it with a backdrop click, Esc, or route change.
- **Top bar**: keep the existing utilities (language switcher, profile menu, notifications) and move them from the old nav. Global filters either go into a sticky sub-bar under the top bar or stay at the top of the page content. Follow the decision from Phase 1.
- **Accessibility**: `<nav aria-label="Main">`, `aria-current="page"` on the active link (router-link does this), visible focus rings, a "Skip to content" link, and all icon-only buttons labelled.
- **Remove** the old top-nav markup and styles once the new shell works.

### Phase 4: Page polish

Apply the same patterns to every view, one view at a time:

- **Page header**: title (h1-level styling), one-line description, and optional right-aligned actions. Use the same component or class everywhere.
- **Content width**: `max-width: var(--content-max-width)` with `padding: var(--space-8)`. On mobile, reduce it to `var(--space-4)`.
- **Cards**: one style: surface background, 1px border, `--radius-lg`, `--shadow-sm`, internal padding `--space-6`, header/body separation.
- **Stat tiles**: label (small, muted, uppercase optional), value (large, tabular numbers), optional delta or status color.
- **Tables**: sticky header, `--space-3`/`--space-4` cell padding, zebra or hover rows (pick one), right-aligned numeric columns with `font-variant-numeric: tabular-nums`, and a horizontal scroll container on small screens.
- **Badges / status**: map statuses to the semantic tokens (`--color-success`, `--color-info`, `--color-warning`, `--color-danger`) with subtle backgrounds.
- **Buttons**: primary, secondary, ghost and danger variants, all at one height, with focus and disabled states.
- **States**: loading (skeleton or spinner), empty, and error all look the same across views.
- **Vertical rhythm**: sections separated by `--space-6` or `--space-8` and never by arbitrary margins.

Charts: restyle only colors, fonts, gridlines and spacing to match tokens. Don't change what data they plot.

### Phase 5: Verify

1. Build: `npm run build` (or `npx vite build`) with zero errors.
2. Run the project's existing test suites. All of them must pass.
3. Playwright MCP, for every route:
   - "after" screenshots at the same sizes as the "before" ones (`/tmp/saas-redesign/after/`);
   - click every sidebar item and check the active state and the URL;
   - collapse and expand the sidebar, reload, and check the state persisted;
   - at 390px width, open and close the drawer (backdrop, Esc, navigation);
   - exercise each global filter and one modal per view;
   - switch language if the app has i18n, and check long labels don't overflow the sidebar;
   - check the browser console has no new errors.
4. Keyboard pass: Tab through the sidebar and top bar; focus must be visible and in a logical order.
5. Report to the user: files changed, before/after screenshot paths, anything intentionally left unchanged, and any pre-existing issues noticed but not fixed.

## Quality checklist

- [ ] No route, filter, modal, or API call behaves differently
- [ ] No hardcoded colors or spacings remain in shell or shared styles (grep check)
- [ ] Sidebar works at desktop width, collapsed, and as a mobile drawer
- [ ] Active nav item is correct on every route, including nested or child routes
- [ ] Every view uses the shared page header, card, and table patterns
- [ ] Text contrast is at least 4.5:1 (sidebar text included)
- [ ] Focus rings are visible; icon buttons have labels
- [ ] Build passes; existing tests pass; no new console errors
- [ ] Project-specific rules (from CLAUDE.md) respected
