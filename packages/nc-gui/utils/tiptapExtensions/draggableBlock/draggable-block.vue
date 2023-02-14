<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { NodeSelection } from 'prosemirror-state'

const { node, getPos, editor } = defineProps(nodeViewProps)

const isPublic = !editor.view.editable

const dragClicked = ref(false)
const optionsPopoverRef = ref()

const isTable = computed(() => {
  const { content } = node.content as any

  return content[0].type.name === 'table'
})

const createNodeAfter = () => {
  const pos = getPos() + node.nodeSize

  editor.commands.insertContentAt(pos, {
    type: 'dBlock',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '/',
          },
        ],
      },
    ],
  })
}

const onDragClick = () => {
  dragClicked.value = !dragClicked.value
  editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, getPos())))
  const wrapperDom = document.querySelector('.draggable-block-wrapper.focused')
  wrapperDom?.classList.add('selected')
}

onClickOutside(optionsPopoverRef, () => {
  dragClicked.value = false
  const wrapperDom = document.querySelector('.draggable-block-wrapper.selected')
  wrapperDom?.classList.remove('selected')
})

const deleteNode = () => {
  editor.commands.deleteRange(editor.state.selection)
  dragClicked.value = false
}
</script>

<template>
  <NodeViewWrapper class="vue-component group draggable-block-wrapper">
    <div v-if="!isPublic" class="flex flex-row gap-0.5 group w-full relative" tiptap-draghandle-wrapper="true">
      <div type="button" class="block-button cursor-pointer" :class="{ '!mt-5': isTable }" @click="createNodeAfter">
        <MdiPlus />
      </div>

      <div
        ref="optionsPopoverRef"
        class="flex flex-col absolute -left-10 bg-gray-100 rounded-md p-1 text-sm z-40"
        :class="{
          hidden: !dragClicked,
          visible: dragClicked,
        }"
        :contenteditable="false"
      >
        <div
          class="flex flex-row justify-between cursor-pointer items-center gap-x-1 hover:bg-gray-200 p-1 rounded-md z-10"
          @click="deleteNode"
        >
          <MdiDeleteOutline />
        </div>
        <div class="w-2 h-2 absolute -right-1 top-3 bg-gray-100" :style="{ transform: 'rotate(45deg)' }"></div>
      </div>

      <div
        class="block-button cursor-pointer group"
        contenteditable="false"
        :class="{ '!mt-5': isTable }"
        :draggable="true"
        :data-drag-handle="true"
        :tiptap-draghandle="true"
        @click="onDragClick"
      >
        <IcBaselineDragIndicator :tiptap-draghandle="true" />
      </div>

      <NodeViewContent class="node-view-drag-content w-full ml-0.5" :class="{ 'ml-1': isTable }" />
    </div>
    <NodeViewContent class="node-view-drag-content w-full ml-0.5" />
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.block-button {
  @apply opacity-0 group-hover:opacity-100 !group-focus:opacity-100 !group-active:opacity-100 hover:bg-gray-50 rounded-sm text-lg py-0.5 h-6 mt-3;
  color: rgb(203, 203, 203);
}

.draggable-block-wrapper.focused {
  .block-button {
    @apply opacity-100;
  }
}
</style>
