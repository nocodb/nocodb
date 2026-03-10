/**
 * ProseMirror plugin that assigns stable, URL-friendly `id` attributes to
 * heading nodes (H1, H2, H3) so they can be targeted by URL hash fragments.
 *
 * IDs are derived by slugifying the heading's text content. Duplicate slugs
 * are disambiguated with a numeric suffix (-1, -2, …).
 *
 * Also injects a small clickable anchor icon (widget decoration) inside each
 * heading. The icon is hidden by default and revealed on heading hover via CSS
 * (see Editor.vue styles). Clicking it is handled by the composable
 * `useDocHeadingAnchors` which listens for clicks on `.nc-heading-anchor-icon`.
 *
 * Uses a factory function (not a module-level singleton) so each editor
 * instance gets fresh plugin state — avoids stale decorations when navigating
 * between documents. See DocSearchExtension.ts for precedent.
 */
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Extension } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'

export const headingAnchorPluginKey = new PluginKey<DecorationSet>('headingAnchor')

/**
 * Convert heading text to a URL-safe slug.
 * Handles unicode, diacritics, and special characters.
 */
export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036F]/g, '') // strip diacritics
      .replace(/[^\w\s-]/g, '') // remove non-word chars
      .replace(/\s+/g, '-') // spaces → hyphens
      .replace(/-+/g, '-') // collapse consecutive hyphens
      .replace(/^-|-$/g, '') || 'heading' // trim, fallback
  )
}

function buildDecorations(doc: PmNode): DecorationSet {
  const decorations: Decoration[] = []
  const slugCounts = new Map<string, number>()

  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return

    const text = node.textContent.trim()
    if (!text) return

    const baseSlug = slugifyHeading(text)
    const count = slugCounts.get(baseSlug) || 0
    slugCounts.set(baseSlug, count + 1)
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`

    // Node decoration: adds id + data attribute to the heading DOM element
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        'id': slug,
        'data-heading-anchor': slug,
      }),
    )

    // Widget decoration: clickable anchor icon at the end of heading text
    decorations.push(
      Decoration.widget(
        pos + node.nodeSize - 1, // inside heading, after text content
        () => {
          const el = document.createElement('span')
          el.className = 'nc-heading-anchor-icon'
          el.contentEditable = 'false'
          el.setAttribute('data-nc-anchor-id', slug)
          el.setAttribute('role', 'button')
          el.setAttribute('aria-label', 'Copy link to section')
          return el
        },
        { side: 1 },
      ),
    )
  })

  return decorations.length ? DecorationSet.create(doc, decorations) : DecorationSet.empty
}

function createHeadingAnchorPlugin() {
  return new Plugin<DecorationSet>({
    key: headingAnchorPluginKey,

    state: {
      init(_, { doc }) {
        return buildDecorations(doc)
      },
      apply(tr, oldSet) {
        return tr.docChanged ? buildDecorations(tr.doc) : oldSet
      },
    },

    props: {
      decorations(state) {
        return headingAnchorPluginKey.getState(state)
      },
    },
  })
}

export const DocHeadingAnchorExtension = Extension.create({
  name: 'headingAnchor',

  addProseMirrorPlugins() {
    return [createHeadingAnchorPlugin()]
  },
})
