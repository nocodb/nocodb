<script setup lang="ts">
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import FieldList from '~/helpers/tiptapExtensions/mention/FieldList'
import suggestion from '~/helpers/tiptapExtensions/mention/suggestion.ts'

const props = defineProps<{
  modelValue: string
  keywords?: string[]
}>()

const emits = defineEmits(['update:modelValue'])

const vModel = computed({
  get: () => props.modelValue,
  set: (v) => {
    emits('update:modelValue', v)
  },
})

const editor = useEditor({
  content: vModel.value,
  extensions: [
    StarterKit.configure({
      heading: false,
    }) as any,
    Placeholder.configure({
      emptyEditorClass: 'is-editor-empty',
      placeholder: 'Write your prompt here...',
    }),
    Mention.configure({
      suggestion: {
        ...suggestion(FieldList),
        items: ({ query }) => {
          if (query.length === 0) return props.keywords ?? []
          return props.keywords?.filter((keyword) => keyword.includes(query)) ?? []
        },
        char: '{',
        allowSpaces: true,
      },
      renderHTML: ({ node }) => {
        return ['span', { class: 'prompt-field-tag' }, `${node.attrs.id}`]
      },
    }),
  ],
  onUpdate: ({ editor }) => {
    let text = ''

    // replace all mentions with id & prepare vModel
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'mention') {
        text += `{${node.attrs.id}}`
      } else if (node.text) {
        text += node.text
      } else if (node.type.name === 'paragraph') {
        text += '\n'
      }
    })

    // remove leading & trailing new lines
    text = text.trim()

    vModel.value = text
  },
  editable: true,
  autofocus: true,
  editorProps: { scrollThreshold: 100 },
})

onMounted(async () => {
  await until(() => vModel.value).toBeTruthy()

  // replace {id} with <span data-type="mention" data-id="id"></span>
  const renderContent = vModel.value
    .replace(/\{(.*?)\}/g, '<span data-type="mention" data-id="$1"></span>')
    .replace(/^\n/g, '')
    .replace(/\n$/g, '')
    .replace(/\n/g, '<br>')

  editor.value?.commands.setContent(renderContent)

  setTimeout(() => {
    editor.value?.chain().focus().setTextSelection(vModel.value.length).run()
  }, 100)
})
</script>

<template>
  <div class="nc-ai-prompt-with-fields w-full">
    <EditorContent ref="editorDom" class="h-[200px]" :editor="editor" @keydown.alt.enter.stop @keydown.shift.enter.stop />
  </div>
</template>

<style lang="scss" scoped></style>

<style lang="scss">
.nc-ai-prompt-with-fields {
  .prompt-field-tag {
    @apply bg-gray-100 rounded-md px-1 py-0.5;
  }

  .ProseMirror {
    @apply p-1 h-[200px] max-h-[200px] overflow-y-auto outline-none border-1 border-gray-200 rounded-lg;
  }

  .ProseMirror-focused {
    @apply outline-none border-brand-500;
  }

  p {
    @apply !mb-1;
  }
}
</style>
