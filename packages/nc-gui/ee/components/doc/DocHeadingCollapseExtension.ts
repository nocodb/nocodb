/**
 * ProseMirror plugin that adds collapsible sections to headings (H1, H2, H3).
 *
 * Clicking the gutter area (left of the heading text) toggles visibility of
 * all content after the heading until the next heading at the same or higher
 * level (or end of document). Nested headings are part of their parent's
 * section — collapsing an H1 hides H2/H3 children and their content.
 *
 * Collapse state is ephemeral (stored in plugin state, not the document).
 * It resets on page reload and is per-user / per-session.
 *
 * Also tracks which heading contains the cursor so CSS can hide the
 * "H1"/"H2"/"H3" label for the active heading.
 *
 * Pattern reference: DocActiveBlockPlugin.ts (Plugin + Decoration.node + Extension wrapper)
 */
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Selection, Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorView } from '@tiptap/pm/view'
import { Extension } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'

interface CollapsePluginState {
  /** Positions of collapsed heading nodes */
  collapsed: Set<number>
  /** Position of the heading that contains the cursor (or -1 if none) */
  activeHeadingPos: number
}

interface CollapseMeta {
  type: 'toggleCollapse'
  pos: number
}

const collapsePluginKey = new PluginKey<CollapsePluginState>('headingCollapse')

/**
 * Find the end position of a heading's collapsible section.
 * A section runs from right after the heading node to the start of the
 * next heading at the same or higher level (lower number), or end of doc.
 */
function findSectionEnd(doc: PmNode, headingPos: number, headingLevel: number): number {
  const headingNode = doc.nodeAt(headingPos)
  if (!headingNode) return headingPos

  let pos = headingPos + headingNode.nodeSize

  while (pos < doc.content.size) {
    const node = doc.nodeAt(pos)
    if (!node) break

    if (node.type.name === 'heading' && node.attrs.level <= headingLevel) {
      break
    }

    pos += node.nodeSize
  }

  return pos
}

/**
 * Check whether a heading at `pos` is inside a blockquote.
 * Blockquote headings don't support collapse.
 */
function isInsideBlockquote(doc: PmNode, pos: number): boolean {
  const resolved = doc.resolve(pos)
  for (let d = resolved.depth; d > 0; d--) {
    if (resolved.node(d).type.name === 'blockquote') return true
  }
  return false
}

/**
 * Find which heading (if any) contains the current selection.
 * Returns the heading's start position, or -1.
 */
function findActiveHeadingPos(doc: PmNode, selection: Selection): number {
  const { $from } = selection

  // Check if the top-level node at cursor is a heading
  if ($from.depth >= 1) {
    const topNode = $from.node(1)
    if (topNode.type.name === 'heading') {
      return $from.before(1)
    }
  }

  return -1
}

function buildDecorations(doc: PmNode, collapsed: Set<number>, activeHeadingPos: number): DecorationSet {
  const decorations: Decoration[] = []

  // Mark the heading that contains the cursor (skip if it's collapsed —
  // collapsed headings always show the chevron, no label to hide)
  if (activeHeadingPos >= 0 && !collapsed.has(activeHeadingPos)) {
    const activeNode = doc.nodeAt(activeHeadingPos)
    if (activeNode && activeNode.type.name === 'heading') {
      decorations.push(
        Decoration.node(activeHeadingPos, activeHeadingPos + activeNode.nodeSize, {
          class: 'nc-heading-has-cursor',
        }),
      )
    }
  }

  // Mark collapsed headings and hide their sections
  for (const headingPos of collapsed) {
    const headingNode = doc.nodeAt(headingPos)
    if (!headingNode || headingNode.type.name !== 'heading') continue

    decorations.push(
      Decoration.node(headingPos, headingPos + headingNode.nodeSize, {
        'data-collapsed': 'true',
        'class': 'nc-heading-collapsed',
      }),
    )

    const level = headingNode.attrs.level as number
    const sectionEnd = findSectionEnd(doc, headingPos, level)
    let pos = headingPos + headingNode.nodeSize

    while (pos < sectionEnd) {
      const node = doc.nodeAt(pos)
      if (!node) break

      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'nc-heading-section-hidden',
        }),
      )

      pos += node.nodeSize
    }
  }

  if (decorations.length === 0) return DecorationSet.empty
  return DecorationSet.create(doc, decorations)
}

/**
 * Remap collapsed positions through a transaction's mapping.
 * Deleted positions are dropped.
 */
function remapCollapsed(collapsed: Set<number>, tr: Transaction): Set<number> {
  const next = new Set<number>()

  for (const pos of collapsed) {
    const mapped = tr.mapping.map(pos, 1)

    const node = tr.doc.nodeAt(mapped)
    if (node && node.type.name === 'heading') {
      next.add(mapped)
    }
  }

  return next
}

const collapsePlugin = new Plugin<CollapsePluginState>({
  key: collapsePluginKey,

  state: {
    init(_, { doc, selection }): CollapsePluginState {
      return {
        collapsed: new Set(),
        activeHeadingPos: findActiveHeadingPos(doc, selection),
      }
    },

    apply(tr, pluginState, _oldState, newState): CollapsePluginState {
      const meta = tr.getMeta(collapsePluginKey) as CollapseMeta | undefined

      let collapsed = pluginState.collapsed

      if (meta?.type === 'toggleCollapse') {
        collapsed = new Set(collapsed)
        if (collapsed.has(meta.pos)) {
          collapsed.delete(meta.pos)
        } else {
          collapsed.add(meta.pos)
        }
      } else if (tr.docChanged) {
        collapsed = remapCollapsed(collapsed, tr)
      }

      const activeHeadingPos = (tr.docChanged || tr.selectionSet)
        ? findActiveHeadingPos(newState.doc, newState.selection)
        : pluginState.activeHeadingPos

      if (collapsed === pluginState.collapsed && activeHeadingPos === pluginState.activeHeadingPos) {
        return pluginState
      }

      return { collapsed, activeHeadingPos }
    },
  },

  props: {
    decorations(state) {
      const pluginState = collapsePluginKey.getState(state)
      if (!pluginState) return DecorationSet.empty
      return buildDecorations(state.doc, pluginState.collapsed, pluginState.activeHeadingPos)
    },

    handleDOMEvents: {
      click(view: EditorView, event: MouseEvent) {
        const target = event.target as HTMLElement
        if (!target) return false

        // Find the closest heading element
        const headingEl = target.closest('h1, h2, h3') as HTMLElement | null
        if (!headingEl) return false

        // Skip headings inside blockquotes
        if (headingEl.closest('blockquote')) return false

        // Only respond to clicks in the gutter (left of the heading text).
        // The ::before pseudo-element sits at right:100% of the heading,
        // so gutter clicks have clientX < heading's left edge.
        const rect = headingEl.getBoundingClientRect()
        if (event.clientX >= rect.left) return false

        // Resolve the heading's position in the document
        const pos = view.posAtDOM(headingEl, 0)
        const resolved = view.state.doc.resolve(pos)

        // Walk up to find the top-level heading node position
        const headingPos = resolved.before(1)
        const node = view.state.doc.nodeAt(headingPos)
        if (!node || node.type.name !== 'heading') return false

        // Don't collapse headings inside blockquotes (double check via doc)
        if (isInsideBlockquote(view.state.doc, headingPos)) return false

        const pluginState = collapsePluginKey.getState(view.state)
        const isCurrentlyCollapsed = pluginState?.collapsed.has(headingPos)

        // Dispatch the toggle
        const tr = view.state.tr.setMeta(collapsePluginKey, {
          type: 'toggleCollapse',
          pos: headingPos,
        } as CollapseMeta)

        // When collapsing: if selection is in the hidden range, move it
        // to the end of the heading text
        if (!isCurrentlyCollapsed) {
          const level = node.attrs.level as number
          const sectionEnd = findSectionEnd(view.state.doc, headingPos, level)
          const headingEnd = headingPos + node.nodeSize
          const { from } = view.state.selection

          if (from >= headingEnd && from < sectionEnd) {
            const headingContentEnd = headingPos + node.nodeSize - 1
            tr.setSelection(
              view.state.selection.constructor.near(
                tr.doc.resolve(headingContentEnd),
                -1,
              ),
            )
          }
        }

        view.dispatch(tr)

        event.preventDefault()
        return true
      },
    },
  },
})

export const DocHeadingCollapseExtension = Extension.create({
  name: 'headingCollapse',

  addProseMirrorPlugins() {
    return [collapsePlugin]
  },
})
