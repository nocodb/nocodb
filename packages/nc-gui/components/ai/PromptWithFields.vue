<script setup lang="ts">
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { type ColumnType, UITypes } from 'nocodb-sdk'
import FieldList from '~/helpers/tiptapExtensions/mention/FieldList'
import suggestion from '~/helpers/tiptapExtensions/mention/suggestion.ts'

const props = defineProps<{
  modelValue: string
  options?: ColumnType[]
}>()

const emits = defineEmits(['update:modelValue'])

const vModel = computed({
  get: () => props.modelValue,
  set: (v) => {
    emits('update:modelValue', v)
  },
})

const keywords = computed(() => {
  return props.options?.map((option) => option.title) ?? []
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
          if (query.length === 0) return keywords.value ?? []
          return keywords.value?.filter((kw) => kw?.includes(query)) ?? []
        },
        char: '{',
        allowSpaces: true,
      },
      renderHTML: ({ node }) => {
        return [
          'span',
          {
            class: `prompt-field-tag ${
              props.options?.find((option) => option.title === node.attrs.id)?.uidt === UITypes.Attachment ? '!bg-green-200' : ''
            }`,
          },
          `${node.attrs.id}`,
        ]
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
      } else if (node.type.name === 'hardBreak') {
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
    .trim()
    .replace(/\n/g, '<br>')

  editor.value?.commands.setContent(renderContent)

  setTimeout(() => {
    editor.value?.chain().focus().setTextSelection(vModel.value.length).run()
  }, 100)
})
</script>

<template>
  <div class="nc-ai-prompt-with-fields w-full">
    <EditorContent ref="editorDom" :editor="editor" @keydown.alt.enter.stop @keydown.shift.enter.stop @click.stop />
  </div>
</template>

<style lang="scss">
.nc-ai-prompt-with-fields {
  .prompt-field-tag {
    @apply bg-gray-100 rounded-md px-1 py-0.5;
  }

  .ProseMirror {
    @apply px-3 pb-3 pt-2 h-[180px] min-h-[180px] overflow-y-auto nc-scrollbar-thin outline-none border-1 border-gray-200 bg-white rounded-lg transition-shadow;
    resize: vertical;
    min-width: 100%;
    max-height: min(800px, calc(100vh - 200px)) !important;
  }

  .ProseMirror-focused {
    @apply outline-none border-nc-fill-purple-medium shadow-selected-ai;
  }

  p {
    @apply !mb-1;
  }
}
</style>
