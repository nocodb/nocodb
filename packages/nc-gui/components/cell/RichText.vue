<script lang="ts" setup>
import StarterKit from '@tiptap/starter-kit'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import TurndownService from 'turndown'
import { parse } from 'marked'
import { generateJSON } from '@tiptap/html'
import Underline from '@tiptap/extension-underline'
import { Link } from '@/helpers/dbTiptapExtensions/links'

const props = defineProps<{
  value?: string | null
  readonly?: boolean
  syncValueChange?: boolean
  showMenu?: boolean
}>()

const emits = defineEmits(['update:value'])

const turndownService = new TurndownService()

const vModel = useVModel(props, 'value', emits, { defaultValue: '' })

const tiptapExtensions = [
  StarterKit,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Underline,
  Link,
]

const editor = useEditor({
  extensions: tiptapExtensions,
  onUpdate: ({ editor }) => {
    const markdown = turndownService.turndown(editor.getHTML())

    vModel.value = markdown
  },
  editable: !props.readonly,
})

const setEditorContent = (contentMd: any) => {
  if (!editor.value) return
  ;(editor.value.state as any).history$.prevRanges = null
  ;(editor.value.state as any).history$.done.eventCount = 0

  const selection = editor.value.view.state.selection

  const contentHtml = contentMd ? parse(contentMd) : '<p></p>'

  const content = generateJSON(contentHtml, tiptapExtensions)

  editor.value.chain().setContent(content).setTextSelection(selection.to).run()
}

if (props.syncValueChange) {
  watch(vModel, () => {
    setEditorContent(vModel.value)
  })
}

onMounted(() => {
  setTimeout(() => {
    setEditorContent(vModel.value)
  }, 0)
})
</script>

<template>
  <div class="h-full">
    <div v-if="props.showMenu" class="absolute top-1 z-1000 right-3">
      <CellRichTextSelectedBubbleMenu v-if="editor" :editor="editor" embed-mode />
    </div>
    <CellRichTextSelectedBubbleMenuPopup v-if="editor" :editor="editor" />
    <CellRichTextLinkOptions v-if="editor" :editor="editor" />
    <EditorContent :editor="editor" class="nc-textarea-rich w-full h-full nc-text-rich-scroll nc-scrollbar-md" />
  </div>
</template>

<style lang="scss">
.nc-text-rich-scroll {
  &::-webkit-scrollbar-thumb {
    @apply bg-transparent;
  }
}
.nc-text-rich-scroll:hover {
  &::-webkit-scrollbar-thumb {
    @apply bg-gray-200;
  }
}

.nc-textarea-rich {
  .ProseMirror-focused {
    // remove all border
    outline: none;
  }

  p {
    @apply !mb-1;
  }

  ul {
    @apply ml-4;
    li {
      list-style-type: disc;
    }
  }

  ol {
    @apply -ml-6;
    li {
      list-style-type: decimal;
    }
  }

  ul[data-type='taskList'] {
    @apply ml-0;
    li {
      @apply flex flex-row items-baseline gap-x-2;
      list-style-type: none;
    }
  }

  // Pre tag is the parent wrapper for Code block
  pre {
    border-color: #d0d5dd;
    border: 1px;
    color: black;
    font-family: 'JetBrainsMono', monospace;
    padding: 1rem;
    border-radius: 0.5rem;
    @apply overflow-auto mt-3 bg-gray-100;

    code {
      @apply !px-0;
    }
  }

  code {
    @apply rounded-md px-2 py-1 bg-gray-100;
    color: inherit;
    font-size: 0.8rem;
  }
}
</style>
