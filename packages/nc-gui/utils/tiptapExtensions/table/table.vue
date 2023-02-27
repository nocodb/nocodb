<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { EditorState } from 'prosemirror-state'
import { NodeSelection } from 'prosemirror-state'
import { CellSelection, addColumnAfter, addRowAfter } from '@tiptap/prosemirror-tables'

const { getPos, editor } = defineProps(nodeViewProps)
const isPublic = !editor.view.editable

const selectRow = () => {
  const state: EditorState = editor.state
  const pos = getPos()

  const tableNode = state.doc.nodeAt(pos)
  let childrenSize = 0

  const rowNodes = (tableNode?.content as any).content ?? []

  for (const child of rowNodes) {
    childrenSize += child.nodeSize
  }
  const lastRowPos = pos + childrenSize - (tableNode?.lastChild?.nodeSize ?? 0)
  const firstCellOFLastRow = lastRowPos + 2

  // Select the row node
  editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, firstCellOFLastRow)))
}

const createRow = () => {
  selectRow()

  setTimeout(() => {
    addRowAfter(editor.state, editor.view.dispatch)
  }, 0)
}

const selectColumn = () => {
  const state: EditorState = editor.state
  const tablePos = getPos()

  const tableNode = state.doc.nodeAt(tablePos)
  const firstRow = tableNode?.firstChild
  let childrenSize = 0
  const cells = firstRow?.content?.content ?? []

  for (const cell of cells) {
    childrenSize += cell.nodeSize
  }

  const lastHeaderCellPos = tablePos + childrenSize - (firstRow?.lastChild?.nodeSize ?? 0) + 2

  // Select the column node
  editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, lastHeaderCellPos)))

  const selection = CellSelection.colSelection(state.doc.resolve(lastHeaderCellPos))
  editor.view.dispatch(state.tr.setSelection(selection as any))
}

const appendColumn = () => {
  selectColumn()

  setTimeout(() => {
    addColumnAfter(editor.state, editor.view.dispatch)
  }, 0)
}
</script>

<template>
  <NodeViewWrapper class="tiptap-table-wrapper flex flex-col h-full group">
    <div class="flex flex-row gap-x-1 items-stretch">
      <NodeViewContent as="table" />
      <div
        v-if="!isPublic"
        class="tiptap-create-column-btn flex flex-col bg-gray-50 hover:bg-gray-100 justify-center cursor-pointer text-xs"
        contenteditable="false"
        @click="appendColumn"
      >
        <MdiPlus class="flex" />
      </div>
    </div>
    <div
      v-if="!isPublic"
      class="tiptap-create-row-btn py-0.5 mt-1 mr-4.5 flex flex-row bg-gray-50 hover:bg-gray-100 h-full justify-center cursor-pointer text-xs"
      contenteditable="false"
      @click.stop="createRow"
    >
      <MdiPlus class="flex" />
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.tiptap-create-row-btn {
  @apply !opacity-0 !group-hover:opacity-100 !hover:text-gray-600;
  color: rgb(203, 203, 203);
}
.tiptap-create-column-btn {
  @apply !opacity-0 !group-hover:opacity-100 !hover:text-gray-600;
  color: rgb(203, 203, 203);
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}
</style>

<style lang="scss">
.tiptap-table-wrapper {
  @apply !pb-4 !pt-4;

  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    padding-top: 2rem;
    padding-bottom: 2rem;
    overflow: visible;
    tbody {
      overflow: visible;
    }
    td {
      position: relative;
      min-width: 1em;
      border: 1px solid #e5e5e5;
      overflow: visible !important;
      height: 20px;
    }

    td {
      overflow: visible !important;
      border-top: 0;
    }

    // First row's td
    tr:first-child {
      td {
        border-top: 1px solid #e5e5e5 !important;
        @apply font-semibold;
        background-color: #fafbfb;
      }
    }

    th {
      @apply font-semibold;
      background-color: #fafbfb;
    }

    .column-resize-handle {
      position: absolute;
      right: -2px;
      top: 0;
      bottom: 0px;
      margin-top: 1px;
      margin-bottom: 1px;
      width: 8px;
      outline: 1px solid #e3e5ff;
    }

    p {
      margin: 0;
    }

    .column-resize-handle {
      background-color: #e3e5ff !important;
      width: 3px;
      cursor: col-resize;
      z-index: 1;
    }
  }
}
</style>
