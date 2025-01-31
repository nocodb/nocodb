<script lang="ts" setup>
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import Placeholder from '@tiptap/extension-placeholder'
import { NcMarkdownParser, suggestion } from '~/helpers/tiptap'
import { Markdown } from '~/helpers/tiptap-markdown'
import {
  HardBreak,
  Italic,
  Link,
  Strike,
  TaskItem,
  Underline,
  UserMention,
  UserMentionList,
} from '~/helpers/tiptap-markdown/extensions'

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
    hideMention?: boolean
  }>(),
  {
    isFormField: false,
    hiddenBubbleMenuOptions: () => [],
    hideMention: false,
  },
)

const emits = defineEmits(['update:value', 'focus', 'blur', 'close'])

const { fullMode, isFormField, hiddenBubbleMenuOptions } = toRefs(props)

const { appInfo } = useGlobal()

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const rowHeight = inject(RowHeightInj, ref(1 as const))

const readOnlyCell = inject(ReadonlyInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const isFocused = ref(false)

const keys = useMagicKeys()

const meta = inject(MetaInj)!

const { user } = useGlobal()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

const localRowHeight = computed(() => {
  if (readOnlyCell.value && !isExpandedFormOpen.value && (isGallery.value || isKanban.value)) return 6

  return rowHeight.value
})

const shouldShowLinkOption = computed(() => {
  return isFormField.value ? isFocused.value : true
})

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

const mentionUsers = computed(() => {
  return baseUsers.value.filter((user) => user.deleted !== true)
})

const getTiptapExtensions = () => {
  const extensions = [
    StarterKit.configure({
      heading: isFormField.value ? false : undefined,
      strike: false,
      hardBreak: false,
      italic: false,
    }),
    // Marks
    Strike,
    Underline,
    Link,
    Italic,

    // Nodes
    HardBreak,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Placeholder.configure({
      emptyEditorClass: 'is-editor-empty',
      placeholder: props.placeholder,
    }),
    Markdown.configure({ breaks: true, transformPastedText: true }),
  ]

  if (appInfo.value.ee && !props.hideMention) {
    extensions.push(
      UserMention.configure({
        suggestion: {
          ...suggestion(UserMentionList),
          items: ({ query }) =>
            mentionUsers.value
              .map((user) => ({
                id: user.id,
                name: user.display_name,
                email: user.email,
                meta: user.meta,
              }))
              .filter((user) => searchCompare([user.name, user.email], query)),
        },
        users: unref(mentionUsers.value),
        currentUser: unref(user.value),
      }),
    )
  }

  return extensions
}

const editor = useEditor({
  content: vModel.value,
  extensions: getTiptapExtensions(),
  onUpdate: ({ editor }) => {
    vModel.value = editor.storage.markdown.getMarkdown()
  },
  editable: !props.readOnly,
  autofocus: props.autofocus,
  onFocus: () => {
    isFocused.value = true
    emits('focus')
  },
  onBlur: (e) => {
    if (
      !(e?.event?.relatedTarget as HTMLElement)?.closest(
        '.bubble-menu, .nc-textarea-rich-editor, .nc-rich-text, .tippy-box, .mention, .nc-mention-list, .tippy-content',
      )
    ) {
      isFocused.value = false
      emits('blur')
    }
  },
})

const setEditorContent = (contentMd: any) => {
  if (!editor.value) return

  editor.value.commands.setContent(contentMd, false)
}

const onFocusWrapper = () => {
  if (isForm.value && !isFormField.value && !props.readOnly && !keys.shift.value) {
    focusEditor()
  }
}

function focusEditor() {
  if (!editor.value) return

  nextTick(() => {
    editor.value?.chain().focus().run()
  })
}

if (props.syncValueChange) {
  watch([vModel, editor], () => {
    setEditorContent(isFormField.value ? (vModel.value || '')?.replace(/(<br\s*\/?>)+$/g, '') : vModel.value)
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
  if (fullMode.value || isSurveyForm.value) {
    nextTick(() => {
      editor.value?.commands.focus('end')
    })
  }
})

useEventListener(
  editorDom,
  'focusout',
  (e: FocusEvent) => {
    const targetEl = e?.relatedTarget as HTMLElement
    if (
      targetEl?.classList?.contains('tiptap') ||
      !targetEl?.closest(
        '.bubble-menu, .tippy-content, .nc-textarea-rich-editor,  .tippy-box, .mention, .nc-mention-list, .tippy-content',
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
        '.bubble-menu, .tippy-content, .nc-textarea-rich-editor, .tippy-box, .mention, .nc-mention-list, .tippy-content',
      )
    )
      return

    if (
      !targetEl?.closest(
        '.bubble-menu, .tippy-content, .nc-textarea-rich-editor,  .tippy-box, .mention, .nc-mention-list, .tippy-content',
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
      '.bubble-menu,.tippy-content, .nc-textarea-rich-editor, .tippy-box, .mention, .nc-mention-list, .tippy-content',
    )
  ) {
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
        <div class="scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 scrollbar-track-transparent relative">
          <CellRichTextSelectedBubbleMenu
            v-if="editor"
            :editor="editor"
            embed-mode
            :hide-mention="hideMention"
            :is-form-field="isFormField"
            :enable-close-button="fullMode"
            @close="emits('close')"
          />
        </div>
      </div>
      <CellRichTextSelectedBubbleMenuPopup
        v-if="editor && !isFormField && !isForm"
        :editor="editor"
        :hide-mention="hideMention"
      />

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
        class="nc-rich-text-content flex flex-col nc-textarea-rich-editor w-full"
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
            :hide-mention="hideMention"
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
}
.nc-form-field-bubble-menu-wrapper {
  @apply absolute -bottom-9 left-1/2 z-50 rounded-lg;
  transform: translateX(-50%);
  box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1);
}
</style>
