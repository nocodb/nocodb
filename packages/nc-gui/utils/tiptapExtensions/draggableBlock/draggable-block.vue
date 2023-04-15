<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { NodeSelection } from 'prosemirror-state'

const { node, getPos, editor } = defineProps(nodeViewProps)

const isPublic = !editor.view.editable

const dragClicked = ref(false)
const optionsPopoverRef = ref()

const parentNodeType = computed(() => {
  try {
    const pos = getPos()
    const resolvedPos = editor.state.doc.resolve(pos)
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

  if (parentNodeType.value === 'collapsable') {
    return {
      marginTop: '0.2rem',
      marginLeft: '-2.1rem',
    }
  } else if (content[0].type.name === 'task') {
    return {
      marginTop: '0.2rem',
    }
  } else if (content[0].type.name === 'bullet') {
    return {
      marginTop: '0.2rem',
      marginRight: '0.8rem',
    }
  } else if (content[0].type.name === 'ordered') {
    return {
      marginTop: '0.2rem',
    }
  } else if (content[0].type.name === 'table') {
    return {
      marginTop: '1.4rem',
    }
  } else if (content[0].type.name === 'heading' && content[0].attrs.level === 1) {
    return {
      marginTop: '0.7rem',
    }
  } else if (content[0].type.name === 'heading' && content[0].attrs.level === 2) {
    return {
      marginTop: '0.35rem',
    }
  } else if (content[0].type.name === 'heading' && content[0].attrs.level === 3) {
    return {
      marginTop: '0.1rem',
    }
  } else if (content[0].type.name === 'paragraph') {
    return {
      marginTop: '0.2rem',
    }
  } else if (content[0].type.name === 'image') {
    return {
      marginTop: '0.5rem',
    }
  } else if (content[0].type.name === 'blockquote') {
    return {
      marginTop: '0.8rem',
    }
  } else if (content[0].type.name === 'codeBlock') {
    return {
      marginTop: '1.2rem',
    }
  } else if (
    content[0].type.name === 'bulletList' ||
    content[0].type.name === 'orderedList' ||
    content[0].type.name === 'taskList'
  ) {
    return {
      marginTop: '0.15rem',
    }
  } else if (
    content[0].type.name === 'infoCallout' ||
    content[0].type.name === 'warningCallout' ||
    content[0].type.name === 'tipCallout'
  ) {
    return {
      marginTop: '1.25rem',
    }
  } else if (content[0].type.name === 'horizontalRule') {
    return {
      marginTop: '0.55rem',
    }
  } else {
    return {
      marginTop: '0.7rem',
    }
  }
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

const isDragging = ref(false)

watch(
  () => editor.view.dragging,
  () => {
    if (!editor.view.dragging) {
      isDragging.value = false
    }
  },
)
</script>

<template>
  <NodeViewWrapper
    class="vue-component draggable-block-wrapper"
    :class="{
      'group': parentNodeType !== 'collapsable' && !isPublic,
      'sub-group': parentNodeType === 'collapsable' && !isPublic,
    }"
  >
    <div v-if="!isPublic" class="flex flex-row gap-0.5 w-full items-start" tiptap-draghandle-wrapper="true">
      <div class="flex flex-row relative" :style="optionWrapperStyle">
        <div
          v-if="!isDragging"
          type="button"
          class="absolute -left-4.5 block-button cursor-pointer w-5"
          :class="{
            'block-button-group': parentNodeType !== 'collapsable',
            'block-button-sub-group': parentNodeType === 'collapsable',
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
            'block-button-group': parentNodeType !== 'collapsable',
            'block-button-sub-group': parentNodeType === 'collapsable',
          }"
          @click="onDragClick"
          @dragstart="isDragging = true"
          @dragend="isDragging = false"
        >
          <IcBaselineDragIndicator :tiptap-draghandle="true" />
        </div>
      </div>

      <div>
        <NodeViewContent class="node-view-drag-content" :data-testid="`nc-docs-tiptap-wrapper-${childNodeType}`" />
      </div>
    </div>
    <NodeViewContent
      v-else
      class="node-view-drag-content mb-2"
      :class="{
        '!ml-0.25': parentNodeType === 'collapsable',
        '!ml-1.3': parentNodeType !== 'collapsable',
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

.group:hover {
  .block-button-group {
    @apply opacity-100;
  }
}
.group.focused {
  .block-button-group {
    @apply opacity-100;
  }
}
.group:focus {
  .block-button-group {
    @apply opacity-100;
  }
}
.group:active {
  .block-button-group {
    @apply opacity-100;
  }
}

.sub-group:hover {
  .block-button-sub-group {
    @apply opacity-100;
  }
}
.sub-group.focused {
  .block-button {
    @apply opacity-100;
  }
}
.block-button svg {
  @apply -mt-1.5;
}
.node-view-drag-content {
  @apply w-full ml-1.5;
}
</style>
