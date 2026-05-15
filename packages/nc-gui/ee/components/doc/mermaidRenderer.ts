/**
 * Module-level Mermaid loader + render queue, shared across every
 * `DocMermaidView` instance on the page.
 *
 * Lives in its own `.ts` file (rather than inside the .vue component)
 * because Vue's `<script setup>` compiles top-level `let`/`const` into
 * the per-instance setup function — so any "module-level" state
 * declared there is actually per-instance. We need true module scope so
 * the render queue mutex spans all instances.
 *
 * - `loadMermaid()` lazy-imports the ~1MB mermaid bundle once, caches it.
 * - `renderMermaidDiagram()` serialises every `mermaid.render()` call
 *   via a promise chain — mermaid is not concurrency-safe (it reuses a
 *   shared d3 instance + DOM scratch container, so parallel renders
 *   corrupt each other's SVG output). Theme is applied via
 *   `mermaid.initialize()` inside the queued task, so each render
 *   atomically picks up its requested palette.
 */

import type Mermaid from 'mermaid'

export type MermaidTheme = 'light' | 'dark'

/**
 * NocoDB-aligned palettes. We use mermaid's `base` theme and override
 * only the primary tokens — mermaid derives the rest (edge colours, note
 * variants, alt sections, etc.) from these. Colours come from
 * `assets/css/variables.css` (color-gray-* and color-brand-500).
 *
 * `themeVariables` could be driven from runtime CSS vars via
 * `getComputedStyle`, but a static map keeps SSR / first-paint cheap
 * and the palette deliberate.
 */
const PALETTES: Record<MermaidTheme, Record<string, string>> = {
  light: {
    background: '#ffffff',
    primaryColor: '#f4f4f5', // gray-100 — node fill
    primaryTextColor: '#1f293a', // gray-800 — node text
    primaryBorderColor: '#9aa2af', // gray-400
    secondaryColor: '#e7e7e9', // gray-200
    tertiaryColor: '#f9f9fa', // gray-50
    lineColor: '#6a7184', // gray-500 — arrows
    textColor: '#1f293a',
    mainBkg: '#f4f4f5',
    secondBkg: '#e7e7e9',
    tertiaryBkg: '#f9f9fa',
    noteBkgColor: '#fff8e1',
    noteBorderColor: '#fbbf24',
    noteTextColor: '#78350f',
    // Brand-blue accent for sequence numbers, active states, etc.
    actorBkg: '#f4f4f5',
    actorBorder: '#9aa2af',
    actorTextColor: '#1f293a',
    activationBkgColor: '#dbe5ff',
    activationBorderColor: '#3366ff',
    signalColor: '#1f293a',
    signalTextColor: '#1f293a',
    // Pie / journey colour scale — NocoDB brand-led
    pie1: '#3366ff',
    pie2: '#7a99ff',
    pie3: '#a3b8ff',
    pie4: '#cbd5e1',
    pie5: '#9aa2af',
    pie6: '#6a7184',
    pie7: '#fbbf24',
    pie8: '#f59e0b',
    pieTitleTextColor: '#1f293a',
    pieSectionTextColor: '#1f293a',
    pieLegendTextColor: '#1f293a',
    pieStrokeColor: '#9aa2af',
    pieOuterStrokeColor: '#6a7184',
  },
  dark: {
    background: '#1f293a', // gray-800
    primaryColor: '#374151', // gray-700 — node fill
    primaryTextColor: '#f9f9fa', // gray-50
    primaryBorderColor: '#6a7184', // gray-500
    secondaryColor: '#1f293a',
    tertiaryColor: '#374151',
    lineColor: '#9aa2af', // gray-400 — arrows
    textColor: '#f9f9fa',
    mainBkg: '#374151',
    secondBkg: '#1f293a',
    tertiaryBkg: '#111827',
    noteBkgColor: '#451a03',
    noteBorderColor: '#fbbf24',
    noteTextColor: '#fef3c7',
    actorBkg: '#374151',
    actorBorder: '#6a7184',
    actorTextColor: '#f9f9fa',
    activationBkgColor: '#1e3a8a',
    activationBorderColor: '#7a99ff',
    signalColor: '#f9f9fa',
    signalTextColor: '#f9f9fa',
    pie1: '#7a99ff',
    pie2: '#3366ff',
    pie3: '#a3b8ff',
    pie4: '#6a7184',
    pie5: '#9aa2af',
    pie6: '#cbd5e1',
    pie7: '#fbbf24',
    pie8: '#f59e0b',
    pieTitleTextColor: '#f9f9fa',
    pieSectionTextColor: '#f9f9fa',
    pieLegendTextColor: '#f9f9fa',
    pieStrokeColor: '#6a7184',
    pieOuterStrokeColor: '#9aa2af',
  },
}

let mermaidPromise: Promise<typeof Mermaid> | null = null

export const loadMermaid = (): Promise<typeof Mermaid> => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => mod.default)
  }
  return mermaidPromise
}

let nextRenderId = 0

let renderChain: Promise<unknown> = Promise.resolve()

export const renderMermaidDiagram = (code: string, theme: MermaidTheme): Promise<string> => {
  const task = async () => {
    const mermaid = await loadMermaid()
    // Re-init per render so the active theme palette is applied. Safe
    // because the queue guarantees only one render is in flight at a
    // time. `initialize()` is documented as a simple config merge —
    // cheap to call repeatedly.
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: PALETTES[theme],
      securityLevel: 'strict',
      fontFamily: 'inherit',
    })
    const elemId = `nc-mermaid-${++nextRenderId}`
    const { svg } = await mermaid.render(elemId, code)
    return svg
  }
  const next = renderChain.then(task, task)
  // Swallow rejections on the shared chain so one bad diagram doesn't
  // poison the next caller's render.
  renderChain = next.catch(() => undefined)
  return next
}
