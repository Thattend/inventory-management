#!/usr/bin/env node
// Heuristic static scanner for Vue 3 single-file components.
// Zero dependencies: regex/line based, so it surfaces *candidates* only.
// Every finding must be confirmed by reading the code before it is reported.
//
// Usage: node analyze.mjs [srcDir=client/src] [--json]

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { createHash } from 'node:crypto'

const LIMITS = Object.freeze({
  fileLines: 400,
  templateLines: 200,
  scriptLines: 250,
  dupWindow: 6,          // consecutive normalized template lines that count as a duplicate block
  dupCssMinFiles: 3,     // identical CSS declaration body in at least N files
  asyncBoilerplateMinFiles: 3
})

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const srcDir = args.find((a) => !a.startsWith('--')) ?? 'client/src'

if (!existsSync(srcDir) || !statSync(srcDir).isDirectory()) {
  console.error(`analyze.mjs: source directory not found: ${srcDir}`)
  process.exit(2)
}

// ---------- file discovery ----------

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return []
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

const allFiles = walk(srcDir)
const vueFiles = allFiles.filter((f) => f.endsWith('.vue'))
const jsFiles = allFiles.filter((f) => /\.(m?js|ts)$/.test(f))

// ---------- SFC parsing ----------

// Returns { content, startLine } for the outermost <tag>...</tag> block.
// Uses lastIndexOf for the close tag because <template> blocks nest.
const extractBlock = (source, tag) => {
  const open = source.match(new RegExp(`<${tag}(\\s[^>]*)?>`))
  if (!open) return null
  const start = open.index + open[0].length
  const end = source.lastIndexOf(`</${tag}>`)
  if (end < start) return null
  return {
    content: source.slice(start, end),
    startLine: source.slice(0, start).split('\n').length
  }
}

const parseSfc = (file) => {
  const source = readFileSync(file, 'utf8')
  return {
    file: relative(process.cwd(), file),
    source,
    lines: source.split('\n').length,
    template: extractBlock(source, 'template'),
    script: extractBlock(source, 'script'),
    style: extractBlock(source, 'style')
  }
}

const countLines = (block) => (block ? block.content.split('\n').length : 0)

// Yields { line, text } with absolute line numbers for a block.
const blockLines = (block) =>
  block ? block.content.split('\n').map((text, i) => ({ line: block.startLine + i, text })) : []

const finding = (rule, severity, file, line, message, hint) => ({ rule, severity, file, line, message, hint })

// ---------- per-file detectors ----------

const detectSize = (sfc) => {
  const out = []
  const t = countLines(sfc.template)
  const s = countLines(sfc.script)
  if (sfc.lines > LIMITS.fileLines) {
    out.push(finding('large-component', 'medium', sfc.file, 1,
      `${sfc.lines} lines (template ${t}, script ${s}, style ${countLines(sfc.style)})`,
      'Split into child components / composables by responsibility.'))
  }
  if (t > LIMITS.templateLines) {
    out.push(finding('large-template', 'low', sfc.file, sfc.template.startLine,
      `template has ${t} lines`, 'Extract repeated or self-contained sections into child components.'))
  }
  if (s > LIMITS.scriptLines) {
    out.push(finding('large-script', 'low', sfc.file, sfc.script.startLine,
      `script has ${s} lines`, 'Move data fetching / derived state into composables.'))
  }
  return out
}

const detectVFor = (sfc) =>
  blockLines(sfc.template).flatMap(({ line, text }) => {
    if (!/\bv-for=/.test(text)) return []
    const out = []
    // Multi-line start tags may put :key on the next line; check a small window.
    const tagText = sfc.template.content.split('\n').slice(line - sfc.template.startLine, line - sfc.template.startLine + 4).join(' ')
    const tagOnly = tagText.slice(0, tagText.indexOf('>') + 1 || undefined)
    if (!/(:key|v-bind:key)=/.test(tagOnly)) {
      out.push(finding('vfor-missing-key', 'high', sfc.file, line, 'v-for without :key',
        'Add a stable unique :key (id, sku, month).'))
    }
    const keyMatch = tagOnly.match(/:key="\s*(index|idx|i)\s*"/)
    if (keyMatch) {
      out.push(finding('vfor-index-key', 'medium', sfc.file, line, `v-for uses :key="${keyMatch[1]}"`,
        'Index keys break DOM reuse on sort/filter. Use a stable identifier.'))
    }
    if (/\bv-if=/.test(tagOnly)) {
      out.push(finding('vfor-with-vif', 'medium', sfc.file, line, 'v-if on same element as v-for',
        'Filter in a computed, or move v-if to a wrapping <template>.'))
    }
    return out
  })

const TEMPLATE_HEAVY_CALL = /\{\{[^}]*\.(filter|sort|map|reduce|find)\(|="[^"]*\.(filter|sort|map|reduce)\(/

const detectTemplateComputation = (sfc) =>
  blockLines(sfc.template)
    .filter(({ text }) => TEMPLATE_HEAVY_CALL.test(text))
    .map(({ line }) => finding('template-computation', 'medium', sfc.file, line,
      'array filter/sort/map/reduce inside template expression',
      'Runs on every render. Move into a computed property.'))

const detectScriptPatterns = (sfc) => {
  const lines = blockLines(sfc.script)
  const script = sfc.script?.content ?? ''
  const out = []

  // Calls that already return a fresh array, so a following .sort() is harmless.
  const FRESH_ARRAY = /(\.slice\(\)|\[\.\.\.|toSorted|Array\.from|Object\.(values|keys|entries)\(|\.(map|filter|concat)\()/

  lines.forEach(({ line, text }, i) => {
    // In-place sort on something that is not an explicit copy mutates reactive state.
    // Chained calls often put .sort( on its own line, so look back two lines for a copy.
    const context = lines.slice(Math.max(0, i - 2), i + 1).map((l) => l.text).join(' ')
    if (/\.sort\(/.test(text) && !FRESH_ARRAY.test(context)) {
      out.push(finding('in-place-sort', 'low', sfc.file, line, '.sort() without an obvious copy',
        'Array.prototype.sort mutates. Harmful only if the array is reactive state, a prop, or shared. A fresh API response is fine. Fix with toSorted() or [...arr].sort().'))
    }
    if (/deep:\s*true/.test(text)) {
      out.push(finding('deep-watch', 'low', sfc.file, line, 'deep watcher',
        'Deep watch traverses the whole object on each change. Watch a getter for the specific field instead.'))
    }
  })

  const pairs = [
    ['addEventListener', 'removeEventListener', 'listener-leak'],
    ['setInterval', 'clearInterval', 'interval-leak'],
    ['setTimeout', 'clearTimeout', 'timeout-not-cleared']
  ]
  pairs.forEach(([add, remove, rule]) => {
    const addCount = (script.match(new RegExp(`\\b${add}\\(`, 'g')) ?? []).length
    const removeCount = (script.match(new RegExp(`\\b${remove}\\(`, 'g')) ?? []).length
    if (addCount > removeCount) {
      const first = lines.find(({ text }) => text.includes(`${add}(`))
      out.push(finding(rule, rule === 'timeout-not-cleared' ? 'low' : 'high', sfc.file, first?.line ?? 1,
        `${add} x${addCount} but ${remove} x${removeCount}`,
        `Pair with ${remove} in onBeforeUnmount/onUnmounted.`))
    }
  })

  // Large API arrays held in deep ref(): every element becomes a reactive proxy.
  lines.forEach(({ line, text }) => {
    const m = text.match(/const\s+(\w+)\s*=\s*ref\(\s*\[\s*\]\s*\)/)
    if (m) {
      out.push(finding('deep-ref-array', 'info', sfc.file, line, `${m[1]} = ref([]) (deep reactivity)`,
        'If the array is replaced wholesale from the API and items are never mutated, shallowRef avoids proxying every item.'))
    }
  })
  return out
}

// ---------- cross-file detectors ----------

const detectEagerRoutes = () =>
  jsFiles.flatMap((file) => {
    const src = readFileSync(file, 'utf8')
    if (!/createRouter\(/.test(src)) return []
    const eager = src.split('\n').flatMap((text, i) => {
      const m = text.match(/^import\s+(\w+)\s+from\s+['"](.+\.vue)['"]/)
      return m && new RegExp(`component:\\s*${m[1]}\\b`).test(src) ? [{ name: m[1], line: i + 1 }] : []
    })
    // One finding per router file; listing every import separately is noise.
    return eager.length
      ? [finding('eager-route', 'medium', relative(process.cwd(), file), eager[0].line,
          `${eager.length} route components imported eagerly: ${eager.map((e) => e.name).join(', ')}`,
          "Use component: () => import('./views/X.vue') so each view is code-split. Keep the landing route eager if first paint matters.")]
      : []
  })

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12)

// Normalize template lines so bindings with different variable names still match structurally.
const normalizeTemplateLine = (text) =>
  text.trim()
    .replace(/\{\{[^}]*\}\}/g, '{{}}')
    .replace(/="[^"]*"/g, '=""')
    .replace(/\s+/g, ' ')

const isTrivialLine = (t) => t.length < 8 || /^<\/?(div|span|template|p)>$/.test(t)

const detectDuplicateTemplates = (sfcs) => {
  const index = new Map() // hash -> [{file, line, sample}]
  sfcs.forEach((sfc) => {
    const lines = blockLines(sfc.template)
      .map(({ line, text }) => ({ line, norm: normalizeTemplateLine(text) }))
      .filter(({ norm }) => !isTrivialLine(norm))
    for (let i = 0; i + LIMITS.dupWindow <= lines.length; i++) {
      const window = lines.slice(i, i + LIMITS.dupWindow)
      const key = hash(window.map((l) => l.norm).join('\n'))
      const entry = { file: sfc.file, line: window[0].line, sample: window[0].norm }
      index.set(key, [...(index.get(key) ?? []), entry])
    }
  })

  // Overlapping windows over one duplicated block all hash separately. Group them by the
  // set of files they occur in: one finding per file set, and the number of matching
  // windows approximates the size of the shared block (more windows = bigger duplicate).
  const groups = [...index.values()]
    .filter((hits) => new Set(hits.map((h) => h.file)).size >= 2)
    .reduce((acc, hits) => {
      const files = [...new Set(hits.map((h) => h.file))].sort()
      const key = files.join('|')
      const prev = acc.get(key)
      return new Map(acc).set(key, prev ? { ...prev, windows: prev.windows + 1 } : { files, hits, windows: 1 })
    }, new Map())

  return [...groups.values()]
    .sort((a, b) => b.windows - a.windows)
    .map(({ files, hits, windows }) => {
      const where = files.map((f) => `${f}:${hits.find((h) => h.file === f).line}`).join(', ')
      const approxLines = windows + LIMITS.dupWindow - 1
      return finding('duplicate-template', approxLines >= 12 ? 'medium' : 'low', hits[0].file, hits[0].line,
        `~${approxLines} structurally identical template lines shared by ${files.length} files: ${where}`,
        'Candidate for a shared presentational component. Starts with: ' + hits[0].sample.slice(0, 80))
    })
}

const detectDuplicateCss = (sfcs) => {
  const index = new Map() // body hash -> { body, hits: [{file, selector}] }
  sfcs.forEach((sfc) => {
    if (!sfc.style) return
    const css = sfc.style.content.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const m of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
      const body = m[2].split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter(Boolean).sort().join(';')
      if (body.split(';').length < 3) continue // tiny rules are not worth extracting
      const key = hash(body)
      const prev = index.get(key) ?? { body, hits: [] }
      index.set(key, { ...prev, hits: [...prev.hits, { file: sfc.file, selector: m[1].trim() }] })
    }
  })
  return [...index.values()]
    .filter(({ hits }) => new Set(hits.map((h) => h.file)).size >= LIMITS.dupCssMinFiles)
    .map(({ body, hits }) => {
      const files = [...new Set(hits.map((h) => h.file))]
      return finding('duplicate-css', 'low', files[0], 1,
        `same CSS declarations in ${files.length} files (selectors: ${[...new Set(hits.map((h) => h.selector))].slice(0, 4).join(', ')})`,
        `Move to a shared class or global stylesheet. Body: ${body.slice(0, 100)}`)
    })
}

// Fetch boilerplate (loading + error refs + onMounted fetch) repeated across views.
const detectAsyncBoilerplate = (sfcs) => {
  const files = sfcs
    .filter(({ script }) => script && /loading\s*=\s*ref\(/.test(script.content)
      && /error\s*=\s*ref\(/.test(script.content) && /onMounted\(/.test(script.content))
    .map((s) => s.file)
  return files.length >= LIMITS.asyncBoilerplateMinFiles
    ? [finding('async-boilerplate', 'medium', files[0], 1,
        `loading/error/onMounted fetch pattern repeated in ${files.length} files: ${files.map((f) => basename(f)).join(', ')}`,
        'Extract a composable, e.g. useAsyncData(fetcher, deps) returning { data, loading, error, reload }.')]
    : []
}

// Components whose names share a suffix (e.g. *Modal.vue) usually duplicate shell markup.
const detectComponentFamilies = (sfcs) => {
  const families = sfcs.reduce((acc, { file }) => {
    const m = basename(file, '.vue').match(/([A-Z][a-z]+)$/)
    return m ? { ...acc, [m[1]]: [...(acc[m[1]] ?? []), basename(file)] } : acc
  }, {})
  return Object.entries(families)
    .filter(([, members]) => members.length >= 3)
    .map(([suffix, members]) => finding('component-family', 'info', srcDir, 1,
      `${members.length} *${suffix} components: ${members.join(', ')}`,
      `Check whether they share shell markup/behavior that a Base${suffix} with slots could own.`))
}

// ---------- run ----------

const sfcs = vueFiles.map(parseSfc)
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2, info: 3 }

const findings = [
  ...sfcs.flatMap((sfc) => [
    ...detectSize(sfc),
    ...detectVFor(sfc),
    ...detectTemplateComputation(sfc),
    ...detectScriptPatterns(sfc)
  ]),
  ...detectEagerRoutes(),
  ...detectDuplicateTemplates(sfcs),
  ...detectDuplicateCss(sfcs),
  ...detectAsyncBoilerplate(sfcs),
  ...detectComponentFamilies(sfcs)
].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.file.localeCompare(b.file) || a.line - b.line)

const summary = {
  scanned: { vue: vueFiles.length, js: jsFiles.length, dir: srcDir },
  components: sfcs
    .map((s) => ({ file: s.file, lines: s.lines, template: countLines(s.template), script: countLines(s.script), style: countLines(s.style) }))
    .sort((a, b) => b.lines - a.lines),
  counts: findings.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }), {})
}

if (asJson) {
  console.log(JSON.stringify({ summary, findings }, null, 2))
} else {
  console.log(`Scanned ${summary.scanned.vue} .vue + ${summary.scanned.js} js files in ${srcDir}`)
  console.log(`Findings: ${JSON.stringify(summary.counts)}  (heuristic candidates, verify before reporting)\n`)
  console.log('Largest components:')
  summary.components.slice(0, 8).forEach((c) =>
    console.log(`  ${String(c.lines).padStart(5)}  ${c.file}  (t ${c.template} / s ${c.script} / css ${c.style})`))
  console.log('')
  findings.forEach((f) => {
    console.log(`[${f.severity.toUpperCase()}] ${f.rule}  ${f.file}:${f.line}`)
    console.log(`    ${f.message}`)
    console.log(`    -> ${f.hint}`)
  })
}
