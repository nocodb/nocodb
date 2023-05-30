<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { EditorState } from 'prosemirror-state'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { CellSelection, addColumn, addRow, selectedRect } from '@tiptap/pm/tables'

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

  // Select the first cell of the last added row
  setTimeout(() => {
    const state = editor.state
    const tr = state.tr
    const rect = selectedRect(state)
    addRow(tr, rect, rect.bottom)

    const tableNodePos = getPos()
    const tableNode = tr.doc.nodeAt(tableNodePos)!
    const lastRowNode = tableNode.lastChild!
    const lastRowNodePos = tableNodePos + tableNode.nodeSize - lastRowNode.nodeSize

    tr.setSelection(TextSelection.create(tr.doc, lastRowNodePos + 2))

    editor.view.dispatch(tr)
  })
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

  // Select the header cell of the first added column
  setTimeout(() => {
    const state = editor.state
    const rect = selectedRect(state)
    const tr = state.tr
    addColumn(tr, rect, rect.right)

    const tableNode = tr.doc.nodeAt(getPos())!
    const firstHeader = tableNode.firstChild!
    const firstHeaderLastCell = firstHeader.lastChild!
    const firstHeaderLastCellPos = getPos() + firstHeader.nodeSize - firstHeaderLastCell.nodeSize + 1

    tr.setSelection(TextSelection.create(tr.doc, firstHeaderLastCellPos))

    editor.view.dispatch(tr)
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
