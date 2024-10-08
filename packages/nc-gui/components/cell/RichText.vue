<script lang="ts" setup>
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import TurndownService from 'turndown'
import { marked } from 'marked'
import { generateJSON } from '@tiptap/html'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { TaskItem } from '~/helpers/dbTiptapExtensions/task-item'
import { Link } from '~/helpers/dbTiptapExtensions/links'
import type { RichTextBubbleMenuOptions } from '#imports'

const props = withDefaults(
  defineProps<{
    value?: string | null
    readOnly?: boolean
    syncValueChange?: boolean
    showMenu?: boolean
    fullMode?: boolean
    isFormField?: boolean
    autofocus?: boolean
    placeholder?: string
    renderAsText?: boolean
    hiddenBubbleMenuOptions?: RichTextBubbleMenuOptions[]
  }>(),
  {
    isFormField: false,
    hiddenBubbleMenuOptions: () => [],
  },
)

const emits = defineEmits(['update:value', 'focus', 'blur'])

const { fullMode, isFormField, hiddenBubbleMenuOptions } = toRefs(props)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const rowHeight = inject(RowHeightInj, ref(1 as const))

const readOnlyCell = inject(ReadonlyInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const isFocused = ref(false)

const keys = useMagicKeys()

const localRowHeight = computed(() => {
  if (readOnlyCell.value && !isExpandedFormOpen.value && (isGallery.value || isKanban.value)) return 6

  return rowHeight.value
})

const shouldShowLinkOption = computed(() => {
  return isFormField.value ? isFocused.value : true
})

const turndownService = new TurndownService({})

turndownService.addRule('lineBreak', {
  filter: (node) => {
    return node.nodeName === 'BR'
  },
  replacement: () => {
    return '<br />'
  },
})

turndownService.addRule('taskList', {
  filter: (node) => {
    return node.nodeName === 'LI' && !!node.getAttribute('data-checked')
  },
  replacement: (content, node: any) => {
    // Remove the first \n\n and last \n\n
    const processContent = content.replace(/^\n\n/, '').replace(/\n\n$/, '')

    const isChecked = node.getAttribute('data-checked') === 'true'

    return `[${isChecked ? 'x' : ' '}] ${processContent}\n\n`
  },
})

turndownService.addRule('strikethrough', {
  filter: ['s'],
  replacement: (content) => {
    return `~${content}~`
  },
})

turndownService.keep(['u', 'del'])

const checkListItem = {
  name: 'checkListItem',
  level: 'block',
  tokenizer(src: string) {
    src = src.split('\n\n')[0]
    const isMatched = src.startsWith('[ ]') || src.startsWith('[x]') || src.startsWith('[X]')

    if (isMatched) {
      const isNotChecked = src.startsWith('[ ]')
      let text = src.slice(3)
      if (text[0] === ' ') text = text.slice(1)

      const token = {
        // Token to generate
        type: 'checkListItem',
        raw: src,
        text,
        tokens: [],
        checked: !isNotChecked,
      }

      ;(this as any).lexer.inline(token.text, token.tokens) // Queue this data to be processed for inline tokens
      return token
    }

    return false
  },
  renderer(token: any) {
    return `<ul data-type="taskList"><li data-checked="${
      token.checked ? 'true' : 'false'
    }" data-type="taskItem"><label><input type="checkbox" ${
      token.checked ? 'checked="checked"' : ''
    }><span></span></label><div>${(this as any).parser.parseInline(token.tokens)}</div></li></ul>` // parseInline to turn child tokens into HTML
  },
}

marked.use({ extensions: [checkListItem] })

const editorDom = ref<HTMLElement | null>(null)

const richTextLinkOptionRef = ref<HTMLElement | null>(null)

const vModel = useVModel(props, 'value', emits, { defaultValue: '' })

const tiptapExtensions = [
  StarterKit.configure({
    heading: isFormField.value ? false : undefined,
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Underline,
  Link,
  Placeholder.configure({
    emptyEditorClass: 'is-editor-empty',
    placeholder: props.placeholder,
  }),
]

const editor = useEditor({
  extensions: tiptapExtensions,
  onUpdate: ({ editor }) => {
    const markdown = turndownService
      .turndown(editor.getHTML().replaceAll(/<p><\/p>/g, '<br />'))
      .replaceAll(/\n\n<br \/>\n\n/g, '<br>\n\n')

    vModel.value = markdown === '<br />' ? '' : markdown
  },
  editable: !props.readOnly,
  autofocus: props.autofocus,
  onFocus: () => {
    isFocused.value = true
    emits('focus')
  },
  onBlur: (e) => {
    if (!(e?.event?.relatedTarget as HTMLElement)?.closest('.bubble-menu, .nc-textarea-rich-editor, .nc-rich-text')) {
      isFocused.value = false
      emits('blur')
    }
  },
})

const setEditorContent = (contentMd: any, focusEndOfDoc?: boolean) => {
  if (!editor.value) return

  const selection = editor.value.view.state.selection

  const contentHtml = contentMd ? marked.parse(contentMd) : '<p></p>'

  const content = generateJSON(contentHtml, tiptapExtensions)

  editor.value.chain().setContent(content).setTextSelection(selection.to).run()

  setTimeout(() => {
    if (focusEndOfDoc) {
      const docSize = editor.value!.state.doc.nodeSize

      editor.value
        ?.chain()
        .setTextSelection(docSize - 1)
        .run()
    }

    ;(editor.value!.state as any).history$.prevRanges = null
    ;(editor.value!.state as any).history$.done.eventCount = 0
  }, 100)
}

const onFocusWrapper = () => {
  if (isForm.value && !isFormField.value && !props.readOnly && !keys.shift.value) {
    editor.value?.chain().focus().run()
  }
}

if (props.syncValueChange) {
  watch([vModel, editor], () => {
    setEditorContent(isFormField.value ? (vModel.value || '')?.replace(/(<br \/>)+$/g, '') : vModel.value)
  })
}

if (isFormField.value) {
  watch([props, editor], () => {
    if (props.readOnly) {
      editor.value?.setEditable(false)
    } else {
      editor.value?.setEditable(true)
    }
  })
}

onMounted(() => {
  if (fullMode.value || isFormField.value || isForm.value || isEditColumn.value) {
    setEditorContent(vModel.value, true)

    if (fullMode.value || isSurveyForm.value) {
      nextTick(() => {
        editor.value?.chain().focus().run()
      })
    }
  }
})

useEventListener(
  editorDom,
  'focusout',
  (e: FocusEvent) => {
    const targetEl = e?.relatedTarget as HTMLElement
    if (targetEl?.classList?.contains('tiptap') || !targetEl?.closest('.bubble-menu, .tippy-content, .nc-textarea-rich-editor')) {
      isFocused.value = false
      emits('blur')
    }
  },
  true,
)
useEventListener(
  richTextLinkOptionRef,
  'focusout',
  (e: FocusEvent) => {
    const targetEl = e?.relatedTarget as HTMLElement
    if (!targetEl && (e.target as HTMLElement)?.closest('.bubble-menu, .tippy-content, .nc-textarea-rich-editor')) return

    if (!targetEl?.closest('.bubble-menu, .tippy-content, .nc-textarea-rich-editor')) {
      isFocused.value = false
      emits('blur')
    }
  },
  true,
)
onClickOutside(editorDom, (e) => {
  if (!isFocused.value) return

  const targetEl = e?.target as HTMLElement

  if (!targetEl?.closest('.bubble-menu,.tippy-content, .nc-textarea-rich-editor')) {
    isFocused.value = false
    emits('blur')
  }
})
</script>

<template>
  <div
    class="nc-rich-text h-full focus:outline-none"
    :class="{
      'flex flex-col flex-grow nc-rich-text-full': fullMode,
      'nc-rich-text-embed flex flex-col pl-1 w-full': !fullMode,
      'readonly': readOnly,
      'nc-form-rich-text-field !p-0 relative': isFormField,
      'nc-rich-text-grid': isGrid,
    }"
    :tabindex="readOnlyCell || isFormField ? -1 : 0"
    @focus="onFocusWrapper"
  >
    <div v-if="renderAsText" class="truncate">
      <span v-if="editor"> {{ editor?.getText() ?? '' }}</span>
    </div>
    <template v-else>
      <div
        v-if="showMenu && !readOnly && !isFormField"
        class="absolute top-0 right-0.5"
        :class="{
          'flex rounded-tr-2xl overflow-hidden w-full': fullMode || isForm,
          'max-w-[calc(100%_-_198px)]': fullMode,
          'justify-start left-0.5': isForm,
          'justify-end xs:hidden': !isForm,
        }"
      >
        <div class="scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 scrollbar-track-transparent">
          <CellRichTextSelectedBubbleMenu v-if="editor" :editor="editor" embed-mode :is-form-field="isFormField" />
        </div>
      </div>
      <CellRichTextSelectedBubbleMenuPopup v-if="editor && !isFormField && !isForm" :editor="editor" />

      <template v-if="shouldShowLinkOption">
        <CellRichTextLinkOptions
          v-if="editor"
          ref="richTextLinkOptionRef"
          :editor="editor"
          :is-form-field="isFormField"
          @blur="isFocused = false"
        />
      </template>

      <EditorContent
        ref="editorDom"
        :editor="editor"
        class="flex flex-col nc-textarea-rich-editor w-full"
        :class="{
          'mt-2.5 flex-grow': fullMode,
          'scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent': !fullMode || (!fullMode && isExpandedFormOpen),
          'flex-grow': isExpandedFormOpen,
          [`!overflow-hidden nc-truncate nc-line-clamp-${rowHeightTruncateLines(localRowHeight)}`]:
            !fullMode && readOnly && localRowHeight && !isExpandedFormOpen && !isForm,
        }"
        @keydown.alt.stop
        @keydown.alt.enter.stop
        @keydown.shift.enter.stop
      />
      <div v-if="isFormField && !readOnly" class="nc-form-field-bubble-menu-wrapper overflow-hidden">
        <div
          :class="isFocused ? 'max-h-[50px]' : 'max-h-0'"
          :style="{
            transition: 'max-height 0.2s ease-in-out',
          }"
        >
          <CellRichTextSelectedBubbleMenu
            v-if="editor"
            :editor="editor"
            embed-mode
            is-form-field
            :hidden-options="hiddenBubbleMenuOptions"
          />
        </div>
      </div>
    </template>
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

.nc-rich-text-embed {
  .ProseMirror {
    @apply !border-transparent max-h-full;
  }
  &:not(.nc-form-rich-text-field):not(.nc-rich-text-grid) {
    .ProseMirror {
      min-height: 8rem;
    }
  }

  &.nc-form-rich-text-field {
    .ProseMirror {
      padding: 0;
    }
    &.readonly {
      ul[data-type='taskList'] li input[type='checkbox'] {
        background-color: #d5d5d9 !important;
        &:not(:checked) {
          @apply !border-gray-400;
        }
        &:focus {
          box-shadow: none !important;
          background-color: #d5d5d9 !important;
        }
      }
    }
  }
  &.readonly {
    .nc-textarea-rich-editor {
      .ProseMirror {
        resize: none;
        white-space: pre-line;
      }
    }
  }
  &.allow-vertical-resize:not(.readonly) {
    .ProseMirror {
      @apply nc-scrollbar-thin;

      overflow-y: auto;
      overflow-x: hidden;
      resize: vertical;
      min-width: 100%;
      max-height: min(800px, calc(100vh - 200px)) !important;
    }
  }
}

.nc-rich-text-full {
  @apply px-3;
  .ProseMirror {
    @apply !p-2 h-[min(797px,100vh_-_170px)] w-[min(1256px,100vw_-_124px)];
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin !important;
    resize: both;
    min-height: 215px;
    max-height: min(797px, calc(100vh - 170px));
    min-width: 256px;
    max-width: min(1256px, 100vw - 126px);
  }
  &.readonly {
    .ProseMirror {
      @apply bg-gray-50;
    }
  }
}

.nc-textarea-rich-editor {
  &.nc-truncate {
    .tiptap.ProseMirror {
      display: -webkit-box;
      max-width: 100%;
      -webkit-box-orient: vertical;
      word-break: break-word;
    }
    &.nc-line-clamp-1 .tiptap.ProseMirror {
      -webkit-line-clamp: 1;
    }
    &.nc-line-clamp-2 .tiptap.ProseMirror {
      -webkit-line-clamp: 2;
    }
    &.nc-line-clamp-3 .tiptap.ProseMirror {
      -webkit-line-clamp: 3;
    }
    &.nc-line-clamp-4 .tiptap.ProseMirror {
      -webkit-line-clamp: 4;
    }
  }
  .tiptap p.is-editor-empty:first-child::before {
    color: #9aa2af;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  .ProseMirror {
    @apply flex-grow pt-1.5 border-1 border-gray-200 rounded-lg;

    > * {
      @apply ml-1;
    }
  }
  .ProseMirror-focused {
    // remove all border
    outline: none;
    @apply border-brand-500;
  }

  p {
    @apply !mb-1;
  }

  ul {
    li {
      @apply ml-4;
      list-style-type: disc;
    }
  }

  ol {
    @apply -ml-6 !pl-4;
    li {
      list-style-type: decimal;
    }
  }

  ul,
  ol {
    @apply !my-0;
  }

  ul[data-type='taskList'] {
    @apply;
    li {
      @apply !ml-0 flex flex-row gap-x-2;
      list-style-type: none;

      input {
        @apply mt-0.75 flex rounded-sm;
        z-index: -10;
      }
      // Unchecked
      input:not(:checked) {
        // Add border to checkbox
        border-width: 1.5px;
        @apply border-gray-700;
      }
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

  h1 {
    font-weight: 700;
    font-size: 1.85rem;
    margin-bottom: 0.1rem;
    line-height: 36px;
  }

  h2 {
    font-weight: 600;
    font-size: 1.55rem;
    margin-bottom: 0.1em;
    line-height: 30px;
  }

  h3 {
    font-weight: 600;
    font-size: 1.15rem;
    margin-bottom: 0.1em;
    line-height: 24px;
  }

  blockquote {
    border-left: 3px solid #d0d5dd;
    padding: 0 1em;
    color: #666;
    margin: 1em 0;
    font-style: italic;
  }

  hr {
    @apply !border-gray-300;
    border: 0;
    border-top: 1px solid #ccc;
    margin: 1.5em 0;
  }

  pre {
    height: fit-content;
  }
}
.nc-form-field-bubble-menu-wrapper {
  @apply absolute -bottom-9 left-1/2 z-50 rounded-lg;
  transform: translateX(-50%);
  box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1);
}
</style>
