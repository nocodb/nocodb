<script lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { EditorState } from 'prosemirror-state'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { CellSelection, addColumnAfter, addColumnBefore, deleteColumn } from '@tiptap/prosemirror-tables'

export default {
  components: {
    NodeViewWrapper,
    NodeViewContent,
  },
  props: nodeViewProps,
  methods: {
    selectColumn() {
      const state: EditorState = this.editor.state
      const pos = this.getPos()

      // Select the column node
      this.editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)))

      const selection = CellSelection.colSelection(state.doc.resolve(pos))
      this.editor.view.dispatch(state.tr.setSelection(selection as any))
    },
    deleteColumn() {
      // this.editor.commands.deleteRange(this.editor.state.selection)
      deleteColumn(this.editor.state, this.editor.view.dispatch)
    },
    insertColumnBefore() {
      addColumnBefore(this.editor.state, this.editor.view.dispatch)
    },
    insertColumnAfter() {
      addColumnAfter(this.editor.state, this.editor.view.dispatch)
    },
  },
}
</script>

<template>
  <NodeViewWrapper class="vue-component group relative p-0" as="th">
    <div class="group table-header overflow-visible flex flex-row">
      <div
        class="flex flex-row justify-center absolute h-full z-50 -top-4 !w-full justify-center min-w-4 min-h-4 !group-[.table-cell]:hover:opacity-100"
      >
        <a-popover placement="bottom" overlay-class-name="docs-table-row-options">
          <template #content>
            <div class="flex flex-row items-center text-sm gap-y-1">
              <a-tooltip title="Add row left" placement="bottom" overlay-class-name="docs-table-row-options ">
                <div class="button" @click="insertColumnBefore">
                  <MdiArrowLeft />
                </div>
              </a-tooltip>
              <a-tooltip title="Delete column" placement="bottom" overlay-class-name="docs-table-row-options ">
                <div class="button !hover:text-red-400" @click="deleteColumn">
                  <MdiDeleteOutline />
                </div>
              </a-tooltip>
              <a-tooltip title="Add column right" placement="bottom" overlay-class-name="docs-table-row-options ">
                <div class="button" @click="insertColumnAfter">
                  <MdiArrowRight />
                </div>
              </a-tooltip>
            </div>
          </template>
          <div
            class="flex flex-row justify-center items-center border-gray-200 border-1 bg-white hover:bg-gray-100 rounded-md column-drag-handle cursor-move hidden"
            contenteditable="false"
            @mouseover="selectColumn"
          >
            <IcBaselineDragIndicator class="" />
          </div>
        </a-popover>
      </div>

      <NodeViewContent class="node-view-content py-1.5 px-3" />
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.button {
  @apply rounded-md p-1 cursor-pointer hover:bg-gray-200  text-sm text-gray-400 hover:text-gray-600;
}

.column-drag-handle {
  color: rgb(184, 184, 184);
  transform: rotate(-90deg);
}
</style>

<style lang="scss">
.tableWrapper {
  // First cell
  th:hover .column-drag-handle {
    display: flex !important;
  }
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

  // .ant-tooltip-inner {
  //   @apply !text-xs py-1 my-auto !h-4;
  // }

  // .ant-tooltip-content {
  //   @apply !h-4;
  // }
  // .ant-tooltip {
  //   @apply !h-2;
  // }
}
</style>
