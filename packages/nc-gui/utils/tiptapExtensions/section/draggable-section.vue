<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { NodeSelection } from 'prosemirror-state'
import { dragOptionStyle } from './dragOptionStyle'

const { node, getPos, editor } = defineProps(nodeViewProps)

const isPublic = !editor.view.editable

const dragClicked = ref(false)
const optionsPopoverRef = ref()
const isMouseOverSection = ref(false)
const dragDomRef = ref<HTMLDivElement | undefined>()
const isDragging = ref(false)

const pos = ref(getPos())

const parentNode = computed(() => {
  try {
    const resolvedPos = editor.state.doc.resolve(getPos())
    const parent = resolvedPos.node(resolvedPos.depth - 1)
    return parent
  } catch (e) {
    return undefined
  }
})

const childNodeType = computed(() => {
  const { content } = node.content as any
  return content[0].type.name
})

const optionWrapperStyle = computed(() => {
  const { content } = node.content as any

  return dragOptionStyle({
    currentNode: content[0],
    parentNode: parentNode.value as any,
    attrs: content[0].attrs,
  })
})

const isCursorInNode = computed(() => {
  const { from, to } = editor.state.selection

  const pos = getPos()
  return from > pos && to < pos + node.nodeSize
})

const showDragOptions = computed(() => isCursorInNode.value || isMouseOverSection.value)

const createNodeAfter = () => {
  const toBeInsertedPos = getPos() + node.nodeSize

  editor.commands.insertContentAt(toBeInsertedPos, {
    type: 'sec',
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

  editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos.value)))
}

onClickOutside(optionsPopoverRef, () => {
  dragClicked.value = false
  const wrapperDom = document.querySelector('.draggable-block-wrapper.selected')
  wrapperDom?.classList.remove('selected')
})

const deleteNode = () => {
  editor.chain().setNodeSelection(getPos()).deleteSelection().run()
  dragClicked.value = false
}

watch(
  () => editor.view.dragging,
  () => {
    if (!editor.view.dragging) {
      isDragging.value = false
    }
  },
)

// Make drag options visible when mouse is over the node
// And show not show if the mouse is over a child section node
watch(dragDomRef, () => {
  if (!dragDomRef.value) return

  dragDomRef.value.addEventListener('mouseover', (e) => {
    const elementsOnMouse = document
      .elementsFromPoint(e.clientX, e.clientY)
      .filter((el) => el.classList.contains('draggable-block-wrapper'))
    if (!elementsOnMouse.length) return

    const topMostElement = elementsOnMouse[0]

    if (Number(topMostElement.getAttribute('pos')) === pos.value) {
      isMouseOverSection.value = true
    } else {
      isMouseOverSection.value = false
    }
  })

  dragDomRef.value.addEventListener('mouseout', () => {
    isMouseOverSection.value = false
  })
})

editor.on('update', () => {
  pos.value = getPos()
})
</script>

<template>
  <NodeViewWrapper
    class="vue-component draggable-block-wrapper"
    :data-diff-node="node.attrs.isInsertedHistory ? 'ins' : node.attrs.isDeletedHistory ? 'del' : null"
    :data-is-diff="!!node.attrs.isInsertedHistory || !!node.attrs.isDeletedHistory"
    :pos="pos"
  >
    <div
      v-if="!isPublic"
      ref="dragDomRef"
      class="flex flex-row gap-0.5 w-full items-start"
      tiptap-draghandle-wrapper="true"
      :pos="pos"
    >
      <div class="flex flex-row relative group" :style="optionWrapperStyle">
        <div
          v-if="!isDragging"
          type="button"
          class="absolute -left-4.5 block-button cursor-pointer w-5"
          :class="{
            '!opacity-100': showDragOptions,
          }"
          @click="createNodeAfter"
        >
          <MdiPlus />
        </div>
        <div v-else class="absolute -left-5 h-4 w-5 hidden"></div>

        <div
          ref="optionsPopoverRef"
          class="flex flex-col absolute -left-10 bg-gray-100 rounded-md p-1 text-sm z-40 -top-0.75"
          :class="{
            hidden: !dragClicked || isDragging,
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
          class="block-button cursor-pointer ml-1"
          contenteditable="false"
          :draggable="true"
          :data-drag-handle="true"
          :tiptap-draghandle="true"
          :class="{
            '!opacity-100': showDragOptions,
          }"
          @click="onDragClick"
          @dragstart="isDragging = true"
          @dragend="isDragging = false"
        >
          <IcBaselineDragIndicator />
        </div>
      </div>

      <NodeViewContent class="node-view-drag-content w-full" :data-testid="`nc-docs-tiptap-wrapper-${childNodeType}`" />
    </div>
    <div v-else class="ml-7.5">
      <NodeViewContent
        class="node-view-drag-content mb-2"
        :class="{
          '!ml-0.25': parentNode?.type.name === 'collapsable',
          '': parentNode?.type.name !== 'collapsable',
        }"
        :data-testid="`nc-docs-tiptap-wrapper-${childNodeType}`"
      />
    </div>
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.block-button {
  @apply opacity-0 hover:opacity-100 group-hover:opacity-100 hover:bg-gray-50 rounded-sm text-lg h-6 duration-150 transition-opacity;
  color: rgb(203, 203, 203);
}

// .focused {
//   .block-button {
//     @apply opacity-100;
//   }
// }

.block-button svg {
  @apply -mt-1.5;
}
.node-view-drag-content {
  @apply w-full;
}
</style>
