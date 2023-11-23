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

  const contentHtml = parse(contentMd)

  const content = generateJSON(contentHtml, tiptapExtensions)

  editor.value.chain().setContent(content).setTextSelection(selection.to).run()
}

onMounted(() => {
  setTimeout(() => {
    setEditorContent(vModel.value)
  }, 300)
})
</script>

<template>
  <CellRichTextSelectedBubbleMenu v-if="editor" :editor="editor" />
  <CellRichTextLinkOptions v-if="editor" :editor="editor" />
  <EditorContent :editor="editor" class="nc-textarea-rich w-full h-full" />
</template>

<style lang="scss">
.nc-textarea-rich {
  .ProseMirror {
    @apply min-h-full;
  }
  .ProseMirror-focused {
    // remove all border
    outline: none;
  }
}
</style>
