<script lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { EditorState } from 'prosemirror-state'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { addRowAfter, addRowBefore, goToNextCell } from '@tiptap/prosemirror-tables'

export default {
  components: {
    NodeViewWrapper,
    NodeViewContent,
  },
  props: nodeViewProps,
  data() {
    return {
      isFirstCell: false,
      dragAnchorSelected: false,
    }
  },
  mounted() {
    const el = this.$el as HTMLElement
    // check if the cell is the first cell in the row
    this.isFirstCell = el.previousElementSibling === null
  },
  methods: {
    toggleRowSelection() {
      if (this.dragAnchorSelected) {
        this.editor.view.dispatch(
          this.editor.state.tr.setSelection(TextSelection.create(this.editor.state.doc, this.getPos() + 1, this.getPos() + 1)),
        )
        this.dragAnchorSelected = false
        return
      }
      this.dragAnchorSelected = true
      this.selectRow()
    },
    selectRow() {
      const state: EditorState = this.editor.state
      const pos = this.getPos() - 1

      // Select the row node
      this.editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)))
    },
    deleteRow() {
      this.selectRow()

      this.editor.commands.deleteRange(this.editor.state.selection)
    },
    insertRowBefore() {
      const state: EditorState = this.editor.state
      const { from } = state.selection
      const parentRow = state.doc.resolve(this.getPos()).parent

      this.editor.view.dispatch(state.tr.setSelection(TextSelection.create(this.editor.state.doc, from + 1, from + 1)))
      addRowBefore(this.editor.state, this.editor.view.dispatch)
      const cellCount = parentRow.childCount
      for (let i = 0; i < cellCount; i++) {
        setTimeout(() => {
          goToNextCell(-1)(this.editor.state, this.editor.view.dispatch)
        }, 0)
      }
    },
    insertRowAfter() {
      this.selectRow()
      const state: EditorState = this.editor.state
      const { from } = state.selection
      const parentRow = state.doc.resolve(this.getPos()).parent

      this.editor.view.dispatch(state.tr.setSelection(TextSelection.create(this.editor.state.doc, from + 1, from + 1)))
      addRowAfter(this.editor.state, this.editor.view.dispatch)
      const cellCount = parentRow.childCount
      for (let i = 0; i < cellCount; i++) {
        setTimeout(() => {
          goToNextCell(1)(this.editor.state, this.editor.view.dispatch)
        }, 0)
      }
    },
  },
}
</script>

<template>
  <NodeViewWrapper class="vue-component group relative p-0" as="td">
    <div class="group table-cell overflow-visible flex">
      <div
        v-if="isFirstCell"
        class="flex flex-col justify-center absolute h-full -left-3 z-50 min-w-4 min-h-4 !group-[.table-cell]:hover:opacity-100"
      >
        <div
          class="flex border-gray-200 border-1 bg-white hover:bg-gray-100 py-0.5 rounded-md row-drag-handle hidden cursor-move"
          contenteditable="false"
          @mouseenter="toggleRowSelection"
          @mouseleave="toggleRowSelection"
        >
          <IcBaselineDragIndicator class="" />
          <template v-if="dragAnchorSelected">
            <div
              class="absolute flex flex-col text-sm gap-y-1 -left-10 -top-7 bg-gray-100 p-1 rounded-md row-drag-handle hidden z-10"
            >
              <a-tooltip title="Add row above" placement="left" overlay-class-name="docs-table-row-options ">
                <div class="button" @click.stop="insertRowBefore">
                  <MdiArrowUp />
                </div>
              </a-tooltip>
              <a-tooltip title="Delete row" placement="left" overlay-class-name="docs-table-row-options ">
                <div class="button !hover:text-red-400" @click.stop="deleteRow">
                  <MdiDeleteOutline />
                </div>
              </a-tooltip>
              <a-tooltip title="Add row below" placement="left" overlay-class-name="docs-table-row-options ">
                <div class="button" @click.stop="insertRowAfter">
                  <MdiArrowDown />
                </div>
              </a-tooltip>
            </div>
            <div
              class="absolute w-2 h-2 bg-gray-100 -left-3 top-3 row-drag-handle hidden"
              :style="{ transform: 'rotate(45deg)' }"
            ></div>
            <div class="absolute -left-5.5 -top-6 w-6 h-20 cursor-default row-drag-handle hidden"></div>
          </template>
        </div>
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
