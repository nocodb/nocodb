<script lang="ts" setup>
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { NcMarkdownParser, suggestion } from '~/helpers/tiptap'
import { Markdown } from '~/helpers/tiptap-markdown'

import {
  HardBreak,
  Image,
  Italic,
  Link,
  Paragraph,
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
    /**
     * Ephemeral co-editing identity for this cell. All three must be set for a
     * session to open; every other RichText mount site leaves them undefined and
     * keeps today's single-writer behaviour byte for byte.
     */
    collabTableId?: string | null
    collabRowId?: string | null
    collabColumnId?: string | null
  }>(),
  {
    isFormField: false,
    hiddenBubbleMenuOptions: () => [],
    hideMention: false,
  },
)

const emits = defineEmits(['update:value', 'focus', 'blur', 'close'])

const { fullMode, isFormField, hiddenBubbleMenuOptions } = toRefs(props)

const { appInfo, user } = useGlobal()

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const rowHeight = inject(RowHeightInj, ref(1 as const))

const readOnlyCell = inject(ReadonlyInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const isFocused = ref(false)

// Tracks whether the user has actually typed into this editor since it was last synced from the
// bound value. Used to decide whether an external (collaborative) value change may be pushed into
// a focused editor: a focused-but-idle viewer has no local edits to protect, so it must still sync.
const hasLocalEdits = ref(false)

const keys = useMagicKeys()

const meta = inject(MetaInj)!

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const { activeProjectId } = storeToRefs(basesStore)

// Resolved once, synchronously — the Yjs binding is a tiptap extension, so it is
// fixed when the editor is constructed. A read-only editor never opens a session:
// the user gets today's behaviour, the session keyspace stays bounded to actual
// editors, and nobody types into a buffer the server would silently drop.
const collabSession = props.readOnly
  ? null
  : useCellCollabSession({
      tableId: props.collabTableId,
      rowId: props.collabRowId,
      columnId: props.collabColumnId,
      workspaceId: activeWorkspaceId.value,
      baseId: activeProjectId.value,
    })

const collab = collabSession?.active ? collabSession : null

// Latches true once the shared document can be trusted to represent this cell.
// Until then `onUpdate` does not propagate to vModel.
const collabAuthoritative = ref(false)

/**
 * Latches true when a session we asked for never materialised.
 *
 * `active` only means the client-side gates passed and a subscribe was sent.
 * The server refuses silently — session cap, plan check, per-resource
 * authorization — and every refusal is designed to leave the client on its
 * normal single-writer path. `synced` simply never flips, so without this the
 * editor waits forever: it was mounted EMPTY for the CRDT to fill, and nothing
 * ever fills it, leaving a blank editor over a non-empty cell that then saves
 * the blank over real text.
 */
const collabRefused = ref(false)

/**
 * While a confirmed session is live the SERVER owns persistence — it derives
 * the markdown from the CRDT and writes the cell on a debounce. The client must
 * not also write, or two writers race over one value. The updated value comes
 * back through the normal realtime data broadcast, like any other user's edit.
 */
const collabOwnsPersistence = computed(() => !!collab && collabAuthoritative.value)

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
      paragraph: false,
      // Yjs owns undo/redo when co-editing; two history stacks over one document
      // desync every peer on the first undo.
      ...(collab ? { history: false } : {}),
    }),
    // Marks
    Strike,
    Underline,
    Link,
    Italic,

    // Nodes
    Image,
    Paragraph,
    HardBreak,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Placeholder.configure({
      emptyEditorClass: 'is-editor-empty',
      placeholder: props.placeholder,
    }),
    Markdown.configure({ breaks: true, transformPastedText: true, renderImagesAsLinks: !isEeUI }),
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

  if (collab) {
    extensions.push(
      Collaboration.configure({ document: collab.ydoc!, field: 'default' }),
      // CollaborationCursor only reads `provider.awareness`, so the transport's
      // Awareness instance is passed directly rather than wrapping a y-websocket
      // provider we do not have.
      CollaborationCursor.configure({
        provider: { awareness: collab.awareness! },
        user: collab.user!,
      }),
    )
  }

  return extensions
}

const editor = useEditor({
  // With Collaboration the document comes from the Y.Doc; seeding is the granted
  // bootstrapper's job (see the watcher below). Passing content here too would
  // make EVERY client insert its copy and Yjs would merge them into duplicated
  // text — the exact bug the server's single-seeder grant exists to prevent.
  content: collab ? '' : vModel.value,
  extensions: getTiptapExtensions(),
  onUpdate: ({ editor }) => {
    hasLocalEdits.value = true
    // The server writes this cell while a confirmed session is live; see
    // collabOwnsPersistence.
    if (collabOwnsPersistence.value) return
    // Yjs is not authoritative until the session has converged AND holds content.
    // Before that the shared doc is empty for reasons that have nothing to do
    // with the cell's value, and letting that empty document flow into vModel
    // would save a blank cell over real text. A refused session never converges,
    // so it falls through to the normal save instead of waiting forever.
    if (collab && !collabRefused.value) return
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

if (collab) {
  /**
   * How long to wait for the server's step1 before deciding the subscribe was
   * refused. Generous: a slow first connect must not be mistaken for a refusal,
   * because falling back seeds the editor from the cell and resumes local saves.
   */
  const COLLAB_CONFIRM_TIMEOUT_MS = 8000

  /**
   * Take over the cell locally: show the stored value and resume normal saves.
   * The editor was mounted empty for the CRDT to fill; when nothing will fill it,
   * this is what keeps the cell editable instead of blank-and-unsaveable.
   */
  function fallBackToLocalEditing() {
    if (collabRefused.value || collabAuthoritative.value) return
    collabRefused.value = true
    if (vModel.value) setEditorContent(vModel.value)
  }

  const confirmTimer = setTimeout(() => {
    if (collab.serverAcked.value || collabAuthoritative.value) return
    fallBackToLocalEditing()
  }, COLLAB_CONFIRM_TIMEOUT_MS)

  // Gate on serverAcked, NOT synced: the transport flips `synced` itself after
  // its own shorter timeout, which would clear this timer before it can run and
  // make a refusal indistinguishable from a successful sync.
  watch(collab.serverAcked, (acked) => {
    if (acked) clearTimeout(confirmTimer)
  })

  // The server told us outright, so there is nothing to wait for.
  watch(
    collab.refused,
    (isRefused) => {
      if (isRefused) {
        clearTimeout(confirmTimer)
        fallBackToLocalEditing()
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => clearTimeout(confirmTimer))

  const fragment = collab.ydoc!.getXmlFragment('default')

  function onFragmentChange() {
    // The seeder's content landing is what makes a non-seeder authoritative.
    if (fragment.length > 0 && !collabAuthoritative.value) {
      collabAuthoritative.value = true
      stopFragmentWatch()
    }
  }

  function stopFragmentWatch() {
    fragment.unobserveDeep(onFragmentChange)
  }

  fragment.observeDeep(onFragmentChange)

  /**
   * How long to wait for the granted seeder's content before taking the cell
   * locally. Longer than the confirm timeout — here the server *did* grant a seat
   * to someone, so content is usually in flight and adopting it is preferable.
   */
  const COLLAB_SEED_WAIT_MS = 10000

  let seedWaitTimer: ReturnType<typeof setTimeout> | undefined

  function armSeedWait() {
    if (seedWaitTimer) return
    seedWaitTimer = setTimeout(() => {
      if (fragment.length > 0 || collabAuthoritative.value) return
      fallBackToLocalEditing()
    }, COLLAB_SEED_WAIT_MS)
  }

  onBeforeUnmount(() => clearTimeout(seedWaitTimer))

  watch(
    [collab.synced, collab.mayBootstrap, editor],
    ([synced, mayBootstrap, editorInstance]) => {
      if (!synced || !editorInstance || collabAuthoritative.value) return

      // Someone already holds content — adopt it.
      if (fragment.length > 0) {
        collabAuthoritative.value = true
        stopFragmentWatch()
        return
      }

      if (mayBootstrap) {
        // At most one client across the cluster is granted this. If every client
        // seeded, Yjs would merge each copy and duplicate the cell's text once
        // per participant.
        if (vModel.value) setEditorContent(vModel.value)
        collabAuthoritative.value = true
        stopFragmentWatch()
        return
      }

      // Not the seeder, and the document is empty. If the cell is empty too there
      // is nothing to wait for. Otherwise hold: propagating '' here is the
      // data-loss case, and the seeder's content arrives via onFragmentChange.
      if (!vModel.value) {
        collabAuthoritative.value = true
        stopFragmentWatch()
        return
      }

      // Holding, but not forever. The grant is cluster-wide, so if the seeder
      // disconnected before seeding nobody else will ever be granted it and the
      // wait cannot resolve — leaving a blank editor over a non-empty cell that
      // saves nothing. Bounded wait, then take the cell locally.
      armSeedWait()
    },
    { immediate: true },
  )

  onScopeDispose(stopFragmentWatch)
}

// Yjs owns the document when co-editing is active; the setContent() below is a
// full-document replace, which would blow away the binding's state on every peer
// save. Off the collab path this stays exactly as it was.
if (props.syncValueChange && !collab) {
  watch([vModel, editor], () => {
    // Skip while the user has uncommitted local input that re-running `setContent` would destroy —
    // either they're actively typing (`hasLocalEdits`, keystrokes already flow out via `onUpdate` →
    // `vModel`) or they're mid-IME/CJK composition (`view.composing`; ProseMirror defers transactions
    // until `compositionend`, so `onUpdate` hasn't fired yet and `hasLocalEdits` is still false).
    // Applying an external change in either case would reset the document and jump/corrupt the caret.
    // We still push external value changes in when the editor is NOT focused (e.g. switching which
    // record/field this editor is bound to) OR when it's focused but idle — e.g. someone opened the
    // long-text editor merely to read it while another user updated the same field. Without this, the
    // open editor keeps showing stale content and the concurrent change appears to "disappear".
    if (isFocused.value && (hasLocalEdits.value || editor.value?.view?.composing)) return

    setEditorContent(isFormField.value ? (vModel.value || '')?.replace(/(<br\s*\/?>)+$/g, '') : vModel.value)

    // Content now mirrors the bound value again — clear the dirty flag so subsequent external
    // changes keep syncing.
    hasLocalEdits.value = false
  })
}

// Reset the local-edits flag whenever the editor loses focus so the next external value change is
// applied even if the user had typed earlier.
watch(isFocused, (focused) => {
  if (!focused) hasLocalEdits.value = false
})

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
          'justify-start !left-0 !right-0 !max-w-full !rounded-none': isForm,
          'justify-end xs:hidden max-w-[calc(100%_-_2px)]': !isForm,
        }"
      >
        <div class="nc-scrollbar-thin relative">
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
        hide-on-select-all-sortcut
      />

      <template v-if="shouldShowLinkOption">
        <CellRichTextLinkOrImageOptions
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
          'nc-scrollbar-thin': !fullMode || (!fullMode && isExpandedFormOpen),
          'flex-grow': isExpandedFormOpen,
          [`!overflow-hidden nc-rich-truncate nc-line-clamp-${rowHeightTruncateLines(localRowHeight)}`]:
            !fullMode && readOnly && localRowHeight && !isExpandedFormOpen && !isForm,
        }"
        @click="readOnly ? handleDompurifyLinkClick($event) : undefined"
        @keydown.alt.stop
        @keydown.alt.enter.stop
        @keydown.shift.enter.stop
        @keydown.down.stop
        @keydown.left.stop
        @keydown.right.stop
        @keydown.up.stop
        @keydown.delete.stop
        @selectstart.capture.stop
        @mousedown.stop
        @keydown.esc="handleOnEscRichTextEditor($event, editor)"
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
// Remote collaborator carets. CollaborationCursor renders these spans with an
// inline colour per user; without these rules they have no geometry and are
// invisible.
.nc-rich-text {
  .collaboration-cursor__caret {
    @apply relative pointer-events-none;

    border-left: 1px solid;
    border-right: 1px solid;
    margin-left: -1px;
    margin-right: -1px;
    word-break: normal;
  }

  .collaboration-cursor__label {
    @apply absolute left-[-1px] text-white whitespace-nowrap select-none;

    top: -1.4em;
    border-radius: 3px 3px 3px 0;
    font-size: 12px;
    font-weight: 600;
    line-height: normal;
    padding: 0.1rem 0.3rem;
    user-select: none;
  }
}

.nc-text-rich-scroll {
  &::-webkit-scrollbar-thumb {
    @apply bg-transparent;
  }
}
.nc-text-rich-scroll:hover {
  &::-webkit-scrollbar-thumb {
    @apply bg-nc-bg-gray-medium;
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
        background-color: var(--nc-bg-gray-dark) !important;
        &:not(:checked) {
          @apply !border-nc-border-gray-extradark;
        }
        &:focus {
          box-shadow: none !important;
          background-color: var(--nc-bg-gray-dark) !important;
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

      @supports (height: 100dvh) {
        max-height: min(800px, calc(100dvh - 200px)) !important;
      }
    }
  }
}

.nc-rich-text-full {
  @apply px-3;
  .ProseMirror {
    @apply !p-2 h-[min(797px,100dvh_-_170px)] w-[min(1256px,100vw_-_124px)];
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin !important;
    resize: both;
    min-height: 215px;
    max-height: min(797px, calc(100vh - 170px));
    min-width: 256px;
    max-width: min(1256px, 100vw - 126px);

    @supports (height: 100dvh) {
      max-height: min(797px, calc(100dvh - 170px));
    }

    @media (max-width: 767px) {
      min-width: 100%;
      max-width: min(1256px, 100vw - 58px);
    }
  }
  &.readonly {
    .ProseMirror {
      @apply bg-nc-bg-gray-extralight;
    }
  }
}

.nc-textarea-rich-editor {
  &.nc-rich-truncate {
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
    @apply flex-grow pt-1.5 border-1 border-nc-border-gray-medium rounded-lg;

    > * {
      @apply ml-1;
    }
  }
  .ProseMirror-focused {
    // remove all border
    outline: none;
    @apply border-nc-border-brand;
  }
}
.nc-form-field-bubble-menu-wrapper {
  @apply absolute -bottom-9 left-1/2 z-50 rounded-lg;
  transform: translateX(-50%);
  box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1);
}
</style>
