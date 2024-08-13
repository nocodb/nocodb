<script lang="ts" setup>
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import TurndownService from 'turndown'
import { marked } from 'marked'
import { generateJSON } from '@tiptap/html'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import tippy from 'tippy.js'
import { Link } from '~/helpers/dbTiptapExtensions/links'

const props = withDefaults(
  defineProps<{
    hideOptions?: boolean
    value?: string | null
    readOnly?: boolean
    syncValueChange?: boolean
    autofocus?: boolean
    placeholder?: string
    renderAsText?: boolean
  }>(),
  {
    hideOptions: true,
  },
)

const emits = defineEmits(['update:value', 'focus', 'blur', 'save'])

const isGrid = inject(IsGridInj, ref(false))

const isFocused = ref(false)

const keys = useMagicKeys()

const turndownService = new TurndownService({})

turndownService.addRule('lineBreak', {
  filter: (node) => {
    return node.nodeName === 'BR'
  },
  replacement: () => {
    return '<br />'
  },
})

turndownService.addRule('strikethrough', {
  filter: ['s'],
  replacement: (content) => {
    return `~${content}~`
  },
})

turndownService.keep(['u', 'del'])

const editorDom = ref<HTMLElement | null>(null)

const richTextLinkOptionRef = ref<HTMLElement | null>(null)

const vModel = useVModel(props, 'value', emits, { defaultValue: '' })

const tiptapExtensions = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    code: false,
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
    let markdown = turndownService.turndown(editor.getHTML().replaceAll(/<p><\/p>/g, '<br />'))

    const isListsActive = editor?.isActive('bulletList') || editor?.isActive('orderedList') || editor?.isActive('blockquote')
    if (isListsActive) {
      if (markdown.endsWith('<br />')) markdown = markdown.slice(0, -6)
    }

    markdown = markdown.replaceAll(/\n\n<br \/>\n\n/g, '<br>\n\n')

    vModel.value = markdown === '<br />' ? '' : `${markdown}`
  },
  editable: !props.readOnly,
  autofocus: props.autofocus,
  onFocus: () => {
    isFocused.value = true
    emits('focus')
    onFocusWrapper()
  },
  onBlur: (e) => {
    const targetEl = e?.event.relatedTarget as HTMLElement

    if (!targetEl) return

    if (
      !targetEl?.closest(
        '.comment-bubble-menu, .nc-rich-text-comment, .tippy-box, .nc-comment-save-btn, .rich-text-bottom-bar, .mention, .nc-mention-list, .tippy-content, .nc-comment-rich-editor',
      )
    ) {
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

function onFocusWrapper() {
  if (!props.readOnly && !keys.shift.value) {
    editor.value?.chain().focus().run()
    setEditorContent(vModel.value, true)
  }
}

if (props.syncValueChange) {
  watch([vModel, editor], () => {
    setEditorContent(vModel.value)
  })
}

useEventListener(
  editorDom,
  'focusout',
  (e: FocusEvent) => {
    const targetEl = e?.relatedTarget as HTMLElement
    if (
      targetEl?.classList?.contains('tiptap') ||
      !targetEl?.closest(
        '.comment-bubble-menu, .nc-rich-text-comment, .tippy-box, .nc-comment-save-btn, .rich-text-bottom-bar, .mention, .nc-mention-list, .tippy-content, .nc-comment-rich-editor',
      )
    ) {
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
    if (
      !targetEl &&
      (e.target as HTMLElement)?.closest(
        '.comment-bubble-menu, .nc-comment-save-btn, .nc-mention-list, .mention, .rich-text-bottom-bar, .tippy-content, .nc-comment-rich-editor',
      )
    )
      return

    if (
      !targetEl?.closest(
        '.comment-bubble-menu, .nc-comment-save-btn, .rich-text-bottom-bar, .mention, .tippy-content, .nc-mention-list, .nc-comment-rich-editor',
      )
    ) {
      isFocused.value = false

      emits('blur')
    }
  },
  true,
)
onClickOutside(editorDom, (e) => {
  if (!isFocused.value) return

  const targetEl = e?.target as HTMLElement

  if (
    !targetEl?.closest(
      '.tippy-content, .nc-rich-text-comment, .nc-comment-save-btn, .nc-mention-list, .rich-text-bottom-bar, .mention, .comment-bubble-menu, .nc-comment-rich-editor',
    )
  ) {
    isFocused.value = false
    emits('blur')
  }
})

const triggerSaveFromList = ref(false)

const emitSave = (event: KeyboardEvent) => {
  if (editor.value) {
    if (triggerSaveFromList.value) {
      // If Enter was pressed in the list, do not emit save
      triggerSaveFromList.value = false
    } else {
      if (editor.value.isActive('bulletList') || editor.value.isActive('orderedList') || editor.value.isActive('blockquote')) {
        event.stopPropagation()
      } else {
        emits('save')
      }
    }
  }
}

const handleEnterDown = (event: KeyboardEvent) => {
  const isListsActive =
    editor.value?.isActive('bulletList') || editor.value?.isActive('orderedList') || editor.value?.isActive('blockquote')
  if (isListsActive) {
    triggerSaveFromList.value = true
    setTimeout(() => {
      triggerSaveFromList.value = false
    }, 1000)
  } else {
    emitSave(event)
  }
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.altKey && event.key === 'Enter') {
    event.stopPropagation()
  } else if (event.shiftKey && event.key === 'Enter') {
    event.stopPropagation()
  } else if (event.key === 'Enter') {
    handleEnterDown(event)
  } else if (event.key === 'Escape') {
    isFocused.value = false
    emits('blur')
  }
}

const saveComment = (e) => {
  e.preventDefault()
  e.stopPropagation()
  emits('save')
}

defineExpose({
  setEditorContent,
})

onMounted(() => {
  if (!props.readOnly) return

  setTimeout(() => {
    document.querySelectorAll('.nc-rich-link-tooltip').forEach((el) => {
      const tooltip = Object.values(el.attributes).find((attr) => attr.name === 'data-tooltip')
      if (!tooltip) return
      tippy(el, {
        content: `<span class="tooltip">${tooltip.value}</span>`,
        placement: 'top',
        allowHTML: true,
        arrow: true,
        animation: 'fade',
        duration: 0,
      })
    })
  }, 1000)
})
</script>

<template>
  <div
    :class="{
      'readonly': readOnly,
      'nc-rich-text-grid': isGrid,
    }"
    :tabindex="1"
    class="nc-rich-text-comment flex flex-col w-full h-full"
    @focus="onFocusWrapper"
  >
    <div v-if="renderAsText" class="truncate">
      <span v-if="editor"> {{ editor?.getText() ?? '' }}</span>
    </div>
    <template v-else>
      <CellRichTextLinkOptions
        v-if="editor"
        ref="richTextLinkOptionRef"
        :editor="editor"
        :is-comment="true"
        :is-form-field="true"
        @blur="isFocused = false"
      />

      <EditorContent
        ref="editorDom"
        :editor="editor"
        :class="{
          'p-1': !props.readOnly,
          'px-[0.25rem]': props.readOnly,
        }"
        class="flex flex-col nc-comment-rich-editor w-full scrollbar-thin scrollbar-thumb-gray-200 nc-truncate scrollbar-track-transparent"
        @keydown.stop="handleKeyPress"
      />

      <div v-if="!hideOptions" class="flex justify-between pt-1 rich-text-bottom-bar items-center">
        <LazySmartsheetExpandedFormRichTextOptions :editor="editor" class="!bg-transparent" />
        <NcButton
          v-e="['a:row-expand:comment:save']"
          :disabled="!vModel?.length"
          class="!disabled:bg-gray-100 nc-comment-save-btn !h-7 !w-7 !shadow-none"
          size="xsmall"
          @click="saveComment"
        >
          <GeneralIcon icon="send" />
        </NcButton>
      </div>
    </template>
  </div>
</template>

<style lang="scss">
.tooltip {
  @apply text-xs bg-gray-800 text-white px-2 py-1 rounded-lg;
}

.nc-rich-text-comment {
  .readonly {
    .nc-comment-rich-editor {
      .ProseMirror {
        resize: none;
        white-space: pre-line;
      }
    }
  }

  .nc-rich-link-tooltip {
    @apply text-gray-500;
  }

  .nc-comment-rich-editor {
    &.nc-truncate {
      .tiptap.ProseMirror {
        display: -webkit-box;
        max-width: 100%;
        outline: none;
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
      @apply text-gray-500;
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }

    .ProseMirror {
      @apply flex-grow !border-0 rounded-lg;
      caret-color: #3366ff;
    }

    p {
      @apply !m-0 !leading-5;
    }

    .ProseMirror-focused {
      // remove all border
      outline: none;
    }

    ul {
      li {
        @apply ml-4;
        list-style-type: disc;
      }
    }

    ol {
      @apply !pl-4;
      li {
        list-style-type: decimal;
      }
    }

    ul,
    ol {
      @apply !my-0;
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
}
</style>
