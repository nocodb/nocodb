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
 *   corrupt each other's SVG output).
 */

type MermaidApi = typeof import('mermaid').default

let mermaidPromise: Promise<MermaidApi> | null = null

export const loadMermaid = (): Promise<MermaidApi> => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'strict',
        fontFamily: 'inherit',
      })
      return mod.default
    })
  }
  return mermaidPromise
}

let nextRenderId = 0

let renderChain: Promise<unknown> = Promise.resolve()

export const renderMermaidDiagram = (code: string): Promise<string> => {
  const task = async () => {
    const mermaid = await loadMermaid()
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
