<script lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { EditorState } from 'prosemirror-state'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { addRowAfter, addRowBefore } from '@tiptap/prosemirror-tables'

export default {
  components: {
    NodeViewWrapper,
    NodeViewContent,
  },
  props: nodeViewProps,
  methods: {
    selectRowNode() {
      const state: EditorState = this.editor.state
      const pos = this.getPos() - 1

      // Select the row node
      this.editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)))
    },
    deleteRow() {
      this.editor.commands.deleteRange(this.editor.state.selection)
    },
    insertRowBefore() {
      const state: EditorState = this.editor.state
      const { from } = state.selection
      this.editor.view.dispatch(state.tr.setSelection(TextSelection.create(this.editor.state.doc, from + 1, from + 1)))
      addRowBefore(this.editor.state, this.editor.view.dispatch)
    },
    insertRowAfter() {
      const state: EditorState = this.editor.state
      const { from } = state.selection
      this.editor.view.dispatch(state.tr.setSelection(TextSelection.create(this.editor.state.doc, from + 1, from + 1)))
      addRowAfter(this.editor.state, this.editor.view.dispatch)
    },
  },
}
</script>

<template>
  <NodeViewWrapper class="vue-component group relative p-0" as="td">
    <div class="group table-cell overflow-visible flex">
      <div
        class="flex flex-col justify-center absolute h-full -left-3 z-50 min-w-4 min-h-4 !group-[.table-cell]:hover:opacity-100"
      >
        <a-popover placement="left" overlay-class-name="docs-table-row-options">
          <template #content>
            <div class="flex flex-col text-sm gap-y-1">
              <a-tooltip title="Add row above" placement="left" overlay-class-name="docs-table-row-options ">
                <div class="button" @click="insertRowBefore">
                  <MdiArrowUp />
                </div>
              </a-tooltip>
              <a-tooltip title="Delete row" placement="left" overlay-class-name="docs-table-row-options ">
                <div class="button !hover:text-red-400" @click="deleteRow">
                  <MdiDeleteOutline />
                </div>
              </a-tooltip>
              <a-tooltip title="Add row below" placement="left" overlay-class-name="docs-table-row-options ">
                <div class="button" @click="insertRowAfter">
                  <MdiArrowDown />
                </div>
              </a-tooltip>
            </div>
          </template>
          <div
            class="flex border-gray-200 border-1 bg-white hover:bg-gray-100 py-0.5 rounded-md row-drag-handle hidden cursor-move"
            contenteditable="false"
            @mouseover="selectRowNode"
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

.row-drag-handle {
  color: rgb(184, 184, 184);
}
</style>

<style lang="scss">
.tableWrapper {
  // First cell
  tr:hover > td:first-child .row-drag-handle {
    display: block !important;
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
