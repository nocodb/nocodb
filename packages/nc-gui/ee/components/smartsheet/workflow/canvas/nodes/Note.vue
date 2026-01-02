<script setup lang="ts">
import { NodeResizer } from '@vue-flow/node-resizer'
import type { NodeProps } from '@vue-flow/core'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '~/helpers/tiptap-markdown'

interface NoteData {
  content?: string
  color?: string
}

const props = defineProps<NodeProps<NoteData>>()

const { updateNode, deleteNode } = useWorkflowOrThrow()

const { isDark, getColor } = useTheme()

const isEditMode = ref(false)
const noteRef = ref<HTMLElement>()

const noteColors = [
  { name: 'red', bgVar: 'var(--nc-bg-coloured-red)', borderVar: 'var(--nc-border-coloured-red)' },
  { name: 'yellow', bgVar: 'var(--nc-bg-coloured-yellow)', borderVar: 'var(--nc-border-coloured-yellow)' },
  { name: 'green', bgVar: 'var(--nc-bg-coloured-green)', borderVar: 'var(--nc-border-coloured-green)' },
  { name: 'blue', bgVar: 'var(--nc-bg-coloured-blue)', borderVar: 'var(--nc-border-coloured-blue)' },
  { name: 'purple', bgVar: 'var(--nc-bg-coloured-purple)', borderVar: 'var(--nc-border-coloured-purple)' },
  { name: 'pink', bgVar: 'var(--nc-bg-coloured-pink)', borderVar: 'var(--nc-border-coloured-pink)' },
]

const currentColor = computed(() => {
  return noteColors.find((c) => c.name === props.data?.color) || noteColors[0]
})

const changeColor = (colorName: string) => {
  updateNode(props.id, {
    data: {
      ...props.data,
      color: colorName,
    },
  })
}

const editor = useEditor({
  content: props.data?.content || '',
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      code: false,
    }),
    Underline,
    Placeholder.configure({
      placeholder: 'Write a note...',
    }),
    Markdown.configure({ breaks: true, transformPastedText: false }),
  ],
  editable: false,
  onUpdate: ({ editor }) => {
    const markdown = editor.storage.markdown.getMarkdown()
    updateNode(props.id, {
      data: {
        ...props.data,
        content: markdown,
      },
    })
  },
})

const enableEditMode = () => {
  if (!isEditMode.value) {
    isEditMode.value = true
    editor.value?.setEditable(true)
    nextTick(() => {
      editor.value?.commands.focus()
    })
  }
}

const disableEditMode = () => {
  if (isEditMode.value) {
    isEditMode.value = false
    editor.value?.setEditable(false)
  }
}

onClickOutside(
  noteRef,
  () => {
    disableEditMode()
  },
  {
    ignore: ['.nc-dropdown'],
  },
)

const deleteNote = () => {
  deleteNode(props.id)
}

// Prevent keyboard events from bubbling when in edit mode
const handleKeydown = (e: KeyboardEvent) => {
  if (isEditMode.value) {
    // Stop propagation for text editing shortcuts
    if (
      (e.key === 'a' && (e.metaKey || e.ctrlKey)) || // Cmd/Ctrl + A
      (e.key === 'c' && (e.metaKey || e.ctrlKey)) || // Cmd/Ctrl + C
      (e.key === 'x' && (e.metaKey || e.ctrlKey)) || // Cmd/Ctrl + X
      (e.key === 'v' && (e.metaKey || e.ctrlKey)) || // Cmd/Ctrl + V
      (e.key === 'z' && (e.metaKey || e.ctrlKey)) || // Cmd/Ctrl + Z
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'Backspace' ||
      e.key === 'Delete'
    ) {
      e.stopPropagation()
    }
  }
}

onKeyStroke(async (e) => {
  if (props.selected && !isEditMode.value && e.key.match(/^[a-zA-Z0-9]$/)) {
    editor.value?.commands.insertContent(e.key)
    await nextTick()
    enableEditMode()
  }
})

onMounted(() => {
  noteRef.value?.addEventListener('keydown', handleKeydown, true)
})

onBeforeUnmount(() => {
  noteRef.value?.removeEventListener('keydown', handleKeydown, true)
  editor.value?.destroy()
})
</script>

<template>
  <div
    ref="noteRef"
    class="note-node relative"
    :class="{
      'edit-mode': isEditMode,
      'nodrag': isEditMode,
    }"
    :style="{
      backgroundColor: isDark
        ? getAdaptiveTint(getColor(currentColor.bgVar), { isDarkMode: true, shade: -10 })
        : currentColor.bgVar,
      borderColor: isDark
        ? getAdaptiveTint(getColor(currentColor.borderVar), {
            brightnessMod: -10,
            isDarkMode: true,
            shade: -50,
          })
        : currentColor.borderVar,
    }"
    @dblclick="enableEditMode"
  >
    <NodeResizer
      :is-visible="props.selected"
      color="transparent"
      :min-width="200"
      :min-height="50"
      handle-class-name="custom-resize-handle"
    />

    <div class="relative w-full z-2">
      <NcButton
        v-if="props.selected"
        type="text"
        size="xsmall"
        class="toolbar-btn !text-nc-content-red-medium !absolute !-top-2 !-right-2 !hover:bg-nc-bg-red-light"
        @click="deleteNote"
      >
        <GeneralIcon icon="delete" />
      </NcButton>
    </div>

    <div v-if="isEditMode && editor" class="note-toolbar">
      <NcDropdown placement="bottom">
        <NcButton type="text" size="xsmall" class="toolbar-btn">
          <div
            class="w-4 h-4 rounded-full border-2"
            :style="{
              backgroundColor: isDark
                ? getAdaptiveTint(getColor(currentColor.bgVar), { isDarkMode: true, shade: -10 })
                : currentColor.bgVar,
              borderColor: isDark
                ? getAdaptiveTint(getColor(currentColor.borderVar), {
                    brightnessMod: -10,
                    isDarkMode: true,
                    shade: -50,
                  })
                : currentColor.borderVar,
            }"
          />
        </NcButton>
        <template #overlay>
          <div class="color-palette">
            <div
              v-for="color in noteColors"
              :key="color.name"
              class="color-option"
              :style="{
                backgroundColor: isDark ? getAdaptiveTint(getColor(color.bgVar), { isDarkMode: true, shade: -10 }) : color.bgVar,
                borderColor: isDark
                  ? getAdaptiveTint(getColor(color.borderVar), {
                      brightnessMod: -10,
                      isDarkMode: true,
                      shade: -50,
                    })
                  : color.borderVar,
              }"
              @click="changeColor(color.name)"
            >
              <GeneralIcon v-if="currentColor.name === color.name" icon="check" class="text-nc-content-gray" />
            </div>
          </div>
        </template>
      </NcDropdown>

      <NcButton
        type="text"
        size="xsmall"
        class="toolbar-btn"
        :class="{ active: editor.isActive('bold') }"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <span class="font-bold">B</span>
      </NcButton>

      <NcButton
        type="text"
        size="xsmall"
        class="toolbar-btn"
        :class="{ active: editor.isActive('italic') }"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <span class="italic">I</span>
      </NcButton>

      <NcButton
        type="text"
        size="xsmall"
        class="toolbar-btn"
        :class="{ active: editor.isActive('underline') }"
        @click="editor.chain().focus().toggleUnderline().run()"
      >
        <span class="underline">U</span>
      </NcButton>
    </div>
    <EditorContent :editor="editor" class="note-content" :class="[{ nodrag: isEditMode }]" />
  </div>
</template>

<style lang="scss">
// Override Vue Flow's z-index for Note nodes
.vue-flow__node[data-id] {
  &:has(.note-node) {
    z-index: 1 !important;
  }
}
</style>

<style scoped lang="scss">
.note-node {
  @apply w-full h-full min-w-[300px] min-h-[50px] border-2 rounded-lg p-3 flex relative flex-col shadow-default;
  z-index: 1 !important;

  &:hover {
    @apply shadow-hover;
  }

  &.edit-mode {
    cursor: default;
  }
}

.note-toolbar {
  @apply absolute top-[-40px] left-1/2 transform translate-x-[-50%] flex items-center gap-2 p-2 bg-nc-bg-default border border-nc-border-default rounded-lg shadow-default z-10;

  .toolbar-btn {
    &.active {
      background: rgba(var(--rgb-base), 0.1);
    }
  }
}

.color-palette {
  @apply flex gap-2 p-2 bg-nc-bg-default rounded-lg shadow-default;

  .color-option {
    @apply w-8 h-8 rounded-lg border cursor-pointer flex items-center justify-center border-2 transition-transform;

    &:hover {
      transform: scale(1.1);
    }
  }
}

.note-content {
  flex: 1;
  outline: none;
  overflow-y: auto;

  :deep(.ProseMirror) {
    outline: none;
    font-size: 14px;
    line-height: 1.5;
    color: var(--nc-content-gray);
    min-height: 100%;

    p {
      margin: 0;
      padding: 0;
    }

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: var(--nc-content-gray);
      pointer-events: none;
      height: 0;
    }
  }
}

// Hide all resize handles except bottom-right
:deep(.custom-resize-handle) {
  display: none !important;

  &.bottom.right {
    display: block !important;
  }
}
</style>
