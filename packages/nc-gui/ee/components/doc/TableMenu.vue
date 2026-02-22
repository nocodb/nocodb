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
  if (!table || !editor.value) return
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

let unregisterTransaction: (() => void) | null = null

onMounted(() => {
  editorBodyEl.value =
    (editor.value.view.dom.closest('.nc-doc-editor-body') as HTMLElement) ||
    (document.querySelector('.nc-doc-editor-body') as HTMLElement)

  unregisterTransaction = (() => {
    const handler = () => {
      const newTable = findTableElement()
      if (newTable) {
        if (newTable !== tableEl.value) {
          tableEl.value = newTable
        }
        recalcPositions()
      } else if (tableEl.value && !isHovering.value && !menuOpen.value) {
        tableEl.value = null
      } else if (tableEl.value) {
        recalcPositions()
      }
    }
    editor.value.on('transaction', handler)
    return () => editor.value.off('transaction', handler)
  })()

  const bodyEl = editorBodyEl.value
  if (bodyEl) {
    bodyEl.addEventListener('mousemove', onEditorMouseMove)
    bodyEl.addEventListener('mouseleave', () => { isHovering.value = false })
  }
})

onBeforeUnmount(() => {
  unregisterTransaction?.()
  const bodyEl = editorBodyEl.value
  if (bodyEl) {
    bodyEl.removeEventListener('mousemove', onEditorMouseMove)
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
              Delete table
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
            <NcMenu variant="small">
              <NcMenuItem @click="onColumnAction(cIdx, 'insertBefore')">
                <GeneralIcon icon="plus" class="text-nc-content-gray-subtle" />
                Insert column left
              </NcMenuItem>
              <NcMenuItem @click="onColumnAction(cIdx, 'insertAfter')">
                <GeneralIcon icon="plus" class="text-nc-content-gray-subtle" />
                Insert column right
              </NcMenuItem>
              <NcDivider />
              <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="onColumnAction(cIdx, 'delete')">
                <GeneralIcon icon="delete" />
                Delete column
              </NcMenuItem>
            </NcMenu>
          </template>
        </NcDropdown>
      </template>

      <!-- ═══ Row handles ═══ -->
      <template v-for="(row, rIdx) in rowHandles" :key="`row-${rIdx}`">
        <!-- Row handle pill -->
        <NcDropdown
          :visible="menuOpen?.type === 'row' && menuOpen?.index === rIdx"
          placement="bottomLeft"
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
            <NcMenu variant="small">
              <NcMenuItem v-if="rIdx > 0" @click="onRowAction(rIdx, 'insertBefore')">
                <GeneralIcon icon="plus" class="text-nc-content-gray-subtle" />
                Insert row above
              </NcMenuItem>
              <NcMenuItem @click="onRowAction(rIdx, 'insertAfter')">
                <GeneralIcon icon="plus" class="text-nc-content-gray-subtle" />
                Insert row below
              </NcMenuItem>
              <NcDivider />
              <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="onRowAction(rIdx, 'delete')">
                <GeneralIcon icon="delete" />
                Delete row
              </NcMenuItem>
            </NcMenu>
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
.nc-table-context-btn {
  pointer-events: auto;
}

// Filled circle at top-left corner — proportionate to 8px handle bars
.nc-table-corner-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  cursor: pointer;
  background: #e5e7eb;
  transition: background 0.15s ease;

  &:hover {
    background: #3366ff;
  }
}

// Column handle — horizontal bar segment
.nc-table-col-handle {
  position: absolute;
  height: 8px;
  border-radius: 0;
  cursor: pointer;
  background: #e5e7eb;
  transition: background 0.15s ease;

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
    background: #3366ff;
  }
}

// Row handle — vertical bar segment
.nc-table-row-handle {
  position: absolute;
  width: 8px;
  border-radius: 0;
  cursor: pointer;
  background: #e5e7eb;
  transition: background 0.15s ease;

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
    background: #3366ff;
  }
}

</style>
