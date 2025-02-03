<script lang="ts" setup>
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { NcMarkdownParser } from '~/helpers/tiptap'
import { Markdown } from '~/helpers/tiptap-markdown'
import { HardBreak, Italic, Link, Strike } from '~/helpers/tiptap-markdown/extensions'

const props = withDefaults(
  defineProps<{
    hideOptions?: boolean
    value?: string | null
    readOnly?: boolean
    syncValueChange?: boolean
    autofocus?: boolean
    autofocusToEnd?: boolean
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

const editorDom = ref<HTMLElement | null>(null)

const richTextLinkOptionRef = ref<HTMLElement | null>(null)

const vModel = computed({
  get: () => {
    return NcMarkdownParser.preprocessMarkdown(props.value, true)
  },
  set: (v: any) => {
    emits('update:value', v)
  },
})

const tiptapExtensions = [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    code: false,
    strike: false,
    hardBreak: false,
    italic: false,
  }),
  Strike,
  Underline,
  Link,
  Italic,

  HardBreak,
  Placeholder.configure({
    emptyEditorClass: 'is-editor-empty',
    placeholder: props.placeholder,
  }),
  Markdown.configure({ breaks: true, transformPastedText: false }),
]

function isOnlyBrTagsAndSpaces(str?: string) {
  if (!str || !str?.trim()) {
    return true
  }

  // Match any number of <br> tags with optional spaces
  const regex = /^\s*(<br\s*\/?>\s*)*$/i
  return regex.test(str)
}

const editor = useEditor({
  content: vModel.value,
  extensions: tiptapExtensions,
  onUpdate: ({ editor }) => {
    let markdown = editor.storage.markdown.getMarkdown()

    const isListsActive = editor?.isActive('bulletList') || editor?.isActive('orderedList') || editor?.isActive('blockquote')
    if (isListsActive) {
      if (markdown.endsWith('<br>')) markdown = markdown.slice(0, -4)
      if (markdown.endsWith('<br> ')) markdown = markdown.slice(0, -5)
    }

    vModel.value = isOnlyBrTagsAndSpaces(markdown) ? '' : `${markdown}`
  },
  editable: !props.readOnly,
  autofocus: props.autofocus,
  onCreate: () => {
    if (props.autofocusToEnd) {
      nextTick(() => {
        editor.value?.commands.setContent(vModel.value)
      })
    }
  },
  onFocus: () => {
    isFocused.value = true
    emits('focus')
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
  editor.value.commands.setContent(contentMd, false)

  if (focusEndOfDoc) {
    focusEditor()
  }
}

function onFocusWrapper() {
  if (!props.readOnly && !keys.shift.value) {
    editor.value?.chain().focus().run()
  }
}

function focusEditor() {
  if (!editor.value) return

  nextTick(() => {
    editor.value?.chain().focus().run()
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

let timerId: any

const handleEnterDown = (event: KeyboardEvent) => {
  if (!vModel.value?.length) {
    setEditorContent('')
    return
  }

  if (timerId) {
    clearTimeout(timerId)
  }

  const isListsActive =
    editor.value?.isActive('bulletList') || editor.value?.isActive('orderedList') || editor.value?.isActive('blockquote')

  if (isListsActive) {
    triggerSaveFromList.value = true
    timerId = setTimeout(() => {
      triggerSaveFromList.value = false
    }, 1000)
  } else emitSave(event)
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

    document.querySelector('.nc-drawer-expanded-form.active > div[tabindex="0"]')?.focus?.()
  }
}

const saveComment = (e) => {
  e.preventDefault()
  e.stopPropagation()
  emits('save')
}

defineExpose({
  setEditorContent,
  focusEditor,
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
        class="nc-rich-text-content flex flex-col nc-comment-rich-editor w-full scrollbar-thin scrollbar-thumb-gray-200 nc-truncate scrollbar-track-transparent"
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
          <GeneralIcon icon="ncSendAlt" />
        </NcButton>
      </div>
    </template>
  </div>
</template>

<style lang="scss">
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
  }
}
</style>
