<script setup lang="ts">
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { type ColumnType, UITypes } from 'nocodb-sdk'
import FieldList from '~/helpers/tiptapExtensions/mention/FieldList'
import suggestion from '~/helpers/tiptapExtensions/mention/suggestion.ts'

const props = withDefaults(
  defineProps<{
    modelValue: string
    options?: ColumnType[]
    autoFocus?: boolean
    promptFieldTagClassName?: string
    suggestionIconClassName?: string
  }>(),
  {
    options: () => [],
    autoFocus: true,
    promptFieldTagClassName: '',
    suggestionIconClassName: '',
  },
)

const emits = defineEmits(['update:modelValue'])

const vModel = computed({
  get: () => props.modelValue,
  set: (v) => {
    emits('update:modelValue', v)
  },
})

const { autoFocus } = toRefs(props)

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
          if (query.length === 0) return props.options ?? []
          return props.options?.filter((o) => o.title?.toLowerCase()?.includes(query.toLowerCase())) ?? []
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
            } ${props.promptFieldTagClassName}`,
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
  autofocus: autoFocus.value,
  editorProps: { scrollThreshold: 100 },
})

const newFieldSuggestionNode = () => {
  if (!editor.value) return

  const { $from } = editor.value.state.selection
  const textBefore = editor.value.state.doc.textBetween($from.pos - 1, $from.pos, '\n', '\n')

  const lastCharacter = editor.value.state.doc.textBetween($from.pos - 1, $from.pos)

  // Check if the text before cursor contains a newline
  const hasNewlineBefore = textBefore.includes('\n')

  if (lastCharacter === '{') {
    editor.value
      .chain()
      .deleteRange({ from: $from.pos - 1, to: $from.pos })
      .run()
  } else if (lastCharacter !== ' ' && $from.pos !== 1 && !hasNewlineBefore) {
    editor.value?.commands.insertContent(' {')
    editor.value?.chain().focus().run()
  } else {
    editor.value?.commands.insertContent('{')
    editor.value?.chain().focus().run()
  }
}

onMounted(async () => {
  await until(() => vModel.value !== null && vModel.value !== undefined).toBeTruthy()

  // replace {id} with <span data-type="mention" data-id="id"></span>
  const renderContent = vModel.value
    .replace(/\{(.*?)\}/g, '<span data-type="mention" data-id="$1"></span>')
    .trim()
    .replace(/\n/g, '<br>')

  editor.value?.commands.setContent(renderContent)

  if (autoFocus.value) {
    setTimeout(() => {
      editor.value?.chain().focus().setTextSelection(vModel.value.length).run()
    }, 100)
  }
})
</script>

<template>
  <div class="nc-ai-prompt-with-fields w-full">
    <EditorContent ref="editorDom" :editor="editor" @keydown.alt.enter.stop @keydown.shift.enter.stop />

    <NcButton size="xs" type="text" class="nc-prompt-with-field-suggestion-btn !px-1" @click.stop="newFieldSuggestionNode">
      <GeneralIcon icon="ncPlusSquareSolid" class="text-nc-content-brand" :class="`${suggestionIconClassName}`" />
    </NcButton>
  </div>
</template>

<style lang="scss">
.nc-ai-prompt-with-fields {
  @apply relative;

  .nc-prompt-with-field-suggestion-btn {
    @apply absolute top-[1px] right-[1px];
  }

  .prompt-field-tag {
    @apply bg-gray-100 rounded-md px-1;
  }

  .ProseMirror {
    @apply px-3 pb-3 pt-2 h-[120px] min-h-[120px] overflow-y-auto nc-scrollbar-thin outline-none border-1 border-gray-200 bg-white text-nc-content-gray rounded-lg !rounded-b-none transition-shadow ease-linear -mx-[1px] -mt-[1px];
    resize: vertical;
    min-width: 100%;
    max-height: min(800px, calc(100vh - 200px)) !important;
  }

  .ProseMirror-focused {
    @apply !rounded-b-lg outline-none border-nc-fill-purple-medium shadow-selected-ai;
  }

  p {
    @apply !mb-1;
  }
}
</style>
