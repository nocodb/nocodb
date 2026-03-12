/**
 * ProseMirror plugin that adds a Notion-style drag handle in the left gutter
 * for reordering top-level blocks via mouse-based drag-and-drop.
 *
 * A single absolutely-positioned DOM element (the grip handle) is attached to
 * `.nc-doc-editor-body` (which already has `position: relative`). On mousemove
 * over the editor body, the plugin resolves the nearest top-level block and
 * positions the handle next to it. On mousedown on the handle, a manual drag
 * session starts — mousemove tracks the cursor and shows a drop indicator line,
 * mouseup performs the ProseMirror transaction to move the block.
 *
 * We use manual mouse tracking instead of HTML5 drag-and-drop because
 * `draggable` elements near `contentEditable` regions don't reliably fire
 * dragstart in most browsers.
 *
 * Mouse tracking is done via direct DOM listeners on `.nc-doc-editor-inner`
 * (not ProseMirror's handleDOMEvents) because the gutter zone sits in the
 * padding of `.nc-doc-editor-inner`, outside both ProseMirror and
 * `.nc-doc-editor-body`.
 *
 * Pattern reference: DocHeadingCollapseExtension.ts, DocActiveBlockPlugin.ts
 */
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Extension } from '@tiptap/core'
import type { Node as PmNode } from '@tiptap/pm/model'

// --- Types ---

interface DragHandleState {
  /** Position of the hovered top-level block, or -1 if none */
  activeBlockPos: number
  /** Whether a drag is currently in progress */
  isDragging: boolean
}

interface DragHandleMeta {
  type: 'setActiveBlock' | 'dragStart' | 'dragEnd'
  pos?: number
}

// --- Constants ---

const DRAGGABLE_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'codeBlock',
  'blockquote',
  'callout',
  'image',
  'embed',
  'fileAttachment',
  'table',
  'horizontalRule',
  'columns',
])

/** How far into the content area (from the left edge) the gutter zone extends */
const GUTTER_OVERLAP = 20

/** Handle dimensions */
const HANDLE_SIZE = 24
const HANDLE_GAP = 28

/** Minimum mouse movement (px) before a mousedown becomes a drag */
const DRAG_THRESHOLD = 4

// --- Helpers ---

/** 6-dot grip SVG (same pattern as Material drag_indicator) */
const GRIP_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <circle cx="5.5" cy="3" r="1.25"/>
  <circle cx="10.5" cy="3" r="1.25"/>
  <circle cx="5.5" cy="8" r="1.25"/>
  <circle cx="10.5" cy="8" r="1.25"/>
  <circle cx="5.5" cy="13" r="1.25"/>
  <circle cx="10.5" cy="13" r="1.25"/>
</svg>`

/**
 * Check whether the node at `pos` is a draggable top-level block.
 * Collapsed section blocks (display: none) are excluded.
 */
function isTopLevelDraggable(doc: PmNode, pos: number, view: EditorView): boolean {
  const node = doc.nodeAt(pos)
  if (!node) return false

  if (!DRAGGABLE_TYPES.has(node.type.name)) return false

  // Must be a top-level child of the doc (depth 0)
  const resolved = doc.resolve(pos)
  if (resolved.depth !== 0) return false

  // Skip collapsed/hidden blocks
  const dom = view.nodeDOM(pos) as HTMLElement | null
  if (dom && dom.classList?.contains('nc-heading-section-hidden')) return false

  return true
}

/**
 * Resolve the top-level block position at the given coordinates.
 * Returns the block's start position in the doc, or -1 if none found.
 */
function resolveBlockAtCoords(view: EditorView, x: number, y: number): number {
  const posInfo = view.posAtCoords({ left: x, top: y })
  if (!posInfo) return -1

  const resolved = view.state.doc.resolve(posInfo.pos)

  // Walk up to get the top-level block position (depth 1 child of doc)
  if (resolved.depth < 1) return -1
  const blockPos = resolved.before(1)

  if (!isTopLevelDraggable(view.state.doc, blockPos, view)) return -1

  return blockPos
}

/**
 * Find the insertion gap closest to the cursor Y position.
 * Returns the position where the block should be inserted (always a
 * "before" position of some block), or null if no valid target.
 *
 * The indicator snaps to gaps between blocks — one position per gap,
 * not two per block — so it never jumps between two pixel locations
 * for the same insertion result.
 */
function findDropTarget(view: EditorView, clientY: number, sourcePos: number): { insertPos: number } | null {
  const doc = view.state.doc
  const pmRect = view.dom.getBoundingClientRect()
  const probeX = pmRect.left + 4

  const posInfo = view.posAtCoords({ left: probeX, top: clientY })
  if (!posInfo) return null

  const resolved = doc.resolve(posInfo.pos)
  if (resolved.depth < 1) return null

  const blockPos = resolved.before(1)
  const node = doc.nodeAt(blockPos)
  if (!node) return null

  const dom = view.nodeDOM(blockPos) as HTMLElement | null
  if (!dom) return null

  const rect = dom.getBoundingClientRect()
  const midY = rect.top + rect.height / 2

  // Cursor is in the top half → insert before this block
  // Cursor is in the bottom half → insert after this block (= before the next)
  let insertPos: number
  if (clientY < midY) {
    insertPos = blockPos
  } else {
    insertPos = blockPos + node.nodeSize
  }

  // Skip if this would be a no-op (inserting right before or after the source)
  const sourceNode = doc.nodeAt(sourcePos)
  if (!sourceNode) return null
  const sourceEnd = sourcePos + sourceNode.nodeSize
  if (insertPos === sourcePos || insertPos === sourceEnd) return null

  return { insertPos }
}

// --- Plugin ---

const dragHandlePluginKey = new PluginKey<DragHandleState>('dragHandle')

function createDragHandlePlugin(): Plugin<DragHandleState> {
  let handleEl: HTMLDivElement | null = null
  /** Drop indicator line shown between blocks during drag */
  let dropIndicatorEl: HTMLDivElement | null = null
  /** .nc-doc-editor-body — position anchor for the handle (has position: relative) */
  let editorBody: HTMLElement | null = null
  /** .nc-doc-editor-inner — includes the padding zone where the handle lives.
   *  Mouse listeners attach here so hover works across the full gutter. */
  let editorInner: HTMLElement | null = null
  let currentActivePos = -1
  let isDragging = false

  // Manual drag state
  let dragMouseDownPos: { x: number; y: number } | null = null
  let dragStarted = false
  let dragSourceBlockPos = -1
  /** Current drop insertion position, or -1 if none */
  let currentDropInsertPos = -1

  return new Plugin<DragHandleState>({
    key: dragHandlePluginKey,

    state: {
      init(): DragHandleState {
        return { activeBlockPos: -1, isDragging: false }
      },
      apply(tr, pluginState): DragHandleState {
        const meta = tr.getMeta(dragHandlePluginKey) as DragHandleMeta | undefined
        if (!meta) {
          // Remap active block position through doc changes
          if (tr.docChanged && pluginState.activeBlockPos >= 0) {
            const mapped = tr.mapping.map(pluginState.activeBlockPos, 1)
            if (mapped !== pluginState.activeBlockPos) {
              return { ...pluginState, activeBlockPos: mapped }
            }
          }
          return pluginState
        }

        switch (meta.type) {
          case 'setActiveBlock':
            if (meta.pos === pluginState.activeBlockPos) return pluginState
            return { ...pluginState, activeBlockPos: meta.pos ?? -1 }
          case 'dragStart':
            return { ...pluginState, isDragging: true }
          case 'dragEnd':
            return { activeBlockPos: -1, isDragging: false }
          default:
            return pluginState
        }
      },
    },

    view(editorView) {
      // Create the handle element (not yet in the DOM)
      handleEl = document.createElement('div')
      handleEl.className = 'nc-doc-drag-handle'
      handleEl.innerHTML = GRIP_SVG
      handleEl.contentEditable = 'false'

      // Create the drop indicator line (not yet in the DOM)
      dropIndicatorEl = document.createElement('div')
      dropIndicatorEl.className = 'nc-doc-drop-indicator'

      let listenersAttached = false

      // --- Positioning ---

      const positionHandle = () => {
        if (!handleEl || !editorBody) return

        if (currentActivePos < 0 || isDragging) {
          handleEl.style.display = 'none'
          return
        }

        const node = editorView.state.doc.nodeAt(currentActivePos)
        if (!node) {
          handleEl.style.display = 'none'
          return
        }

        const blockDOM = editorView.nodeDOM(currentActivePos) as HTMLElement | null
        if (!blockDOM) {
          handleEl.style.display = 'none'
          return
        }

        const blockRect = blockDOM.getBoundingClientRect()
        const bodyRect = editorBody.getBoundingClientRect()

        // Vertically center handle with the first line of text.
        // For normal blocks (14px body, ~1.5 line-height ≈ 21px) the offset is small.
        // For headings (larger font + line-height) the offset is larger.
        const style = window.getComputedStyle(blockDOM)
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5
        const verticalOffset = (lineHeight - HANDLE_SIZE) / 2

        const top = blockRect.top - bodyRect.top + Math.max(0, verticalOffset)

        // Position handle to the left of the content area, far enough
        // to clear heading labels/chevrons (::before at right:100%).
        // Uniform offset for all block types so the handle column is aligned.
        const left = -(HANDLE_SIZE + HANDLE_GAP)

        handleEl.style.display = 'flex'
        handleEl.style.top = `${top}px`
        handleEl.style.left = `${left}px`
      }

      const positionDropIndicator = (clientY: number) => {
        if (!dropIndicatorEl || !editorBody) return

        const target = findDropTarget(editorView, clientY, dragSourceBlockPos)
        if (!target) {
          dropIndicatorEl.style.display = 'none'
          currentDropInsertPos = -1
          return
        }

        // Center the indicator line in the margin gap between blocks.
        const doc = editorView.state.doc
        const bodyRect = editorBody.getBoundingClientRect()
        let indicatorY: number

        const nodeAfter = doc.nodeAt(target.insertPos)
        if (nodeAfter) {
          const domAfter = editorView.nodeDOM(target.insertPos) as HTMLElement | null
          if (!domAfter) {
            dropIndicatorEl.style.display = 'none'
            currentDropInsertPos = -1
            return
          }
          const afterTop = domAfter.getBoundingClientRect().top

          // Find the block just before this one to get the gap's upper edge
          const posBefore = target.insertPos - 1
          if (posBefore >= 0) {
            const $before = doc.resolve(posBefore)
            const beforeBlockPos = $before.before(1)
            const domBefore = editorView.nodeDOM(beforeBlockPos) as HTMLElement | null
            if (domBefore) {
              const beforeBottom = domBefore.getBoundingClientRect().bottom
              // Midpoint of the gap
              indicatorY = (beforeBottom + afterTop) / 2 - bodyRect.top
            } else {
              indicatorY = afterTop - bodyRect.top - 1
            }
          } else {
            // First block in doc — place just above it
            indicatorY = afterTop - bodyRect.top - 1
          }
        } else {
          // Insert at end of doc — place just below the last block
          const lastPos = target.insertPos > 0 ? target.insertPos - 1 : 0
          const $last = doc.resolve(lastPos)
          const lastBlockPos = $last.before(1)
          const dom = editorView.nodeDOM(lastBlockPos) as HTMLElement | null
          if (!dom) {
            dropIndicatorEl.style.display = 'none'
            currentDropInsertPos = -1
            return
          }
          indicatorY = dom.getBoundingClientRect().bottom - bodyRect.top + 1
        }

        dropIndicatorEl.style.display = 'block'
        dropIndicatorEl.style.top = `${indicatorY}px`
        currentDropInsertPos = target.insertPos
      }

      const hideDropIndicator = () => {
        if (dropIndicatorEl) {
          dropIndicatorEl.style.display = 'none'
        }
        currentDropInsertPos = -1
      }

      // --- Mouse tracking (attached to editorInner, not ProseMirror) ---

      const onMouseMove = (event: MouseEvent) => {
        if (!editorView.editable) return
        if (isDragging) return
        // Skip when a mouse button is held (e.g. text selection in progress)
        // to avoid dispatching transactions that cause scroll jumps.
        if (event.buttons !== 0) return

        const pmRect = editorView.dom.getBoundingClientRect()

        // Gutter zone: from the left edge of editorBody to GUTTER_OVERLAP px
        // into the ProseMirror content area
        const gutterRight = pmRect.left + GUTTER_OVERLAP

        if (event.clientX > gutterRight) {
          // Past the gutter — hide handle
          if (currentActivePos >= 0) {
            currentActivePos = -1
            const tr = editorView.state.tr.setMeta(dragHandlePluginKey, {
              type: 'setActiveBlock',
              pos: -1,
            } as DragHandleMeta)
            editorView.dispatch(tr)
          }
          return
        }

        // Probe at a position just inside the ProseMirror content left edge
        // for reliable posAtCoords resolution
        const probeX = pmRect.left + 4
        const blockPos = resolveBlockAtCoords(editorView, probeX, event.clientY)

        // Only dispatch when the block changes
        if (blockPos === currentActivePos) return

        currentActivePos = blockPos
        const tr = editorView.state.tr.setMeta(dragHandlePluginKey, {
          type: 'setActiveBlock',
          pos: blockPos,
        } as DragHandleMeta)
        editorView.dispatch(tr)
      }

      const onMouseLeave = () => {
        if (isDragging) return
        if (currentActivePos >= 0) {
          currentActivePos = -1
          const tr = editorView.state.tr.setMeta(dragHandlePluginKey, {
            type: 'setActiveBlock',
            pos: -1,
          } as DragHandleMeta)
          editorView.dispatch(tr)
        }
      }

      // --- Manual drag handlers ---

      const finishDrag = () => {
        isDragging = false
        currentActivePos = -1
        dragMouseDownPos = null
        dragStarted = false
        dragSourceBlockPos = -1

        const tr = editorView.state.tr.setMeta(dragHandlePluginKey, {
          type: 'dragEnd',
        } as DragHandleMeta)
        editorView.dispatch(tr)
      }

      /** Try to set a NodeSelection on the block at `pos`, silently no-op on failure. */
      const setSelectionSafe = (tr: ReturnType<(typeof editorView.state.tr)['delete']>, pos: number) => {
        try {
          const $pos = tr.doc.resolve(pos)
          if ($pos.nodeAfter && NodeSelection.isSelectable($pos.nodeAfter)) {
            tr.setSelection(NodeSelection.create(tr.doc, pos))
          }
        } catch (_) {
          // Selection setting is best-effort — don't break the move
        }
      }

      const onDragMouseMove = (e: MouseEvent) => {
        if (!dragMouseDownPos) return

        // Check if we've moved past the threshold to start a real drag
        if (!dragStarted) {
          const dx = e.clientX - dragMouseDownPos.x
          const dy = e.clientY - dragMouseDownPos.y
          if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return

          // Start the drag
          dragStarted = true
          isDragging = true

          // Select the source block visually
          const nodeSelection = NodeSelection.create(editorView.state.doc, dragSourceBlockPos)
          const tr = editorView.state.tr.setSelection(nodeSelection)
          tr.setMeta(dragHandlePluginKey, { type: 'dragStart', pos: dragSourceBlockPos } as DragHandleMeta)
          editorView.dispatch(tr)

          // Add a body class for cursor override
          document.body.classList.add('nc-doc-dragging')
        }

        // Position the drop indicator
        positionDropIndicator(e.clientY)
      }

      const onDragMouseUp = () => {
        // Remove global listeners
        document.removeEventListener('mousemove', onDragMouseMove)
        document.removeEventListener('mouseup', onDragMouseUp)
        document.body.classList.remove('nc-doc-dragging')

        if (!dragStarted || dragSourceBlockPos < 0) {
          // Didn't drag far enough — treat as a click (no-op)
          dragMouseDownPos = null
          dragStarted = false
          dragSourceBlockPos = -1
          return
        }

        const insertPos = currentDropInsertPos
        hideDropIndicator()

        if (insertPos < 0) {
          finishDrag()
          return
        }

        const sourceNode = editorView.state.doc.nodeAt(dragSourceBlockPos)
        if (!sourceNode) {
          finishDrag()
          return
        }

        const sourceEnd = dragSourceBlockPos + sourceNode.nodeSize

        // Build the transaction using tr.mapping to track position shifts
        const tr = editorView.state.tr

        if (dragSourceBlockPos < insertPos) {
          // Source is before target — delete first, then insert at mapped position
          tr.delete(dragSourceBlockPos, sourceEnd)
          const mappedInsert = tr.mapping.map(insertPos)
          tr.insert(mappedInsert, sourceNode)

          // Select the moved block
          const finalPos = tr.mapping.map(mappedInsert)
          setSelectionSafe(tr, finalPos)
        } else {
          // Source is after target — insert first, then delete at mapped position
          tr.insert(insertPos, sourceNode)
          const mappedSource = tr.mapping.map(dragSourceBlockPos)
          tr.delete(mappedSource, mappedSource + sourceNode.nodeSize)

          // Select the moved block (insertPos is stable since it was before the delete)
          setSelectionSafe(tr, insertPos)
        }

        tr.setMeta(dragHandlePluginKey, { type: 'dragEnd' } as DragHandleMeta)
        editorView.dispatch(tr.scrollIntoView())

        // Reset drag state
        dragMouseDownPos = null
        dragStarted = false
        dragSourceBlockPos = -1
        isDragging = false
        currentActivePos = -1
      }

      const onHandleMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return // Only left click
        if (currentActivePos < 0) return

        e.preventDefault()
        e.stopPropagation()

        dragMouseDownPos = { x: e.clientX, y: e.clientY }
        dragStarted = false
        dragSourceBlockPos = currentActivePos

        // Attach global listeners for tracking drag movement
        document.addEventListener('mousemove', onDragMouseMove)
        document.addEventListener('mouseup', onDragMouseUp)
      }

      handleEl.addEventListener('mousedown', onHandleMouseDown)

      // --- Lazy init: attach handle + listeners once EditorContent mounts ---
      // view() runs during useEditor(), before <EditorContent> renders.
      // At that point editorView.dom has no parent in the document, so
      // .closest('.nc-doc-editor-body') returns null. We defer the DOM
      // attachment to the first update() call, when the view is mounted.

      const tryAttach = () => {
        if (listenersAttached) return
        editorBody = editorView.dom.closest('.nc-doc-editor-body') as HTMLElement | null
        editorInner = editorView.dom.closest('.nc-doc-editor-inner') as HTMLElement | null
        if (!editorBody || !editorInner || !handleEl || !dropIndicatorEl) return

        // Handle is positioned inside editorBody (which has position: relative)
        editorBody.appendChild(handleEl)
        editorBody.appendChild(dropIndicatorEl)
        // Mouse listeners on editorInner — its padding zone covers the gutter
        // where the handle is visually placed, so hover works seamlessly
        editorInner.addEventListener('mousemove', onMouseMove)
        editorInner.addEventListener('mouseleave', onMouseLeave)
        listenersAttached = true
      }

      return {
        update() {
          // Attach to DOM on first update after mount
          tryAttach()

          // Sync local tracking vars from plugin state (for position remapping)
          const state = dragHandlePluginKey.getState(editorView.state)
          if (state) {
            currentActivePos = state.activeBlockPos
            isDragging = state.isDragging
          }
          positionHandle()
        },
        destroy() {
          document.removeEventListener('mousemove', onDragMouseMove)
          document.removeEventListener('mouseup', onDragMouseUp)
          document.body.classList.remove('nc-doc-dragging')
          handleEl?.removeEventListener('mousedown', onHandleMouseDown)
          editorInner?.removeEventListener('mousemove', onMouseMove)
          editorInner?.removeEventListener('mouseleave', onMouseLeave)
          handleEl?.remove()
          dropIndicatorEl?.remove()
          handleEl = null
          dropIndicatorEl = null
          editorBody = null
          editorInner = null
          listenersAttached = false
        },
      }
    },
  })
}

// --- Extension wrapper ---

export const DocDragHandleExtension = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    return [createDragHandlePlugin()]
  },
})
