<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { EditorState, Transaction } from 'prosemirror-state'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import {
  CellSelection,
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn as deleteColumnTiptap,
  goToNextCell,
} from '@tiptap/prosemirror-tables'

const { getPos, editor } = defineProps(nodeViewProps)

const isFirstCell = ref(false)
const isFirstRowCell = ref(false)
const isSingleColumn = ref(false)
const showRowOptions = ref(false)
const showColumnOptions = ref(false)
const cellRef = ref()

const isPublic = !editor.view.editable

const selectColumn = async (tr: Transaction) => {
  const state: EditorState = editor.state
  const pos = getPos()

  tr.setSelection(TextSelection.create(editor.state.doc, pos + 1, pos + 1))

  // Select the column node
  tr.setSelection(NodeSelection.create(state.doc, pos))

  const selection = CellSelection.colSelection(state.doc.resolve(pos))
  tr.setSelection(selection as any)
}

const toggleColumnSelection = () => {
  showColumnOptions.value = !showColumnOptions.value
}

const deleteColumn = () => {
  const tr = editor.state.tr

  selectColumn(tr)

  deleteColumnTiptap(editor.state, editor.view.dispatch)

  // Focus the previous column header
  setTimeout(() => {
    goToNextCell(-1)(editor.state, editor.view.dispatch)

    setTimeout(() => {
      editor
        .chain()
        .command(({ state, commands }) => {
          return commands.setTextSelection(state.selection.to)
        })
        .run()
    }, 0)
  }, 0)
}

const insertColumnBefore = () => {
  const tr = editor.state.tr

  selectColumn(tr)

  addColumnBefore(editor.state, editor.view.dispatch)
  // focus the created column
  setTimeout(() => {
    goToNextCell(-1)(editor.state, editor.view.dispatch)
  }, 0)
}

const insertColumnAfter = () => {
  const tr = editor.state.tr

  selectColumn(tr)

  addColumnAfter(editor.state, editor.view.dispatch)
  // focus the created column
  setTimeout(() => {
    goToNextCell(1)(editor.state, editor.view.dispatch)
  }, 0)
}

const selectRow = (tr: Transaction) => {
  tr.setSelection(TextSelection.create(editor.state.doc, getPos() + 1, getPos() + 1))

  const state: EditorState = editor.state
  const pos = getPos() - 1

  // Select the row node
  tr.setSelection(NodeSelection.create(state.doc, pos))
}

const toggleRowSelection = () => {
  showRowOptions.value = !showRowOptions.value
}

const deleteRow = () => {
  const state: EditorState = editor.state
  const parentRow = state.doc.resolve(getPos()).parent

  const pos = getPos() - parentRow.nodeSize + 1

  editor.chain().deleteRow().setTextSelection(pos).run()
}

const insertRowBefore = () => {
  const state: EditorState = editor.state
  const tr = state.tr
  const { from } = state.selection
  const parentRow = state.doc.resolve(getPos()).parent

  toggleRowSelection()
  selectRow(tr)
  tr.setSelection(TextSelection.create(editor.state.doc, from + 1, from + 1))

  addRowBefore(editor.state, editor.view.dispatch)

  const cellCount = parentRow.childCount
  for (let i = 0; i < cellCount; i++) {
    setTimeout(() => {
      goToNextCell(-1)(editor.state, editor.view.dispatch)
    }, 0)
  }
}

const insertRowAfter = () => {
  const state: EditorState = editor.state
  const tr = state.tr
  const { from } = state.selection
  const parentRow = state.doc.resolve(getPos()).parent

  toggleRowSelection()
  selectRow(tr)

  tr.setSelection(TextSelection.create(editor.state.doc, from + 1, from + 1))
  addRowAfter(editor.state, editor.view.dispatch)

  const cellCount = parentRow.childCount
  for (let i = 0; i < cellCount; i++) {
    setTimeout(() => {
      goToNextCell(1)(editor.state, editor.view.dispatch)
    }, 0)
  }
}

onMounted(() => {
  const el = cellRef.value as HTMLElement
  const rowDom = el?.parentElement
  // check if the cell is the first cell in the row
  isFirstCell.value = rowDom?.previousElementSibling === null

  isFirstRowCell.value = rowDom?.parentElement?.previousElementSibling === null
})
</script>

<template>
  <NodeViewWrapper class="vue-component group relative p-0" as="td">
    <div ref="cellRef" class="group tiptap-table-cell overflow-visible flex">
      <div
        v-if="isFirstCell && !isPublic && !isFirstRowCell"
        class="flex flex-col justify-center absolute h-full -left-3 z-50 min-w-4 min-h-4 !group-[.tiptap-table-cell]:hover:opacity-100"
      >
        <div
          class="absolute flex border-gray-200 border-1 bg-white hover:bg-gray-100 py-0.5 rounded-md row-drag-handle hidden cursor-pointer"
          contenteditable="false"
          data-testid="nc-docs-table-row-drag-handle-wrapper"
          @mouseenter="toggleRowSelection"
          @mouseleave="toggleRowSelection"
        >
          <MdiDotsVertical class="row-drag-handle-button" />

          <template v-if="showRowOptions">
            <div
              class="absolute flex flex-col text-sm gap-y-1 -left-10 -top-7 bg-gray-100 p-1 rounded-md row-drag-handle hidden z-10"
            >
              <a-tooltip title="Add row above" placement="left" overlay-class-name="docs-table-row-options ">
                <div class="button" data-testid="nc-docs-table-row-insert-above" @click="insertRowBefore">
                  <MdiArrowUp />
                </div>
              </a-tooltip>
              <a-tooltip title="Delete row" placement="left" overlay-class-name="docs-table-row-options ">
                <div class="button !hover:text-red-400" data-testid="nc-docs-table-row-delete" @click="deleteRow">
                  <MdiDeleteOutline />
                </div>
              </a-tooltip>
              <a-tooltip title="Add row below" placement="left" overlay-class-name="docs-table-row-options ">
                <div class="button" data-testid="nc-docs-table-row-insert-below" @click="insertRowAfter">
                  <MdiArrowDown />
                </div>
              </a-tooltip>
            </div>
            <div
              class="absolute w-2 h-2 bg-gray-100 -left-3 top-2.5 row-drag-handle hidden"
              :style="{ transform: 'rotate(45deg)' }"
            ></div>
            <div class="absolute -left-4.5 -top-6 w-6 h-20 cursor-default row-drag-handle hidden"></div>
          </template>
        </div>
      </div>
      <div
        v-if="isFirstRowCell && !isPublic && !isSingleColumn"
        class="flex flex-row justify-center absolute h-8 z-50 -top-4 !w-full justify-center min-w-4 min-h-4 !group-[.tiptap-table-cell]:hover:opacity-100"
      >
        <div
          class="flex flex-row absolute tiptap-column-options mt-1.5"
          contenteditable="false"
          @mouseenter="toggleColumnSelection"
          @mouseleave="toggleColumnSelection"
        >
          <div
            class="flex flex-row h-5 w-8 justify-center items-center border-gray-200 border-1 bg-white hover:bg-gray-100 rounded-md tiptap-column-options cursor-pointer hidden"
            data-testid="nc-docs-table-column-drag-handle-wrapper"
          >
            <MdiDotsHorizontal class="tiptap-column-drag-handle" />
          </div>

          <div v-if="showColumnOptions" class="absolute">
            <div
              class="absolute flex flex-row text-sm gap-y-1 -left-6.5 -top-10 bg-gray-100 p-1 rounded-md tiptap-column-options hidden z-10"
            >
              <a-tooltip title="Add column left" placement="top" overlay-class-name="docs-table-col-options ">
                <div class="button" data-testid="nc-docs-table-column-insert-left" @click="insertColumnBefore">
                  <MdiArrowLeft />
                </div>
              </a-tooltip>
              <a-tooltip title="Delete column" placement="top" overlay-class-name="docs-table-col-options ">
                <div class="button !hover:text-red-400" data-testid="nc-docs-table-column-delete" @click="deleteColumn">
                  <MdiDeleteOutline />
                </div>
              </a-tooltip>
              <a-tooltip title="Add column right" placement="top" overlay-class-name="docs-table-col-options ">
                <div class="button" data-testid="nc-docs-table-column-insert-right" @click="insertColumnAfter">
                  <MdiArrowRight />
                </div>
              </a-tooltip>
            </div>
            <div
              class="absolute w-2 h-2 bg-gray-100 -top-3 left-3 tiptap-column-options hidden"
              :style="{ transform: 'rotate(45deg)' }"
            ></div>
            <div class="absolute -left-6 -top-5 w-20 h-6 cursor-default tiptap-column-options hidden"></div>
          </div>
        </div>
      </div>

      <NodeViewContent class="node-view-content py-1.5 px-3 !w-full" />
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.button {
  @apply flex rounded-md p-1 cursor-pointer hover:bg-gray-200  text-sm text-gray-400 hover:text-gray-600;
}

.row-drag-handle {
  color: rgb(184, 184, 184);
}
.tiptap-column-options {
  color: rgb(184, 184, 184);
}
</style>

<style lang="scss">
.tiptap-table-wrapper {
  // First cell
  tr:hover > td:first-child .row-drag-handle {
    display: block !important;
  }

  tr:first-child > td:hover .tiptap-column-options {
    display: flex !important;
  }

  tr:first-child > td:only-child:hover .tiptap-column-options {
    display: none !important;
  }
}

.selectedCell {
  @apply !bg-primary-selected;
}

.docs-table-row-options {
  @apply !shadow-none;
  .ant-popover-inner-content {
    @apply !shadow-none !p-0;
  }
  .ant-popover-arrow {
    @apply !shadow-none;
    .ant-popover-arrow-content {
      @apply !shadow-none !bg-gray-100;
    }
  }
  .ant-popover-inner {
    @apply !shadow-none !bg-gray-100 !p-1 !rounded-md;
  }
}
.tiptap-table-cell {
  @apply w-full;
}
</style>
