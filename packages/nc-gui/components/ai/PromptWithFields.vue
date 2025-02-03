<script setup lang="ts">
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import tippy from 'tippy.js'
import { type ColumnType, UITypes } from 'nocodb-sdk'
import { suggestion } from '~/helpers/tiptap'
import { FieldMentionList } from '~/helpers/tiptap-markdown/extensions'

const props = withDefaults(
  defineProps<{
    modelValue: string
    options?: ColumnType[]
    autoFocus?: boolean
    promptFieldTagClassName?: string
    suggestionIconClassName?: string
    placeholder?: string
    readOnly?: boolean
  }>(),
  {
    options: () => [],
    autoFocus: true,
    promptFieldTagClassName: '',
    suggestionIconClassName: '',
    /**
     * Use \n to show placeholder as preline
     * @example: :placeholder="`Enter prompt here...\n\neg : Categorise this {Notes}`"
     */
    placeholder: 'Write your prompt here...',
    readOnly: false,
  },
)

const emits = defineEmits(['update:modelValue', 'keydown'])

const vModel = computed({
  get: () => props.modelValue,
  set: (v) => {
    emits('update:modelValue', v)
  },
})

const { autoFocus, readOnly } = toRefs(props)

const debouncedLoadMentionFieldTagTooltip = useDebounceFn(loadMentionFieldTagTooltip, 1000)

const editor = useEditor({
  content: vModel.value,
  extensions: [
    StarterKit.configure({
      heading: false,
    }) as any,
    Placeholder.configure({
      emptyEditorClass: 'is-editor-empty',
      placeholder: props.placeholder,
    }),
    Mention.configure({
      suggestion: {
        ...suggestion(FieldMentionList),
        items: ({ query }) => {
          if (query.length === 0) return props.options ?? []
          return (
            props.options?.filter(
              (o) =>
                o.title?.toLowerCase()?.includes(query.toLowerCase()) || `${o.title?.toLowerCase()}}` === query.toLowerCase(),
            ) ?? []
          )
        },
        char: '{',
        allowSpaces: true,
      },
      renderHTML: ({ node }) => {
        const matchedOption = props.options?.find((option) => option.title === node.attrs.id)
        const isAttachment = matchedOption?.uidt === UITypes.Attachment
        return [
          'span',
          {
            'class': `prompt-field-tag ${isAttachment ? '!bg-green-200' : ''} ${props.promptFieldTagClassName}`,
            'style': 'max-width: 100px; white-space: nowrap; overflow: hidden; display: inline-block; text-overflow: ellipsis;', // Enforces truncation
            'data-tooltip': node.attrs.id, // Tooltip content
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

    debouncedLoadMentionFieldTagTooltip()
  },
  editable: !readOnly.value,
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

const tooltipInstances: any[] = []

function loadMentionFieldTagTooltip() {
  document.querySelectorAll('.nc-ai-prompt-with-fields .prompt-field-tag').forEach((el) => {
    const tooltip = Object.values(el.attributes).find((attr) => attr.name === 'data-tooltip')
    if (!tooltip || el.scrollWidth <= el.clientWidth) return
    // Show tooltip only on truncate
    const instance = tippy(el, {
      content: `<div class="tooltip text-xs">${tooltip.value}</div>`,
      placement: 'top',
      allowHTML: true,
      arrow: true,
      animation: 'fade',
      duration: 0,
      maxWidth: '200px',
    })

    tooltipInstances.push(instance)
  })
}

onMounted(() => {
  debouncedLoadMentionFieldTagTooltip()
})

onBeforeUnmount(() => {
  tooltipInstances.forEach((instance) => instance?.destroy())
  tooltipInstances.length = 0
})

const el = useCurrentElement()

// listen to custom event for setting the focus via event dispatching from
// outside the component where there's no access to editor and its apis
useEventListener(el, 'focusPromptWithFields', () => {
  setTimeout(() => {
    editor.value
      ?.chain()
      .focus()
      .setTextSelection(vModel.value.length * 2)
      .run()
  }, 100)
})
</script>

<template>
  <div class="nc-ai-prompt-with-fields w-full">
    <EditorContent
      ref="editorDom"
      :editor="editor"
      @keydown="$emit('keydown', $event)"
      @keydown.alt.enter.stop
      @keydown.shift.enter.stop
    />

    <NcButton
      size="xs"
      type="text"
      class="nc-prompt-with-field-suggestion-btn !px-1"
      :disabled="readOnly"
      @click.stop="newFieldSuggestionNode"
    >
      <slot name="triggerIcon">
        <GeneralIcon
          icon="ncPlusSquareSolid"
          class="text-nc-content-brand"
          :class="[
            `${suggestionIconClassName}`,
            {
              'opacity-75': readOnly,
            },
          ]"
        />
      </slot>
    </NcButton>
  </div>
</template>

<style lang="scss">
.nc-ai-prompt-with-fields {
  @apply relative;

  .nc-prompt-with-field-suggestion-btn {
    @apply absolute top-[2px] right-[1px];
  }

  .prompt-field-tag {
    @apply bg-gray-100 rounded-md px-1 align-middle;
  }

  .ProseMirror {
    @apply px-3 pb-3 pt-2 h-[120px] min-h-[120px] overflow-y-auto nc-scrollbar-thin outline-none border-1 border-gray-200 bg-white text-nc-content-gray rounded-lg !rounded-b-none transition-shadow ease-linear -mx-[1px] -mt-[1px];
    resize: vertical;
    min-width: 100%;
    max-height: min(800px, calc(100vh - 200px)) !important;

    & > p {
      @apply mr-3;
    }
  }

  .ProseMirror-focused {
    @apply !rounded-b-lg outline-none border-nc-fill-purple-medium shadow-selected-ai;
  }

  .tiptap p.is-editor-empty:first-child::before {
    @apply text-gray-500;
    content: attr(data-placeholder);
    white-space: pre-line; /* Preserve line breaks */
    float: left;
    height: 0;
    pointer-events: none;
  }

  p {
    @apply !mb-1;
  }
}
</style>
