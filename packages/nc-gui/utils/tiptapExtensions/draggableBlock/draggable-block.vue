<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { NodeSelection } from 'prosemirror-state'

const { node, getPos, editor } = defineProps(nodeViewProps)

const isPublic = !editor.view.editable

const dragClicked = ref(false)
const optionsPopoverRef = ref()

const optionWrapperStyle = computed(() => {
  const { content } = node.content as any

  if (content[0].type.name === 'task') {
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
      marginTop: '0.15rem',
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
</script>

<template>
  <NodeViewWrapper class="vue-component group draggable-block-wrapper">
    <div v-if="!isPublic" class="flex flex-row gap-0.5 group w-full items-start" tiptap-draghandle-wrapper="true">
      <div class="flex flex-row relative" :style="optionWrapperStyle">
        <div type="button" class="block-button cursor-pointer" @click="createNodeAfter">
          <MdiPlus />
        </div>

        <div
          ref="optionsPopoverRef"
          class="flex flex-col absolute -left-10 bg-gray-100 rounded-md p-1 text-sm z-40 -top-0.75"
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
          :draggable="true"
          :data-drag-handle="true"
          :tiptap-draghandle="true"
          @click="onDragClick"
        >
          <IcBaselineDragIndicator :tiptap-draghandle="true" />
        </div>
      </div>

      <NodeViewContent class="node-view-drag-content" />
    </div>
    <NodeViewContent v-else class="node-view-drag-content my-2" />
  </NodeViewWrapper>
</template>

<style lang="scss" scoped>
.block-button {
  @apply opacity-0 group-hover:opacity-100 !group-focus:opacity-100 !group-active:opacity-100 hover:bg-gray-50 rounded-sm text-lg h-6;
  color: rgb(203, 203, 203);
}

.block-button svg {
  @apply -mt-1.5;
}

.draggable-block-wrapper.focused {
  .block-button {
    @apply opacity-100;
  }
}
.node-view-drag-content {
  @apply w-full ml-1.5;
}
</style>
