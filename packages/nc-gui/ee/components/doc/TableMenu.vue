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

const GUTTER = 16 // px — space for handles outside the table
const HANDLE_GAP = 1 // px — gap between adjacent handles

const props = defineProps<{
  editor: Editor
}>()

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

const onEditorMouseLeave = () => { isHovering.value = false }

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
  <div
    v-if="tableEl"
    class="nc-table-hover-zone"
    :class="{ 'is-visible': showControls }"
    :style="hoverZoneStyle"
  >
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
            <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="onDeleteTable">
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
            :class="['nc-table-col-handle', {
              'is-first': cIdx === 0,
              'is-last': cIdx === colHandles.length - 1,
              'is-only': colHandles.length === 1,
            }]"
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
                <NcButton icon-only size="xsmall" type="text" data-testid="nc-docs-table-column-insert-left" @click="onColumnAction(cIdx, 'insertBefore')">
                  <template #icon><GeneralIcon icon="ncInsertColumnLeft" /></template>
                </NcButton>
              </NcTooltip>
              <NcTooltip :title="$t('labels.insertColumnRight')">
                <NcButton icon-only size="xsmall" type="text" data-testid="nc-docs-table-column-insert-right" @click="onColumnAction(cIdx, 'insertAfter')">
                  <template #icon><GeneralIcon icon="ncInsertColumnRight" /></template>
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

              <!-- Delete -->
              <NcTooltip :title="$t('labels.deleteColumn')">
                <NcButton icon-only size="xsmall" type="text" class="!text-red-500 !hover:text-red-600" data-testid="nc-docs-table-column-delete" @click="onColumnAction(cIdx, 'delete')">
                  <template #icon><GeneralIcon icon="delete" /></template>
                </NcButton>
              </NcTooltip>
            </div>
          </template>
        </NcDropdown>
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
            :class="['nc-table-row-handle', {
              'is-first': rIdx === 0,
              'is-last': rIdx === rowHandles.length - 1,
              'is-only': rowHandles.length === 1,
            }]"
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
                <NcButton icon-only size="xsmall" type="text" data-testid="nc-docs-table-row-insert-above" @click="onRowAction(rIdx, 'insertBefore')">
                  <template #icon><GeneralIcon icon="ncChevronUp" /></template>
                </NcButton>
              </NcTooltip>
              <NcTooltip :title="$t('labels.insertRowBelow')" placement="right">
                <NcButton icon-only size="xsmall" type="text" data-testid="nc-docs-table-row-insert-below" @click="onRowAction(rIdx, 'insertAfter')">
                  <template #icon><GeneralIcon icon="ncChevronDown" /></template>
                </NcButton>
              </NcTooltip>

              <div class="nc-table-row-toolbar-divider" />

              <NcTooltip :title="$t('labels.deleteRow')" placement="right">
                <NcButton icon-only size="xsmall" type="text" class="!text-red-500 !hover:text-red-600" data-testid="nc-docs-table-row-delete" @click="onRowAction(rIdx, 'delete')">
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
.nc-table-row-handle {
  pointer-events: auto;
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

</style>
