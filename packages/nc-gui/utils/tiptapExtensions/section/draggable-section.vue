<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { TextSelection } from 'prosemirror-state'
import { dragOptionStyle } from './dragOptionStyle'

const { node, getPos, editor } = defineProps(nodeViewProps)

const isPublic = !editor.view.editable

const dragClicked = ref(false)
const optionsPopoverRef = ref()
const showDragOptions = ref(false)
const dragDomRef = ref<HTMLDivElement | undefined>()
const isDragging = ref(false)

const pos = computed(() => getPos())

const parentNodeType = computed(() => {
  try {
    const resolvedPos = editor.state.doc.resolve(pos.value)
    const parent = resolvedPos.node(resolvedPos.depth - 1)
    return parent?.type.name
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
    nodeType: content[0].type.name,
    parentNodeType: parentNodeType.value as any,
    attrs: content[0].attrs,
  })
})

const createNodeAfter = () => {
  const toBeInsertedPos = pos.value + node.nodeSize

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

  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos.value + 2)))

  // We use timeout as 'focused' class takes time to be added
  setTimeout(() => {
    const wrapperDom = document.querySelector('.draggable-block-wrapper.focused')
    wrapperDom?.classList.add('selected')
  }, 100)
}

onClickOutside(optionsPopoverRef, () => {
  dragClicked.value = false
  const wrapperDom = document.querySelector('.draggable-block-wrapper.selected')
  wrapperDom?.classList.remove('selected')
})

const deleteNode = () => {
  editor.commands.deleteRange({ from: pos.value, to: pos.value + node.nodeSize })
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
      showDragOptions.value = true
    } else {
      showDragOptions.value = false
    }
  })

  dragDomRef.value.addEventListener('mouseout', () => {
    showDragOptions.value = false
  })
})
</script>

<template>
  <NodeViewWrapper class="vue-component draggable-block-wrapper" :pos="pos">
    <div
      v-if="!isPublic"
      ref="dragDomRef"
      class="flex flex-row gap-0.5 w-full items-start"
      tiptap-draghandle-wrapper="true"
      :pos="pos"
    >
      <div class="flex flex-row relative" :style="optionWrapperStyle">
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
          <IcBaselineDragIndicator :tiptap-draghandle="true" />
        </div>
      </div>

      <NodeViewContent class="node-view-drag-content w-full" :data-testid="`nc-docs-tiptap-wrapper-${childNodeType}`" />
    </div>
    <NodeViewContent
      v-else
      class="node-view-drag-content mb-2"
      :class="{
        '!ml-0.25': parentNodeType === 'collapsable',
        '': parentNodeType !== 'collapsable',
      }"
      :data-testid="`nc-docs-tiptap-wrapper-${childNodeType}`"
    />
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.block-button {
  @apply opacity-0  hover:bg-gray-50 rounded-sm text-lg h-6 duration-150 transition-opacity;
  color: rgb(203, 203, 203);
}

.block-button svg {
  @apply -mt-1.5;
}
.node-view-drag-content {
  @apply w-full;
}
</style>
