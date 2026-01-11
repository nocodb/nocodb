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
  Paragraph,
  Strike,
  TaskItem,
  Underline,
  UserMention,
  UserMentionList,
} from '~/helpers/tiptap-markdown/extensions'

// ✅ NEW imports
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'

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

const baseUsers = computed(() =>
  meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : [],
)

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
  get: () => NcMarkdownParser.preprocessMarkdown(props.value, true),
  set: (v: any) => emits('update:value', v),
})

const mentionUsers = computed(() =>
  baseUsers.value.filter((user) => user.deleted !== true),
)

// ✅ Add Superscript + Subscript here
const getTiptapExtensions = () => {
  const extensions = [
    StarterKit.configure({
      heading: isFormField.value ? false : undefined,
      strike: false,
      hardBreak: false,
      italic: false,
      paragraph: false,
    }),
    // Marks
    Strike,
    Underline,
    Link,
    Italic,
    Superscript,
    Subscript,

    // Nodes
    Paragraph,
    HardBreak,
    TaskList,
    TaskItem.configure({ nested: true }),
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

function setEditorContent(contentMd: any) {
  if (!editor.value) return
  editor.value.commands.setContent(contentMd, false)
}

function focusEditor() {
  if (!editor.value) return
  nextTick(() => {
    editor.value?.chain().focus().run()
  })
}

const onFocusWrapper = () => {
  if (isForm.value && !isFormField.value && !props.readOnly && !keys.shift.value) {
    focusEditor()
  }
}

if (props.syncValueChange) {
  watch([vModel, editor], () => {
    setEditorContent(
      isFormField.value ? (vModel.value || '')?.replace(/(<br\s*\/?>)+$/g, '') : vModel.value,
    )
  })
}

if (isFormField.value) {
  watch([props, editor], () => {
    if (props.readOnly) editor.value?.setEditable(false)
    else editor.value?.setEditable(true)
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
        '.bubble-menu, .tippy-content, .nc-textarea-rich-editor, .tippy-box, .mention, .nc-mention-list, .tippy-content',
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
      <span v-if="editor">{{ editor?.getText() ?? '' }}</span>
    </div>

    <template v-else>
      <EditorContent
        ref="editorDom"
        :editor="editor"
        class="nc-rich-text-content flex flex-col nc-textarea-rich-editor w-full"
        :class="{
          'mt-2.5 flex-grow': fullMode,
          'scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent':
            !fullMode || (!fullMode && isExpandedFormOpen),
          'flex-grow': isExpandedFormOpen,
          [`!overflow-hidden nc-rich-truncate nc-line-clamp-${rowHeightTruncateLines(localRowHeight)}`]:
            !fullMode && readOnly && localRowHeight && !isExpandedFormOpen && !isForm,
        }"
      />
    </template>
  </div>
</template>

