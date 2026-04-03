<script setup lang="ts">
/**
 * Table context menus for the doc editor.
 *
 * Renders overlay controls on the active table:
 * - Column handles (pill bars) above each header cell → dropdown with column ops
 * - Row handles (pill bars) left of each row → dropdown with row ops
 * - Circular table options icon at top-left corner
 *
 * Uses a hover-zone div covering table + gutters so mouse stays in zone.
 */
import type { Editor } from '@tiptap/vue-3'
import { TextSelection } from '@tiptap/pm/state'
import { CELL_BG_COLORS, TEXT_COLORS } from './DocColorConstants'

// px — gap between adjacent handles

const props = defineProps<{
  editor: Editor
}>()

const GUTTER = 16 // px — space for handles outside the table
const HANDLE_GAP = 1

const editor = toRef(props, 'editor')

// --- State ---
const tableEl = ref<HTMLTableElement | null>(null)
const editorBodyEl = ref<HTMLElement | null>(null)
const isHovering = ref(false)
const menuOpen = ref<{ type: 'column' | 'row' | 'table'; index: number } | null>(null)

// Position data
const colHandles = ref<Array<{ left: number; width: number }>>([])
const rowHandles = ref<Array<{ top: number; height: number }>>([])
const tableRect = ref({ top: 0, left: 0, width: 0, height: 0 })

const showControls = computed(() => tableEl.value && (isHovering.value || menuOpen.value))

const hoverZoneStyle = computed(() => ({
  position: 'absolute' as const,
  top: `${tableRect.value.top - GUTTER}px`,
  left: `${tableRect.value.left - GUTTER}px`,
  width: `${tableRect.value.width + GUTTER + 8}px`,
  height: `${tableRect.value.height + GUTTER + 8}px`,
}))

// --- Find the table DOM element from editor state ---
const findTableElement = (): HTMLTableElement | null => {
  if (!editor.value) return null
  const { selection } = editor.value.state
  const $pos = selection.$from
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'table') {
      const domNode = editor.value.view.nodeDOM($pos.before(d))
      if (domNode instanceof HTMLTableElement) return domNode
      if (domNode instanceof HTMLElement) {
        const table = domNode.querySelector('table') || domNode.closest('table')
        if (table) return table as HTMLTableElement
      }
      return null
    }
  }
  return null
}

// --- Calculate handle positions relative to editor body ---
const recalcPositions = () => {
  const table = tableEl.value
  const body = editorBodyEl.value
  if (!table || !body) return

  const bodyRect = body.getBoundingClientRect()
  const tRect = table.getBoundingClientRect()

  tableRect.value = {
    top: tRect.top - bodyRect.top,
    left: tRect.left - bodyRect.left,
    width: tRect.width,
    height: tRect.height,
  }

  const headerRow = table.querySelector('tr')
  if (headerRow) {
    const cells = Array.from(headerRow.children) as HTMLElement[]
    colHandles.value = cells.map((cell) => {
      const r = cell.getBoundingClientRect()
      return { left: r.left - bodyRect.left, width: r.width }
    })
  }

  const rows = Array.from(table.querySelectorAll('tr')) as HTMLElement[]
  rowHandles.value = rows.map((row) => {
    const r = row.getBoundingClientRect()
    return { top: r.top - bodyRect.top, height: r.height }
  })
}

// --- Focus a cell before running table commands ---
const focusCell = (rowIndex: number, colIndex: number) => {
  const table = tableEl.value
  if (!table || !table.isConnected || !editor.value) return
  const rows = table.querySelectorAll('tr')
  const row = rows[rowIndex]
  if (!row) return
  const cells = row.querySelectorAll('td, th')
  const cell = cells[colIndex]
  if (!cell) return
  const pos = editor.value.view.posAtDOM(cell, 0)
  editor.value.commands.setTextSelection(pos)
}

// --- Column operations ---
const columnCommands = { insertBefore: 'addColumnBefore', insertAfter: 'addColumnAfter', delete: 'deleteColumn' } as const
const rowCommands = { insertBefore: 'addRowBefore', insertAfter: 'addRowAfter', delete: 'deleteRow' } as const

const onColumnAction = (colIndex: number, action: keyof typeof columnCommands) => {
  menuOpen.value = null
  focusCell(0, colIndex)
  nextTick(() => {
    editor.value.chain().focus()[columnCommands[action]]().run()
  })
}

// --- Row operations ---
const onRowAction = (rowIndex: number, action: keyof typeof rowCommands) => {
  menuOpen.value = null
  focusCell(rowIndex, 0)
  nextTick(() => {
    editor.value.chain().focus()[rowCommands[action]]().run()
  })
}

// --- Move row up/down by swapping adjacent tableRow nodes ---
const onRowMove = (rowIndex: number, direction: 'up' | 'down') => {
  const table = tableEl.value
  if (!table || !table.isConnected || !editor.value) return

  const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1
  // Don't swap with header row (index 0) or beyond bounds
  if (targetIndex < 1 || targetIndex >= rowHandles.value.length) return

  // Resolve the table node position from the DOM
  const tablePos = editor.value.view.posAtDOM(table, 0)
  const $table = editor.value.state.doc.resolve(tablePos)
  let tableNodePos = -1
  for (let d = $table.depth; d > 0; d--) {
    if ($table.node(d).type.name === 'table') {
      tableNodePos = $table.before(d)
      break
    }
  }
  if (tableNodePos < 0) return

  const tableNode = editor.value.state.doc.nodeAt(tableNodePos)
  if (!tableNode || tableNode.type.name !== 'table') return

  // Get the two row nodes to swap
  const rows: Array<{ node: any; offset: number }> = []
  tableNode.forEach((child, offset) => {
    rows.push({ node: child, offset })
  })

  if (rowIndex >= rows.length || targetIndex >= rows.length) return

  const idxA = Math.min(rowIndex, targetIndex)
  const idxB = Math.max(rowIndex, targetIndex)
  const rowA = rows[idxA]
  const rowB = rows[idxB]

  // Build new row array with the two swapped
  const newRows = [...rows.map((r) => r.node)]
  newRows[idxA] = rowB.node
  newRows[idxB] = rowA.node

  // Create a new table node with swapped rows
  const newTable = tableNode.type.create(tableNode.attrs, newRows, tableNode.marks)

  const { state, dispatch } = editor.value.view
  const tr = state.tr
  // +1 because tableNodePos is before the table, content starts at tableNodePos
  tr.replaceWith(tableNodePos, tableNodePos + tableNode.nodeSize, newTable)

  // Place cursor in the moved row's first cell
  const newTableNode = tr.doc.nodeAt(tableNodePos)
  if (newTableNode) {
    let cellPos = tableNodePos + 1 // enter table content
    for (let i = 0; i < targetIndex; i++) {
      cellPos += newTableNode.child(i).nodeSize
    }
    // Enter the row, then the first cell
    cellPos += 1 // enter tableRow
    cellPos += 1 // enter first cell
    tr.setSelection(TextSelection.near(tr.doc.resolve(cellPos)))
  }

  dispatch(tr)

  menuOpen.value = null
  nextTick(() => recalcPositions())
}

// --- Move column left/right by swapping adjacent cells in every row ---
const onColumnMove = (colIndex: number, direction: 'left' | 'right') => {
  const table = tableEl.value
  if (!table || !table.isConnected || !editor.value) return

  const targetIndex = direction === 'left' ? colIndex - 1 : colIndex + 1
  if (targetIndex < 0 || targetIndex >= colHandles.value.length) return

  // Resolve the table node position from the DOM
  const tablePos = editor.value.view.posAtDOM(table, 0)
  const $table = editor.value.state.doc.resolve(tablePos)
  let tableNodePos = -1
  for (let d = $table.depth; d > 0; d--) {
    if ($table.node(d).type.name === 'table') {
      tableNodePos = $table.before(d)
      break
    }
  }
  if (tableNodePos < 0) return

  const tableNode = editor.value.state.doc.nodeAt(tableNodePos)
  if (!tableNode || tableNode.type.name !== 'table') return

  // Rebuild each row with the two columns swapped
  const newRows: any[] = []
  tableNode.forEach((row) => {
    const cells: any[] = []
    row.forEach((cell) => cells.push(cell))

    if (colIndex >= cells.length || targetIndex >= cells.length) {
      newRows.push(row)
      return
    }

    const newCells = [...cells]
    newCells[colIndex] = cells[targetIndex]
    newCells[targetIndex] = cells[colIndex]
    newRows.push(row.type.create(row.attrs, newCells, row.marks))
  })

  const newTable = tableNode.type.create(tableNode.attrs, newRows, tableNode.marks)

  const { state, dispatch } = editor.value.view
  const tr = state.tr
  tr.replaceWith(tableNodePos, tableNodePos + tableNode.nodeSize, newTable)

  // Place cursor in the moved column's header cell
  const newTableNode = tr.doc.nodeAt(tableNodePos)
  if (newTableNode) {
    let cellPos = tableNodePos + 1 // enter table
    cellPos += 1 // enter first row
    for (let c = 0; c < targetIndex; c++) {
      cellPos += newTableNode.child(0).child(c).nodeSize
    }
    cellPos += 1 // enter cell
    tr.setSelection(TextSelection.near(tr.doc.resolve(cellPos)))
  }

  dispatch(tr)

  menuOpen.value = null
  nextTick(() => recalcPositions())
}

// --- Column alignment ---
// Updates textAlign for every cell in the column using a single ProseMirror
// transaction to avoid position drift from multiple dispatches.
const onColumnAlign = (colIndex: number, align: 'left' | 'center' | 'right') => {
  const table = tableEl.value
  if (!table || !table.isConnected || !editor.value) return

  const { state, dispatch } = editor.value.view
  const tr = state.tr

  // Collect cell positions from live DOM before any doc mutations
  const rows = table.querySelectorAll('tr')
  const cellPositions: number[] = []
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td, th')
    const cell = cells[colIndex]
    if (!cell) return
    cellPositions.push(editor.value!.view.posAtDOM(cell, 0))
  })

  // Apply all attribute changes in a single transaction.
  // setNodeMarkup only changes attrs (no structural change), so positions remain stable.
  for (const pos of cellPositions) {
    const resolved = tr.doc.resolve(pos)
    for (let d = resolved.depth; d > 0; d--) {
      const node = resolved.node(d)
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        tr.setNodeMarkup(resolved.before(d), undefined, { ...node.attrs, textAlign: align })
        break
      }
    }
  }

  dispatch(tr)

  menuOpen.value = null
  focusCell(0, colIndex)
  nextTick(() => recalcPositions())
}

// --- Column colors ---
const onColumnCellAttr = (colIndex: number, attr: string, value: string | null) => {
  const table = tableEl.value
  if (!table || !table.isConnected || !editor.value) return

  const { state, dispatch } = editor.value.view
  const tr = state.tr

  const rows = table.querySelectorAll('tr')
  rows.forEach((row) => {
    const cell = row.querySelectorAll('td, th')[colIndex]
    if (!cell) return
    const pos = editor.value!.view.posAtDOM(cell, 0)
    const resolved = tr.doc.resolve(pos)
    for (let d = resolved.depth; d > 0; d--) {
      const node = resolved.node(d)
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        tr.setNodeMarkup(resolved.before(d), undefined, { ...node.attrs, [attr]: value })
        break
      }
    }
  })

  dispatch(tr)

  menuOpen.value = null
  nextTick(() => recalcPositions())
}

// --- Row vertical alignment ---
// Updates verticalAlign for every cell in the row using a single transaction.
const onRowVerticalAlign = (rowIndex: number, align: 'top' | 'middle' | 'bottom') => {
  const table = tableEl.value
  if (!table || !table.isConnected || !editor.value) return

  const { state, dispatch } = editor.value.view
  const tr = state.tr

  const rows = table.querySelectorAll('tr')
  const row = rows[rowIndex]
  if (!row) return

  const cells = row.querySelectorAll('td, th')
  const cellPositions: number[] = []
  cells.forEach((cell) => {
    cellPositions.push(editor.value!.view.posAtDOM(cell, 0))
  })

  for (const pos of cellPositions) {
    const resolved = tr.doc.resolve(pos)
    for (let d = resolved.depth; d > 0; d--) {
      const node = resolved.node(d)
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        tr.setNodeMarkup(resolved.before(d), undefined, { ...node.attrs, verticalAlign: align })
        break
      }
    }
  }

  dispatch(tr)

  menuOpen.value = null
  focusCell(rowIndex, 0)
  nextTick(() => recalcPositions())
}

// --- Column resize (drag between columns) ---
const MIN_COL_WIDTH = 60 // px
const resizeDrag = ref<{ colIndex: number; startX: number; startWidths: number[] } | null>(null)

const onResizeMouseDown = (colIndex: number, e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()

  const table = tableEl.value
  if (!table || !editor.value) return

  const headerRow = table.querySelector('tr')
  if (!headerRow) return

  const startWidths = Array.from(headerRow.children).map((cell) => (cell as HTMLElement).getBoundingClientRect().width)

  resizeDrag.value = { colIndex, startX: e.clientX, startWidths }

  // Track the latest computed widths for persistence on mouseup
  let finalWidths = [...startWidths]

  // Update colwidth attrs via ProseMirror transaction for live visual feedback.
  // Direct DOM style changes get reverted by ProseMirror's MutationObserver.
  const dispatchColwidths = () => {
    if (!editor.value || !tableEl.value) return

    const { state, dispatch } = editor.value.view
    const tr = state.tr

    const rows = tableEl.value.querySelectorAll('tr')
    rows.forEach((row) => {
      const rowCells = row.querySelectorAll('td, th')
      for (let ci = 0; ci < rowCells.length; ci++) {
        const cell = rowCells[ci]
        if (!cell) continue
        const pos = editor.value!.view.posAtDOM(cell, 0)
        const resolved = tr.doc.resolve(pos)
        for (let d = resolved.depth; d > 0; d--) {
          const node = resolved.node(d)
          if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
            tr.setNodeMarkup(resolved.before(d), undefined, {
              ...node.attrs,
              colwidth: [finalWidths[ci]],
            })
            break
          }
        }
      }
    })

    tr.setMeta('addToHistory', false)
    dispatch(tr)
  }

  const onMouseMove = (ev: MouseEvent) => {
    if (!resizeDrag.value) return

    const dx = ev.clientX - resizeDrag.value.startX

    finalWidths = startWidths.map((w, i) => {
      if (i === colIndex) return Math.max(MIN_COL_WIDTH, w + dx)
      if (i === colIndex + 1) return Math.max(MIN_COL_WIDTH, w - dx)
      return w
    })

    dispatchColwidths()
    recalcPositions()
  }

  // Suppress the click event that follows mouseup — prevents onEditorBodyClick from
  // calling focus('end') when the mouse releases over the editor body padding area.
  const suppressNextClick = (ev: MouseEvent) => {
    ev.stopPropagation()
    ev.preventDefault()
    document.removeEventListener('click', suppressNextClick, true)
  }

  const onMouseUp = (e: MouseEvent) => {
    e.preventDefault()
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    // Capture the click that fires after this mouseup so it doesn't reach the editor body
    document.addEventListener('click', suppressNextClick, true)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // Final dispatch with undo history so the resize is undoable.
    // During drag, dispatches used addToHistory:false to avoid flooding undo stack.
    if (resizeDrag.value && tableEl.value && editor.value) {
      const { state, dispatch } = editor.value.view
      const tr = state.tr

      const rows = tableEl.value.querySelectorAll('tr')
      rows.forEach((row) => {
        const rowCells = row.querySelectorAll('td, th')
        for (let ci = 0; ci < rowCells.length; ci++) {
          const cell = rowCells[ci]
          if (!cell) continue
          const pos = editor.value!.view.posAtDOM(cell, 0)
          const resolved = tr.doc.resolve(pos)
          for (let d = resolved.depth; d > 0; d--) {
            const node = resolved.node(d)
            if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
              tr.setNodeMarkup(resolved.before(d), undefined, {
                ...node.attrs,
                colwidth: [Math.round(finalWidths[ci])],
              })
              break
            }
          }
        }
      })

      dispatch(tr)
    }

    resizeDrag.value = null
    nextTick(() => recalcPositions())
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

// --- Distribute columns evenly ---
const onDistributeColumns = () => {
  menuOpen.value = null

  const table = tableEl.value
  if (!table || !editor.value) return

  const { state, dispatch } = editor.value.view
  const tr = state.tr

  // Clear colwidth on every cell → table-layout:fixed distributes equally
  const rows = table.querySelectorAll('tr')
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td, th')
    cells.forEach((cell) => {
      const pos = editor.value!.view.posAtDOM(cell, 0)
      const resolved = tr.doc.resolve(pos)
      for (let d = resolved.depth; d > 0; d--) {
        const node = resolved.node(d)
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          if (node.attrs.colwidth) {
            tr.setNodeMarkup(resolved.before(d), undefined, { ...node.attrs, colwidth: null })
          }
          break
        }
      }
    })
  })

  dispatch(tr)
  nextTick(() => recalcPositions())
}

// --- Delete table ---
const onDeleteTable = () => {
  menuOpen.value = null
  editor.value.chain().focus().deleteTable().run()
}

// --- Toggle menu ---
const toggleMenu = (type: 'column' | 'row' | 'table', index: number) => {
  if (menuOpen.value?.type === type && menuOpen.value?.index === index) {
    menuOpen.value = null
  } else {
    menuOpen.value = { type, index }
  }
}

const closeMenu = () => {
  menuOpen.value = null
}

// --- Mouse tracking ---
// Check if a mouse position is within the table + gutter zone
const isInTableZone = (e: MouseEvent): boolean => {
  const table = tableEl.value
  const body = editorBodyEl.value
  if (!table || !body) return false
  const tRect = table.getBoundingClientRect()
  return (
    e.clientX >= tRect.left - GUTTER &&
    e.clientX <= tRect.right + 8 &&
    e.clientY >= tRect.top - GUTTER &&
    e.clientY <= tRect.bottom + 8
  )
}

const onEditorMouseMove = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  const table = target.closest?.('table')

  if (table) {
    if (table !== tableEl.value) {
      tableEl.value = table as HTMLTableElement
      recalcPositions()
    }
    isHovering.value = true
  } else if (tableEl.value && isInTableZone(e)) {
    // Mouse is in the gutter area outside the table but within handle zone
    isHovering.value = true
  } else {
    isHovering.value = false
  }
}

const onEditorMouseLeave = () => {
  isHovering.value = false
}

let unregisterTransaction: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null

// Re-observe when the tracked table element changes
watch(tableEl, (newTable, oldTable) => {
  if (oldTable && resizeObserver) resizeObserver.unobserve(oldTable)
  if (newTable && resizeObserver) resizeObserver.observe(newTable)
})

const initListeners = () => {
  const bodyEl = editorBodyEl.value
  if (!bodyEl) return
  bodyEl.addEventListener('mousemove', onEditorMouseMove)
  bodyEl.addEventListener('mouseleave', onEditorMouseLeave)
}

onMounted(() => {
  // Prefer DOM traversal from the editor view; fall back to querySelector
  // in case EditorContent hasn't fully attached editor.view.dom yet.
  editorBodyEl.value =
    (editor.value.view.dom.closest('.nc-doc-editor-body') as HTMLElement) ||
    (document.querySelector('.nc-doc-editor-body') as HTMLElement)

  // If closest() failed (timing edge case), retry on next tick
  if (!editorBodyEl.value) {
    nextTick(() => {
      editorBodyEl.value =
        (editor.value.view.dom.closest('.nc-doc-editor-body') as HTMLElement) ||
        (document.querySelector('.nc-doc-editor-body') as HTMLElement)
      initListeners()
    })
  }

  unregisterTransaction = (() => {
    const handler = () => {
      // If cursor moved into a (different) table, adopt it
      const newTable = findTableElement()
      if (newTable) {
        if (newTable !== tableEl.value) {
          tableEl.value = newTable
        }
        recalcPositions()
      } else if (tableEl.value) {
        // Table was deleted from the DOM — clean up
        if (!tableEl.value.isConnected) {
          tableEl.value = null
        } else {
          // Cursor left table but DOM element still exists — recalc positions only.
          // Do NOT null tableEl here: that would destroy the hover zone while
          // the user is interacting with handle menus outside the table.
          recalcPositions()
        }
      }
    }
    editor.value.on('transaction', handler)
    return () => editor.value.off('transaction', handler)
  })()

  // ResizeObserver catches dimension changes not triggered by editor transactions
  // (e.g. window resize, font loading)
  resizeObserver = new ResizeObserver(() => recalcPositions())
  if (tableEl.value) resizeObserver.observe(tableEl.value)

  initListeners()
})

onBeforeUnmount(() => {
  unregisterTransaction?.()
  resizeObserver?.disconnect()
  resizeObserver = null
  const bodyEl = editorBodyEl.value
  if (bodyEl) {
    bodyEl.removeEventListener('mousemove', onEditorMouseMove)
    bodyEl.removeEventListener('mouseleave', onEditorMouseLeave)
  }
})
</script>

<template>
  <!-- Hover zone: covers table + handle gutters as one continuous area -->
  <div v-if="tableEl" class="nc-table-hover-zone" :class="{ 'is-visible': showControls }" :style="hoverZoneStyle">
    <template v-if="showControls">
      <!-- ═══ Table options: circular icon at top-left corner ═══ -->
      <NcDropdown
        :visible="menuOpen?.type === 'table'"
        placement="bottomLeft"
        @update:visible="(v: boolean) => { if (!v) closeMenu() }"
      >
        <div
          class="nc-table-corner-handle"
          :style="{ top: `${GUTTER - 10}px`, left: `${GUTTER - 10}px` }"
          @click.stop="toggleMenu('table', 0)"
        />
        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem @click="onDistributeColumns">
              <GeneralIcon icon="ncColumns" />
              {{ $t('labels.distributeColumnsEvenly') }}
            </NcMenuItem>
            <NcDivider />
            <NcMenuItem danger @click="onDeleteTable">
              <GeneralIcon icon="delete" />
              {{ $t('labels.deleteTable') }}
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>

      <!-- ═══ Column handles ═══ -->
      <template v-for="(col, cIdx) in colHandles" :key="`col-${cIdx}`">
        <!-- Column handle pill -->
        <NcDropdown
          :visible="menuOpen?.type === 'column' && menuOpen?.index === cIdx"
          placement="bottomLeft"
          overlay-class-name="nc-table-col-dropdown-overlay"
          @update:visible="(v: boolean) => { if (!v) closeMenu() }"
        >
          <div
            class="nc-table-col-handle"
            :class="[
              {
                'is-first': cIdx === 0,
                'is-last': cIdx === colHandles.length - 1,
                'is-only': colHandles.length === 1,
              },
            ]"
            :style="{
              top: `${GUTTER - 10}px`,
              left: `${col.left - tableRect.left + GUTTER + (cIdx > 0 ? HANDLE_GAP : 0)}px`,
              width: `${col.width - (cIdx > 0 ? HANDLE_GAP : 0) - (cIdx < colHandles.length - 1 ? HANDLE_GAP : 0)}px`,
            }"
            @click.stop="toggleMenu('column', cIdx)"
          />
          <template #overlay>
            <div class="nc-table-col-toolbar">
              <!-- Insert -->
              <NcTooltip :title="$t('labels.insertColumnLeft')">
                <NcButton
                  icon-only
                  size="xsmall"
                  type="text"
                  data-testid="nc-docs-table-column-insert-left"
                  @click="onColumnAction(cIdx, 'insertBefore')"
                >
                  <template #icon><GeneralIcon icon="ncInsertColumnLeft" /></template>
                </NcButton>
              </NcTooltip>
              <NcTooltip :title="$t('labels.insertColumnRight')">
                <NcButton
                  icon-only
                  size="xsmall"
                  type="text"
                  data-testid="nc-docs-table-column-insert-right"
                  @click="onColumnAction(cIdx, 'insertAfter')"
                >
                  <template #icon><GeneralIcon icon="ncInsertColumnRight" /></template>
                </NcButton>
              </NcTooltip>

              <div class="nc-table-col-toolbar-divider" />

              <!-- Move -->
              <NcTooltip v-if="cIdx > 0" :title="$t('labels.moveColumnLeft')">
                <NcButton
                  icon-only
                  size="xsmall"
                  type="text"
                  data-testid="nc-docs-table-column-move-left"
                  @click="onColumnMove(cIdx, 'left')"
                >
                  <template #icon><GeneralIcon icon="ncMoveColumnLeft" /></template>
                </NcButton>
              </NcTooltip>
              <NcTooltip v-if="cIdx < colHandles.length - 1" :title="$t('labels.moveColumnRight')">
                <NcButton
                  icon-only
                  size="xsmall"
                  type="text"
                  data-testid="nc-docs-table-column-move-right"
                  @click="onColumnMove(cIdx, 'right')"
                >
                  <template #icon><GeneralIcon icon="ncMoveColumnRight" /></template>
                </NcButton>
              </NcTooltip>

              <div class="nc-table-col-toolbar-divider" />

              <!-- Align -->
              <NcTooltip :title="$t('labels.alignLeft')">
                <NcButton icon-only size="xsmall" type="text" @click="onColumnAlign(cIdx, 'left')">
                  <template #icon><GeneralIcon icon="ncAlignLeft" /></template>
                </NcButton>
              </NcTooltip>
              <NcTooltip :title="$t('labels.alignCenter')">
                <NcButton icon-only size="xsmall" type="text" @click="onColumnAlign(cIdx, 'center')">
                  <template #icon><GeneralIcon icon="ncAlignCenter" /></template>
                </NcButton>
              </NcTooltip>
              <NcTooltip :title="$t('labels.alignRight')">
                <NcButton icon-only size="xsmall" type="text" @click="onColumnAlign(cIdx, 'right')">
                  <template #icon><GeneralIcon icon="ncAlignRight" /></template>
                </NcButton>
              </NcTooltip>

              <div class="nc-table-col-toolbar-divider" />

              <!-- Color -->
              <NcDropdown :trigger="['click']" placement="bottomLeft" overlay-class-name="nc-table-col-color-overlay">
                <NcButton icon-only size="xsmall" type="text">
                  <template #icon><GeneralIcon icon="ncPalette" /></template>
                </NcButton>
                <template #overlay>
                  <DocColorPicker
                    :text-colors="TEXT_COLORS"
                    :bg-colors="CELL_BG_COLORS"
                    @text-color="(c) => onColumnCellAttr(cIdx, 'cellTextColor', c)"
                    @bg-color="(c) => onColumnCellAttr(cIdx, 'bgColor', c)"
                  />
                </template>
              </NcDropdown>

              <div class="nc-table-col-toolbar-divider" />

              <!-- Delete -->
              <NcTooltip :title="$t('labels.deleteColumn')">
                <NcButton
                  icon-only
                  size="xsmall"
                  type="text"
                  class="!text-red-500 !hover:text-red-600"
                  data-testid="nc-docs-table-column-delete"
                  @click="onColumnAction(cIdx, 'delete')"
                >
                  <template #icon><GeneralIcon icon="delete" /></template>
                </NcButton>
              </NcTooltip>
            </div>
          </template>
        </NcDropdown>
      </template>

      <!-- ═══ Column resize grips (between adjacent columns) ═══ -->
      <template v-for="(col, cIdx) in colHandles.slice(0, -1)" :key="`resize-${cIdx}`">
        <div
          class="nc-table-col-resize-grip"
          :style="{
            top: `${GUTTER}px`,
            left: `${col.left + col.width - tableRect.left + GUTTER - 3}px`,
            height: `${tableRect.height}px`,
          }"
          @mousedown.stop="onResizeMouseDown(cIdx, $event)"
        />
      </template>

      <!-- ═══ Row handles ═══ -->
      <template v-for="(row, rIdx) in rowHandles" :key="`row-${rIdx}`">
        <!-- Row handle pill -->
        <NcDropdown
          :visible="menuOpen?.type === 'row' && menuOpen?.index === rIdx"
          placement="bottomLeft"
          overlay-class-name="nc-table-row-dropdown-overlay"
          @update:visible="(v: boolean) => { if (!v) closeMenu() }"
        >
          <div
            class="nc-table-row-handle"
            :class="[
              {
                'is-first': rIdx === 0,
                'is-last': rIdx === rowHandles.length - 1,
                'is-only': rowHandles.length === 1,
              },
            ]"
            :style="{
              top: `${row.top - tableRect.top + GUTTER + (rIdx > 0 ? HANDLE_GAP : 0)}px`,
              left: `${GUTTER - 10}px`,
              height: `${row.height - (rIdx > 0 ? HANDLE_GAP : 0) - (rIdx < rowHandles.length - 1 ? HANDLE_GAP : 0)}px`,
            }"
            @click.stop="toggleMenu('row', rIdx)"
          />
          <template #overlay>
            <div class="nc-table-row-toolbar">
              <NcTooltip v-if="rIdx > 0" :title="$t('labels.insertRowAbove')" placement="right">
                <NcButton
                  icon-only
                  size="xsmall"
                  type="text"
                  data-testid="nc-docs-table-row-insert-above"
                  @click="onRowAction(rIdx, 'insertBefore')"
                >
                  <template #icon><GeneralIcon icon="ncInsertRowAbove" /></template>
                </NcButton>
              </NcTooltip>
              <NcTooltip :title="$t('labels.insertRowBelow')" placement="right">
                <NcButton
                  icon-only
                  size="xsmall"
                  type="text"
                  data-testid="nc-docs-table-row-insert-below"
                  @click="onRowAction(rIdx, 'insertAfter')"
                >
                  <template #icon><GeneralIcon icon="ncInsertRowBelow" /></template>
                </NcButton>
              </NcTooltip>

              <template v-if="rIdx >= 1">
                <div class="nc-table-row-toolbar-divider" />

                <NcTooltip v-if="rIdx >= 2" :title="$t('labels.moveRowUp')" placement="right">
                  <NcButton
                    icon-only
                    size="xsmall"
                    type="text"
                    data-testid="nc-docs-table-row-move-up"
                    @click="onRowMove(rIdx, 'up')"
                  >
                    <template #icon><GeneralIcon icon="ncMoveRowUp" /></template>
                  </NcButton>
                </NcTooltip>
                <NcTooltip v-if="rIdx < rowHandles.length - 1" :title="$t('labels.moveRowDown')" placement="right">
                  <NcButton
                    icon-only
                    size="xsmall"
                    type="text"
                    data-testid="nc-docs-table-row-move-down"
                    @click="onRowMove(rIdx, 'down')"
                  >
                    <template #icon><GeneralIcon icon="ncMoveRowDown" /></template>
                  </NcButton>
                </NcTooltip>
              </template>

              <div class="nc-table-row-toolbar-divider" />

              <!-- Vertical Align -->
              <NcTooltip :title="$t('labels.alignTop')" placement="right">
                <NcButton icon-only size="xsmall" type="text" @click="onRowVerticalAlign(rIdx, 'top')">
                  <template #icon><GeneralIcon icon="ncVerticalAlignTop" /></template>
                </NcButton>
              </NcTooltip>
              <NcTooltip :title="$t('labels.alignMiddle')" placement="right">
                <NcButton icon-only size="xsmall" type="text" @click="onRowVerticalAlign(rIdx, 'middle')">
                  <template #icon><GeneralIcon icon="ncVerticalAlignCenter" /></template>
                </NcButton>
              </NcTooltip>
              <NcTooltip :title="$t('labels.alignBottom')" placement="right">
                <NcButton icon-only size="xsmall" type="text" @click="onRowVerticalAlign(rIdx, 'bottom')">
                  <template #icon><GeneralIcon icon="ncVerticalAlignBottom" /></template>
                </NcButton>
              </NcTooltip>

              <div class="nc-table-row-toolbar-divider" />

              <NcTooltip :title="$t('labels.deleteRow')" placement="right">
                <NcButton
                  icon-only
                  size="xsmall"
                  type="text"
                  class="!text-red-500 !hover:text-red-600"
                  data-testid="nc-docs-table-row-delete"
                  @click="onRowAction(rIdx, 'delete')"
                >
                  <template #icon><GeneralIcon icon="delete" /></template>
                </NcButton>
              </NcTooltip>
            </div>
          </template>
        </NcDropdown>
      </template>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-table-hover-zone {
  // Let clicks pass through to the table below; only handles intercept
  pointer-events: none;
  z-index: 10;
}

// All interactive children receive pointer-events
.nc-table-corner-handle,
.nc-table-col-handle,
.nc-table-row-handle,
.nc-table-col-resize-grip {
  pointer-events: auto;
}

// Column resize grip — invisible drag zone between columns
.nc-table-col-resize-grip {
  position: absolute;
  width: 7px;
  cursor: col-resize;
  z-index: 15;

  &::after {
    content: '';
    position: absolute;
    left: 2px;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: 1.5px;
    background: transparent;
    transition: background 0.15s ease;
  }

  &:hover::after,
  &:active::after {
    background: var(--nc-fill-primary);
  }
}

// Filled circle at top-left corner — proportionate to 8px handle bars
.nc-table-corner-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  cursor: pointer;
  background: var(--nc-border-gray-medium);
  transition: background 0.15s ease;

  // Expand clickable area around the small circle
  &::before {
    content: '';
    position: absolute;
    top: -4px;
    bottom: -4px;
    left: -4px;
    right: -4px;
  }

  &:hover {
    background: var(--nc-content-brand);
  }
}

// Column handle — horizontal bar segment
.nc-table-col-handle {
  position: absolute;
  height: 8px;
  border-radius: 0;
  cursor: pointer;
  background: var(--nc-border-gray-medium);
  transition: background 0.15s ease;

  // Expand clickable area vertically without changing visual size
  &::before {
    content: '';
    position: absolute;
    top: -6px;
    bottom: -6px;
    left: 0;
    right: 0;
  }

  &.is-first {
    border-radius: 4px 0 0 4px;
  }

  &.is-last {
    border-radius: 0 4px 4px 0;
  }

  &.is-only {
    border-radius: 4px;
  }

  &:hover {
    background: var(--nc-content-brand);
  }
}

// Row handle — vertical bar segment
.nc-table-row-handle {
  position: absolute;
  width: 8px;
  border-radius: 0;
  cursor: pointer;
  background: var(--nc-border-gray-medium);
  transition: background 0.15s ease;

  // Expand clickable area horizontally without changing visual size
  &::before {
    content: '';
    position: absolute;
    left: -6px;
    right: -6px;
    top: 0;
    bottom: 0;
  }

  &.is-first {
    border-radius: 4px 4px 0 0;
  }

  &.is-last {
    border-radius: 0 0 4px 4px;
  }

  &.is-only {
    border-radius: 4px;
  }

  &:hover {
    background: var(--nc-content-brand);
  }
}

// Override NcDropdown overlays for compact toolbars — fit content
:global(.nc-table-row-dropdown-overlay) {
  width: auto !important;
  min-width: 0 !important;

  .ant-dropdown-menu {
    padding: 0;
  }
}

:global(.nc-table-col-dropdown-overlay) {
  width: auto !important;
  min-width: 0 !important;

  .ant-dropdown-menu {
    padding: 0;
  }
}

// Horizontal icon-only toolbar for column operations
.nc-table-col-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  white-space: nowrap;
}

.nc-table-col-toolbar-divider {
  width: 1px;
  height: 16px;
  background: var(--nc-border-gray-medium);
  margin: 0 2px;
  flex-shrink: 0;
}

// Vertical icon-only toolbar for row operations
.nc-table-row-toolbar {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px;
}

.nc-table-row-toolbar-divider {
  height: 1px;
  width: 16px;
  background: var(--nc-border-gray-medium);
  margin: 2px 0;
  flex-shrink: 0;
}

// Color picker overlay — fit content
:global(.nc-table-col-color-overlay) {
  width: auto !important;
  min-width: 0 !important;

  .ant-dropdown-menu {
    padding: 0;
  }
}
</style>
