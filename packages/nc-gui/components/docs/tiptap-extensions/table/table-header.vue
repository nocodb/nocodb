<script lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { EditorState } from 'prosemirror-state'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { CellSelection, addColumnAfter, addColumnBefore, deleteColumn, goToNextCell } from '@tiptap/prosemirror-tables'

export default {
  components: {
    NodeViewWrapper,
    NodeViewContent,
  },
  props: nodeViewProps,
  data() {
    return {
      dragAnchorSelected: false,
    }
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
      this.selectColumn()
    },
    selectColumn() {
      const state: EditorState = this.editor.state
      const pos = this.getPos()

      // Select the column node
      this.editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)))

      const selection = CellSelection.colSelection(state.doc.resolve(pos))
      this.editor.view.dispatch(state.tr.setSelection(selection as any))
    },
    deleteColumn() {
      this.selectColumn()

      deleteColumn(this.editor.state, this.editor.view.dispatch)
    },
    insertColumnBefore() {
      this.selectColumn()

      addColumnBefore(this.editor.state, this.editor.view.dispatch)
    },
    insertColumnAfter() {
      this.selectColumn()

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
        <div
          class="flex tiptap-column-options hidden mt-1.5"
          contenteditable="false"
          @mouseenter="toggleRowSelection"
          @mouseleave="toggleRowSelection"
        >
          <div
            class="flex flex-row h-5 w-8 justify-center items-center border-gray-200 border-1 bg-white hover:bg-gray-100 rounded-md tiptap-column-options cursor-move"
            @mouseover="selectColumn"
          >
            <IcBaselineDragIndicator class="tiptap-column-drag-handle" />
          </div>

          <div v-if="dragAnchorSelected" class="absolute">
            <div
              class="absolute flex flex-row text-sm gap-y-1 -left-6.5 -top-10 bg-gray-100 p-1 rounded-md tiptap-column-options hidden z-10"
            >
              <a-tooltip title="Add column left" placement="top" overlay-class-name="docs-table-row-options ">
                <div class="button" @click="insertColumnBefore">
                  <MdiArrowLeft />
                </div>
              </a-tooltip>
              <a-tooltip title="Delete column" placement="top" overlay-class-name="docs-table-row-options ">
                <div class="button !hover:text-red-400" @click="deleteColumn">
                  <MdiDeleteOutline />
                </div>
              </a-tooltip>
              <a-tooltip title="Add column right" placement="top" overlay-class-name="docs-table-row-options ">
                <div class="button" @click="insertColumnAfter">
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

      <NodeViewContent class="node-view-content my-1.5 mx-3" />
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.button {
  @apply rounded-md p-1 cursor-pointer hover:bg-gray-200  text-sm text-gray-400 hover:text-gray-600;
}

.tiptap-column-options {
}
.tiptap-column-drag-handle {
  color: rgb(184, 184, 184);
  transform: rotate(-90deg);
}
</style>

<style lang="scss">
.tableWrapper {
  // First cell
  th:hover .tiptap-column-options {
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
