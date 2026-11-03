---
name: vue-component-analyzer
description: Analyze Vue 3 component structure and suggest performance and code-reuse optimizations - oversized components, v-for key problems, template computations, missing cleanup, deep reactivity, eager route imports, duplicated template/CSS blocks, and repeated logic that belongs in a composable or base component. Use when the user asks to audit, analyze, or review Vue components for performance, re-renders, bundle size, duplication, reuse, refactoring opportunities, or "what should I extract".
---

# Vue Component Analyzer

Produce a prioritized, evidence-backed report of performance and reuse opportunities in a Vue 3 codebase. **Default is report-only.** Change code only when the user asks for it after seeing the report.

## Ground rules

- **Read project rules first**: root `CLAUDE.md`, `client/CLAUDE.md`, any design-system notes. Project rules win over this skill. Examples: if the project sets component-size thresholds (e.g. "extract when template >100 lines"), use those instead of the scanner defaults; if it requires a specific agent for `.vue` edits (e.g. `vue-expert`), delegate every `.vue` change to it.
- **The scanner finds candidates, not findings.** It is regex-based. Open the file and confirm every item before it goes in the report. Drop false positives silently; do not pad the report.
- **Measure, don't guess** on performance claims. Only call something a hot path if it re-runs often (inside `v-for`, on every keystroke, on every filter change) or touches large data.
- **No new dependencies** unless the user agrees. Suggest native Vue APIs first (`computed`, `shallowRef`, `defineAsyncComponent`, `v-memo`, `KeepAlive`).
- **Behavior-preserving.** Every suggestion must keep routes, filters, i18n, API calls and visuals working exactly as before.

## Workflow

### 1. Scan (automated)

Run the bundled scanner from the repo root:

```bash
node .claude/skills/vue-component-analyzer/scripts/analyze.mjs client/src          # readable
node .claude/skills/vue-component-analyzer/scripts/analyze.mjs client/src --json   # for further processing
```

It needs only Node (no install). It prints the largest components and findings grouped by rule. See `references/rules.md` for what each rule means, its typical false positives, and the recommended fix.

### 2. Verify (manual, required)

For each candidate, read the surrounding code and decide:

| Question | If no |
|----------|-------|
| Is the pattern really there? (e.g. `.sort()` is on reactive state, not a fresh API array) | Drop it |
| Does it matter here? (list size, how often it re-renders, whether it is on a hot path) | Downgrade to low or drop |
| Is the fix safe without behavior change? | Note the risk explicitly |

Also look for things the scanner cannot see (checklist in `references/rules.md`, section "Manual checks"): props destructured out of reactivity, expensive methods called in templates, `v-if` toggled frequently that should be `v-show`, watchers that should be `computed`, components re-fetching data a parent already has, unthrottled resize/scroll handlers.

### 3. Group into opportunities

Turn verified findings into a short list of **opportunities**, not a dump of lines. One opportunity can cover many findings, e.g. "7 views repeat the loading/error/fetch boilerplate, extract `useAsyncData`".

For reuse opportunities, sketch the API of the shared piece (props/slots/emits for a component, arguments/return for a composable) so the user can judge it.

### 4. Report

Use this format:

```markdown
## Vue component analysis: <scope>

Scanned N components. Largest: X.vue (L lines), Y.vue (L lines).

### Performance
1. **<title>** [high|medium|low] - `file:line`, `file:line`
   Problem: <one sentence, concrete>
   Fix: <one sentence or tiny snippet>
   Effort: S|M|L   Risk: <what could break>

### Code reuse
1. **<title>** [medium] - files...
   Shared piece: `BaseModal.vue` with slots `header`, `default`, `footer`; emits `close`
   Removes ~N duplicated lines across M files.

### Not worth changing
- <candidate> - <why it is fine, e.g. list is <20 items>

### Suggested order
1. Quick wins (S effort, low risk)
2. ...
```

Rank by impact / effort. Put correctness-adjacent items (missing keys, listener leaks, mutation of shared state) first.

### 5. Apply (only on request)

When the user picks items to implement:

1. Work on a branch.
2. One opportunity per commit, so each is reviewable and revertible.
3. Delegate `.vue` edits to the project's Vue agent if the project requires it, passing the exact opportunity text and affected files.
4. Comment non-obvious changes (why `shallowRef`, why a route stays eager).
5. Verify: `npm run build` passes, then open each affected route with Playwright and check the console for errors. For code splitting, confirm separate chunks appear in the build output.
6. Re-run the scanner and show the before/after counts.
