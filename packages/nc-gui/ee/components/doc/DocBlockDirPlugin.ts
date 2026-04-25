/**
 * ProseMirror plugin that decorates every block-level node with
 * `dir="auto"`, mirroring how Notion renders body blocks. This lets each
 * paragraph/heading/list-item/etc. pick its own text direction from its
 * first strong character — so a doc can mix LTR and RTL content cleanly.
 *
 * Disabled by default. Toggle with a meta transaction:
 *
 *   editor.view.dispatch(
 *     editor.state.tr.setMeta(blockDirPluginKey, { enabled: true }),
 *   )
 *
 * The plugin itself doesn't touch the wrapper or the page title — those
 * stay on the doc-level `dir` (concrete ltr/rtl). Only the editor body
 * blocks are decorated.
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const blockDirPluginKey = new PluginKey<BlockDirState>('blockDir')

interface BlockDirState {
  enabled: boolean
  decorations: DecorationSet
}

const buildDecorations = (doc: any): DecorationSet => {
  const decos: Decoration[] = []
  doc.descendants((node: any, pos: number) => {
    if (!node.isBlock) return
    decos.push(Decoration.node(pos, pos + node.nodeSize, { dir: 'auto' }))
  })
  return DecorationSet.create(doc, decos)
}

const blockDirPlugin = new Plugin<BlockDirState>({
  key: blockDirPluginKey,

  state: {
    init() {
      return { enabled: false, decorations: DecorationSet.empty }
    },
    apply(tr, value, _oldState, newState) {
      const meta = tr.getMeta(blockDirPluginKey) as { enabled?: boolean } | undefined
      const nextEnabled = meta && typeof meta.enabled === 'boolean' ? meta.enabled : value.enabled

      if (!nextEnabled) {
        return { enabled: false, decorations: DecorationSet.empty }
      }

      const enabledFlipped = nextEnabled !== value.enabled
      if (enabledFlipped || tr.docChanged) {
        return { enabled: nextEnabled, decorations: buildDecorations(newState.doc) }
      }
      return { enabled: nextEnabled, decorations: value.decorations.map(tr.mapping, tr.doc) }
    },
  },

  props: {
    decorations(state) {
      return blockDirPluginKey.getState(state)?.decorations
    },
  },
})

export const DocBlockDirExtension = Extension.create({
  name: 'blockDir',

  addProseMirrorPlugins() {
    return [blockDirPlugin]
  },
})
