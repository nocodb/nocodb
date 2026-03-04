/**
 * ProseMirror plugin that shows a floating toolbar above 2-column layout blocks
 * with preset width ratio buttons (50/50, 33/67, 67/33, 25/75, 75/25).
 *
 * Follows the DocDragHandlePlugin pattern — manual DOM element positioned
 * relative to `.nc-doc-editor-body`.
 *
 * When the cursor is inside a `columns` node and the editor is editable,
 * the toolbar appears above the block. Clicking a ratio button dispatches
 * `setColumnRatio` to update the columns node attribute.
 */
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Extension } from '@tiptap/core'
import { COLUMN_RATIO_PRESETS, COL_RATIO_DEFAULT, type ColumnRatioPreset } from './DocColumnsExtension'

// --- Types ---

interface ColumnsToolbarState {
  /** Position of the columns node the cursor is inside, or -1 */
  columnsPos: number
  /** Current ratio (left column %) of the active columns node */
  activeRatio: number
}

// --- Constants ---

/** Human-readable labels for each preset */
const PRESET_LABELS: Record<ColumnRatioPreset, string> = {
  50: '50 / 50',
  33: '33 / 67',
  67: '67 / 33',
  25: '25 / 75',
  75: '75 / 25',
}

/** Bar width pairs (left, right) out of 20px total for the visual indicator */
const PRESET_BARS: Record<ColumnRatioPreset, [number, number]> = {
  50: [9, 9],
  33: [6, 12],
  67: [12, 6],
  25: [4, 14],
  75: [14, 4],
}

// --- Helpers ---

/**
 * Walk the selection's $from ancestors to find a `columns` node.
 * Returns { pos, ratio } or null.
 */
function findColumnsAncestor(state: EditorState): { pos: number; ratio: number } | null {
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'columns') {
      const raw = $from.node(d).attrs.ratio
      const ratio = typeof raw === 'number' ? raw : COL_RATIO_DEFAULT
      return { pos: $from.before(d), ratio }
    }
  }
  return null
}

// --- Plugin ---

const columnsToolbarPluginKey = new PluginKey<ColumnsToolbarState>('columnsToolbar')

function createColumnsToolbarPlugin(): Plugin<ColumnsToolbarState> {
  let toolbarEl: HTMLDivElement | null = null
  let editorBody: HTMLElement | null = null
  let listenersAttached = false

  return new Plugin<ColumnsToolbarState>({
    key: columnsToolbarPluginKey,

    state: {
      init(): ColumnsToolbarState {
        return { columnsPos: -1, activeRatio: COL_RATIO_DEFAULT }
      },
      apply(_tr, pluginState, _oldState, newState): ColumnsToolbarState {
        const result = findColumnsAncestor(newState)
        if (!result) {
          if (pluginState.columnsPos === -1) return pluginState
          return { columnsPos: -1, activeRatio: COL_RATIO_DEFAULT }
        }

        if (result.pos === pluginState.columnsPos && result.ratio === pluginState.activeRatio) {
          return pluginState
        }

        return { columnsPos: result.pos, activeRatio: result.ratio }
      },
    },

    view(editorView) {
      // Create toolbar DOM
      toolbarEl = document.createElement('div')
      toolbarEl.className = 'nc-columns-toolbar'
      toolbarEl.contentEditable = 'false'

      // Create preset buttons
      for (const preset of COLUMN_RATIO_PRESETS) {
        const btn = document.createElement('button')
        btn.dataset.ratio = String(preset)
        btn.title = PRESET_LABELS[preset]

        const [leftW, rightW] = PRESET_BARS[preset]
        btn.innerHTML =
          `<span class="bar" style="width:${leftW}px"></span>` +
          `<span class="bar" style="width:${rightW}px"></span>`

        toolbarEl.appendChild(btn)
      }

      // Event delegation — handle clicks on any button.
      // Uses mousedown (not click) so preventDefault() stops the browser
      // from moving focus out of ProseMirror into the toolbar.
      const onToolbarMouseDown = (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest('button[data-ratio]') as HTMLElement | null
        if (!target) return

        e.preventDefault()
        e.stopPropagation()

        const raw = target.dataset.ratio
        if (!raw) return
        const ratio = Number(raw)
        if (!Number.isFinite(ratio)) return

        // Find the columns node before dispatching (state is stable here)
        const result = findColumnsAncestor(editorView.state)
        if (!result) return

        // Direct setNodeMarkup — we don't have access to the tiptap command
        // chain from a PM plugin, and the logic is identical.
        const { state, dispatch } = editorView
        const node = state.doc.nodeAt(result.pos)
        if (!node) return

        const tr = state.tr.setNodeMarkup(result.pos, undefined, {
          ...node.attrs,
          ratio,
        })
        dispatch(tr)
      }

      toolbarEl.addEventListener('mousedown', onToolbarMouseDown)

      // --- Positioning & visibility ---

      const positionToolbar = () => {
        if (!toolbarEl || !editorBody) return

        const pluginState = columnsToolbarPluginKey.getState(editorView.state)
        if (!pluginState || pluginState.columnsPos < 0 || !editorView.editable) {
          toolbarEl.style.display = 'none'
          return
        }

        // Get DOM element for the columns node
        const dom = editorView.nodeDOM(pluginState.columnsPos) as HTMLElement | null
        if (!dom) {
          toolbarEl.style.display = 'none'
          return
        }

        const bodyRect = editorBody.getBoundingClientRect()
        const columnsRect = dom.getBoundingClientRect()

        // Show the toolbar first so offsetWidth is accurate for centering
        toolbarEl.style.display = 'flex'

        // Position above the columns block, centered horizontally
        const gap = 4
        const top = columnsRect.top - bodyRect.top - toolbarEl.offsetHeight - gap
        const left = columnsRect.left - bodyRect.left + (columnsRect.width - toolbarEl.offsetWidth) / 2

        toolbarEl.style.top = `${top}px`
        toolbarEl.style.left = `${Math.max(0, left)}px`

        // Update active button — highlight only when ratio matches a preset exactly
        const activeRatio = pluginState.activeRatio
        for (const btn of toolbarEl.querySelectorAll('button[data-ratio]')) {
          const btnEl = btn as HTMLElement
          btnEl.classList.toggle('active', Number(btnEl.dataset.ratio) === activeRatio)
        }
      }

      // --- Lazy DOM attachment ---

      const tryAttach = () => {
        if (listenersAttached) return
        editorBody = editorView.dom.closest('.nc-doc-editor-body') as HTMLElement | null
        if (!editorBody || !toolbarEl) return
        editorBody.appendChild(toolbarEl)
        listenersAttached = true
      }

      return {
        update() {
          tryAttach()
          positionToolbar()
        },
        destroy() {
          toolbarEl?.removeEventListener('mousedown', onToolbarMouseDown)
          toolbarEl?.remove()
          toolbarEl = null
          editorBody = null
          listenersAttached = false
        },
      }
    },
  })
}

// --- Extension wrapper ---

export const DocColumnsToolbarExtension = Extension.create({
  name: 'columnsToolbar',

  addProseMirrorPlugins() {
    return [createColumnsToolbarPlugin()]
  },
})
