<script setup lang="ts">
import type { CommentType, TableType } from 'nocodb-sdk'
import type { Editor } from '@tiptap/vue-3'
import type { DocCommentExtended } from '~/composables/useDocumentComments'

interface Props {
  docId: string
  baseId?: string
  editor?: Editor | null
  pendingSelection?: { from: number; to: number } | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'clearPendingSelection'): void
}>()

const { docId } = toRefs(props)

const { user } = useGlobal()

// Provide MetaInj stub so SmartsheetExpandedFormRichComment's @mentions lookup doesn't crash
provide(MetaInj, computed(() => ({ base_id: props.baseId } as TableType)))

const { isUIAllowed } = useRoles()

const {
  comments,
  isCommentsLoading,
  parsedHtmlComments,
  threadedComments,
  replyingTo,
  setReplyingTo,
  clearReplyingTo,
  loadComments,
  saveComment,
  updateComment,
  deleteComment,
  resolveComment,
  activeCommentId,
  scrollToComment,
  clearActiveComment,
} = useDocumentComments()

const hasEditPermission = computed(() => isUIAllowed('documentCommentUpdate'))

// When a comment in a thread is active (clicked from editor anchor), highlight the
// entire thread (parent + all replies). Resolves reply → parent so the whole group lights up.
const activeThreadId = computed(() => {
  if (!activeCommentId.value) return null
  const active = comments.value.find((c) => c.id === activeCommentId.value)
  if (!active) return null
  return active.parent_comment_id || active.id
})

const commentsWrapperEl = ref<HTMLDivElement>()
const commentInputRef = ref<any>()
const comment = ref('')
const editCommentValue = ref<CommentType>()
const isEditing = ref(false)

// Extract selected text from editor when there's a pending inline selection
const pendingSelectionText = computed(() => {
  if (!props.pendingSelection || !props.editor) return ''
  const { from, to } = props.pendingSelection
  try {
    return props.editor.state.doc.textBetween(from, to, ' ')
  } catch {
    return ''
  }
})

const onCancelInlineComment = () => {
  emit('clearPendingSelection')
}

const replyInputRef = ref<any>()
const replyText = ref('')
const isReplyFocused = ref(false)
const isCommentFocused = ref(false)

/** Strip trailing `<br />` tags and newlines that TipTap appends before save. */
function stripTrailingBreaks(val: string): string {
  let result = val
  while (result.endsWith('<br />') || result.endsWith('\n')) {
    if (result.endsWith('<br />')) result = result.slice(0, -6)
    else result = result.slice(0, -1)
  }
  return result
}

/** Build an optimistic comment object for immediate UI display before the API responds. */
function createOptimisticComment(text: string, extra: Partial<DocCommentExtended> = {}): DocCommentExtended {
  return {
    id: `temp-${Date.now()}`,
    comment: text,
    created_at: new Date().toISOString(),
    created_by: user.value?.id,
    created_by_email: user.value?.email,
    created_display_name: user.value?.display_name ?? '',
    created_display_name_short: user.value?.display_name ?? extractNameFromEmail(user.value?.email),
    created_by_meta: user.value?.meta ?? '',
    ...extra,
  }
}

const onReply = (commentItem: DocCommentExtended) => {
  setReplyingTo(commentItem)
  replyText.value = ''
}

const onCancelReply = () => {
  clearReplyingTo()
  replyText.value = ''
  isReplyFocused.value = false
}

const onSaveReply = async () => {
  if (!replyText.value.trim() || !replyingTo.value?.id) return

  const val = stripTrailingBreaks(replyText.value)
  const parentCommentId = replyingTo.value.id

  comments.value = [...comments.value, createOptimisticComment(val, { parent_comment_id: parentCommentId })]

  replyText.value = ''
  clearReplyingTo()

  await nextTick()
  scrollComments()

  await saveComment(val, null, parentCommentId)

  await nextTick()
  scrollComments()
}

// Track editor doc version to force anchorTextMap recompute when content changes.
// ProseMirror doc changes aren't reactive — this counter bridges the gap.
const editorDocVersion = ref(0)
let editorUpdateHandler: (() => void) | null = null

watch(
  () => props.editor,
  (ed, oldEd) => {
    // Clean up listener from previous editor instance
    if (oldEd && editorUpdateHandler) {
      oldEd.off('update', editorUpdateHandler)
    }
    if (!ed) return
    editorUpdateHandler = () => { editorDocVersion.value++ }
    ed.on('update', editorUpdateHandler)
    editorDocVersion.value++
  },
  { immediate: true },
)

// Also recompute when comments load (marks may already exist in editor)
watch(() => comments.value?.length, () => {
  editorDocVersion.value++
})

// Build a map of anchor_id → referenced text by walking ProseMirror doc marks.
// Used to show the quoted text snippet on inline (anchor-based) comments.
const anchorTextMap = computed<Record<string, string>>(() => {
  // eslint-disable-next-line no-unused-expressions
  editorDocVersion.value // reactive dependency — triggers recompute when editor content changes
  if (!props.editor) return {}
  const map: Record<string, string> = {}
  const { doc } = props.editor.state
  doc.descendants((node) => {
    if (!node.isText || !node.marks.length) return
    for (const mark of node.marks) {
      if (mark.type.name === 'docComment' && mark.attrs.commentId) {
        const id = mark.attrs.commentId
        map[id] = (map[id] || '') + (node.text || '')
      }
    }
  })
  return map
})

// Auto-focus comment input when sidebar opens with a pending inline selection
watch(
  () => props.pendingSelection,
  (val) => {
    if (val) {
      nextTick(() => {
        commentInputRef.value?.focusEditor?.()
      })
    }
  },
  { immediate: true },
)

// Load comments when docId changes
watch(
  docId,
  async (id) => {
    if (id) {
      await loadComments(id)
    }
  },
  { immediate: true },
)

function scrollComments() {
  if (commentsWrapperEl.value) {
    commentsWrapperEl.value.scrollTo({
      top: commentsWrapperEl.value.scrollHeight,
      behavior: 'smooth',
    })
  }
}

const onSaveComment = async () => {
  if (!comment.value.trim()) return

  const val = stripTrailingBreaks(comment.value)

  // If there's a pending text selection, create an inline comment with anchor mark
  let anchorId: string | null = null
  if (props.pendingSelection && props.editor) {
    const { from, to } = props.pendingSelection
    anchorId = `cmt_${Date.now().toString(36)}`
    props.editor.chain().focus().setTextSelection({ from, to }).setCommentMark({ commentId: anchorId }).run()
    emit('clearPendingSelection')
  }

  comments.value = [...comments.value, createOptimisticComment(val, { anchor_id: anchorId })]

  const tempComment = val
  comment.value = ''
  commentInputRef.value?.setEditorContent('', true)

  await nextTick()
  scrollComments()

  await saveComment(tempComment, anchorId)

  await nextTick()
  scrollComments()
  commentInputRef.value?.focusEditor?.()
}

function editComment(commentItem: CommentType) {
  editCommentValue.value = { ...commentItem }
  isEditing.value = true
}

const editValue = computed({
  get: () => editCommentValue.value?.comment || '',
  set: (val) => {
    if (editCommentValue.value) editCommentValue.value.comment = val
  },
})

async function onEditComment() {
  if (!isEditing.value || !editCommentValue.value?.comment) return

  const val = stripTrailingBreaks(editCommentValue.value.comment)

  const tempComment = { ...editCommentValue.value, comment: val }
  isEditing.value = false
  editCommentValue.value = undefined

  await updateComment(tempComment.id!, tempComment.comment!)
}

function cancelEdit() {
  if (!isEditing.value) return
  editCommentValue.value = undefined
  isEditing.value = false
}

function onCancelEdit(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()
  cancelEdit()
}

// Stop propagation for all keys except Escape so the doc editor doesn't capture them
const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    event.stopPropagation()
  }
}

// Auto-scroll to bottom when new comments are added
watch(
  () => comments.value?.length,
  () => {
    nextTick(() => scrollComments())
  },
)

/** Scroll the comments wrapper so the active comment is centered — without using
 *  scrollIntoView which can bubble up and scroll outer ancestors, causing layout shifts. */
function scrollToActiveComment() {
  const id = activeCommentId.value
  if (!id || !commentsWrapperEl.value) return
  nextTick(() => {
    const el = commentsWrapperEl.value?.querySelector(`[data-comment-item-id="${id}"]`) as HTMLElement | null
    if (!el) return
    const container = commentsWrapperEl.value!
    const elTop = el.offsetTop - container.offsetTop
    const scrollTarget = elTop - (container.clientHeight - el.offsetHeight) / 2
    container.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' })
  })
}

/** Scroll the editor to the comment mark and briefly flash-highlight it.
 *  Uses DOM lookup instead of setTextSelection to avoid triggering the bubble menu. */
function scrollEditorToAnchor(anchorId: string) {
  if (!props.editor) return

  const markEl = props.editor.view.dom.querySelector(`[data-comment-id="${anchorId}"]`) as HTMLElement | null
  if (!markEl) return

  // Find the editor's scroll container (the overflow-y-auto wrapper)
  const scrollContainer = props.editor.view.dom.closest('.overflow-y-auto') as HTMLElement | null
  if (!scrollContainer) return

  // Center the mark in the scroll container
  const markRect = markEl.getBoundingClientRect()
  const containerRect = scrollContainer.getBoundingClientRect()
  const scrollTarget = scrollContainer.scrollTop + (markRect.top - containerRect.top) - (containerRect.height - markEl.offsetHeight) / 2
  scrollContainer.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' })

  // Flash-highlight to draw attention
  markEl.classList.remove('nc-doc-comment-mark-flash')
  void markEl.offsetWidth // force reflow to restart animation if already present
  markEl.classList.add('nc-doc-comment-mark-flash')
}

// Scroll when activeCommentId changes (sidebar already open, user clicked an anchor in editor)
watch(activeCommentId, (id) => {
  if (id) scrollToActiveComment()
})

// After comments finish loading (sidebar just opened): scroll to active comment or focus input
watch(isCommentsLoading, (loading, wasLoading) => {
  if (wasLoading && !loading) {
    if (activeCommentId.value) {
      scrollToActiveComment()
    } else {
      nextTick(() => {
        commentInputRef.value?.focusEditor?.()
      })
    }
  }
})

// Clear active comment highlight when clicking anywhere outside a comment card
const onDocumentClick = (e: MouseEvent) => {
  if (!activeCommentId.value) return
  const target = e.target as HTMLElement
  if (target.closest('.nc-doc-thread-card') || target.closest('.nc-doc-comment-item')) return
  clearActiveComment()
}

onMounted(() => document.addEventListener('click', onDocumentClick, true))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick, true))
</script>

<template>
  <div class="nc-doc-comments-sidebar flex flex-col border-l-1 border-nc-border-gray-medium bg-nc-bg-default overflow-hidden" data-testid="nc-doc-comments-sidebar">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2.5 border-b-1 border-nc-border-gray-medium flex-none">
      <div class="flex items-center gap-2">
        <span class="font-semibold text-sm text-nc-content-gray">{{ $t('general.comments') }}</span>
        <!-- NOTE: counts all comments including replies. Consider showing only top-level thread count. -->
        <NcBadge v-if="comments.length" color="brand" size="xs" class="nc-doc-comment-count text-[11px] font-semibold">
          {{ comments.length > 99 ? '99+' : comments.length }}
        </NcBadge>
      </div>
      <NcButton size="xsmall" type="text" data-testid="nc-doc-comments-close-btn" @click="emit('close')">
        <GeneralIcon icon="close" />
      </NcButton>
    </div>

    <!-- Loading state -->
    <div v-if="isCommentsLoading" class="flex flex-col items-center justify-center flex-1 overflow-hidden">
      <GeneralLoader size="xlarge" />
    </div>

    <!-- Empty state -->
    <div v-else-if="comments.length === 0" class="flex flex-col my-1 text-center justify-center flex-1 overflow-hidden">
      <div class="text-3xl text-nc-content-gray-subtle">
        <GeneralIcon icon="commentHere" />
      </div>
      <div class="font-medium my-4 text-nc-content-gray-muted text-sm">
        {{ hasEditPermission ? $t('activity.startCommenting') : $t('activity.noCommentsYet') }}
      </div>
    </div>

    <!-- Comments list -->
    <div v-else ref="commentsWrapperEl" class="flex flex-col flex-1 py-1 nc-scrollbar-thin overflow-y-auto">
      <template v-for="(threadItem, index) of threadedComments" :key="threadItem.id">
        <div
          class="nc-doc-thread-card mx-3 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight transition-all duration-150"
          :class="{
            'bg-nc-bg-gray-light shadow-sm': activeThreadId === threadItem.id,
            'opacity-40': !!activeCommentId && activeThreadId !== threadItem.id,
            'mt-auto': index === 0,
            'mt-1.5': index > 0,
          }"
        >
          <!-- Parent: edit mode -->
          <div v-if="threadItem.id === editCommentValue?.id && hasEditPermission" class="p-2">
            <div class="nc-doc-comment-box rounded-lg border-1 border-nc-border-gray-medium overflow-hidden nc-doc-comment-box-focused">
              <SmartsheetExpandedFormRichComment
                v-model:value="editValue"
                autofocus
                autofocus-to-end
                :hide-options="true"
                :show-bubble-menu="true"
                class="expanded-form-comment-input !py-1.5 !px-2 cursor-text w-full !border-0 bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
                @save="onEditComment"
                @keydown.esc="onCancelEdit"
                @keydown="handleKeyPress"
              />
              <div class="flex items-center justify-end gap-1 px-1.5 pb-1.5">
                <NcTooltip>
                  <!-- mousedown.prevent keeps focus in the editor so blur doesn't fire before click -->
                  <NcButton size="xsmall" type="text" class="!text-nc-content-gray-muted" @mousedown.prevent @click="cancelEdit">
                    <GeneralIcon icon="close" class="text-xs" />
                  </NcButton>
                  <template #title>{{ $t('general.cancel') }}</template>
                </NcTooltip>
                <NcTooltip>
                  <NcButton size="xsmall" type="primary" :disabled="!editValue.trim()" @mousedown.prevent @click="onEditComment">
                    <GeneralIcon icon="ncSendAlt" />
                  </NcButton>
                  <template #title>{{ $t('general.save') }}</template>
                </NcTooltip>
              </div>
            </div>
          </div>

          <!-- Parent: display mode -->
          <DocCommentsItem
            v-else
            :data-comment-item-id="threadItem.id"
            :comment="threadItem"
            :parsed-html="parsedHtmlComments[threadItem.id!] || ''"
            :is-owner="threadItem.created_by === user?.id"
            :anchor-text="threadItem.anchor_id ? anchorTextMap[threadItem.anchor_id] : undefined"
            @edit="editComment(threadItem)"
            @delete="deleteComment(threadItem.id!)"
            @resolve="resolveComment(threadItem.id!)"
            @activate="activeCommentId === threadItem.id ? clearActiveComment() : scrollToComment(threadItem.id!)"
            @reply="onReply(threadItem)"
            @scroll-to-anchor="scrollEditorToAnchor"
          />

          <!-- Replies (single-level — nested under their parent thread) -->
          <template v-for="replyItem of threadItem.replies" :key="replyItem.id">
            <div class="border-t border-dashed border-nc-border-gray-medium mx-3" />

            <!-- Reply: edit mode -->
            <div v-if="replyItem.id === editCommentValue?.id && hasEditPermission" class="p-2">
              <div class="nc-doc-reply-box rounded-lg border-1 border-nc-border-gray-medium overflow-hidden nc-doc-reply-box-focused">
                <SmartsheetExpandedFormRichComment
                  v-model:value="editValue"
                  autofocus
                  autofocus-to-end
                  :hide-options="true"
                  :show-bubble-menu="true"
                  class="expanded-form-comment-reply-input !py-1.5 !px-2 cursor-text w-full !border-0 bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[120px]"
                  @save="onEditComment"
                  @keydown.esc="onCancelEdit"
                  @keydown="handleKeyPress"
                />
                <div class="flex items-center justify-end gap-1 px-1.5 pb-1.5">
                  <NcTooltip>
                    <NcButton size="xsmall" type="text" class="!text-nc-content-gray-muted" @mousedown.prevent @click="cancelEdit">
                      <GeneralIcon icon="close" class="text-xs" />
                    </NcButton>
                    <template #title>{{ $t('general.cancel') }}</template>
                  </NcTooltip>
                  <NcTooltip>
                    <NcButton size="xsmall" type="primary" :disabled="!editValue.trim()" @mousedown.prevent @click="onEditComment">
                      <GeneralIcon icon="ncSendAlt" />
                    </NcButton>
                    <template #title>{{ $t('general.save') }}</template>
                  </NcTooltip>
                </div>
              </div>
            </div>

            <!-- Reply: display mode -->
            <DocCommentsItem
              v-else
              :data-comment-item-id="replyItem.id"
              :comment="replyItem"
              :parsed-html="parsedHtmlComments[replyItem.id!] || ''"
              :is-owner="replyItem.created_by === user?.id"
              :is-reply="true"
              @edit="editComment(replyItem)"
              @delete="deleteComment(replyItem.id!)"
              @resolve="resolveComment(replyItem.id!)"
              @activate="activeCommentId === replyItem.id ? clearActiveComment() : scrollToComment(replyItem.id!)"
              @reply="onReply(replyItem)"
            />
          </template>

          <!-- Inline reply input — appears below the thread when user clicks reply -->
          <template v-if="replyingTo?.id === threadItem.id && hasEditPermission">
            <div class="border-t border-dashed border-nc-border-gray-medium mx-3" />
            <div class="p-2">
              <div
                class="nc-doc-reply-box rounded-lg border-1 border-nc-border-gray-medium overflow-hidden"
                :class="{ 'nc-doc-reply-box-focused': isReplyFocused }"
              >
                <SmartsheetExpandedFormRichComment
                  ref="replyInputRef"
                  v-model:value="replyText"
                  autofocus
                  :hide-options="true"
                  :show-bubble-menu="true"
                  :placeholder="`${$t('activity.addReply')}...`"
                  class="expanded-form-comment-reply-input !py-1.5 !px-2 cursor-text w-full !border-0 bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[120px]"
                  @keydown="handleKeyPress"
                  @save="onSaveReply"
                  @keydown.esc.prevent="onCancelReply"
                  @focus="isReplyFocused = true"
                  @blur="isReplyFocused = false"
                />
                <div class="flex items-center justify-end gap-1 px-1.5 pb-1.5">
                  <NcTooltip>
                    <NcButton v-e="['c:doc:comment:reply:cancel']" size="xsmall" type="text" class="!text-nc-content-gray-muted" @mousedown.prevent @click="onCancelReply">
                      <GeneralIcon icon="close" class="text-xs" />
                    </NcButton>
                    <template #title>{{ $t('general.cancel') }}</template>
                  </NcTooltip>
                  <NcTooltip>
                    <NcButton v-e="['c:doc:comment:reply:save']" size="xsmall" type="primary" :disabled="!replyText.trim()" @mousedown.prevent @click="onSaveReply">
                      <GeneralIcon icon="ncSendAlt" />
                    </NcButton>
                    <template #title>{{ $t('general.reply') }}</template>
                  </NcTooltip>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>

    <!-- Comment input — pinned at bottom of sidebar -->
    <div v-if="hasEditPermission && !isCommentsLoading" class="px-3 pb-3 pt-2 flex-none">
      <!-- Quoted text snippet for inline (anchor-based) comments -->
      <div v-if="pendingSelectionText" class="nc-doc-comment-quote mb-2 flex items-start gap-2">
        <div class="flex-1 min-w-0">
          <div class="nc-doc-comment-quote-text text-small text-nc-content-gray-subtle line-clamp-3">
            {{ pendingSelectionText }}
          </div>
        </div>
        <NcButton size="xsmall" type="text" class="flex-none !h-5 !w-5" @click="onCancelInlineComment">
          <GeneralIcon icon="close" class="text-nc-content-gray-muted" />
        </NcButton>
      </div>

      <div
        class="nc-doc-comment-box rounded-lg border-1 border-nc-border-gray-medium overflow-hidden"
        :class="{ 'nc-doc-comment-box-focused': isCommentFocused }"
      >
        <SmartsheetExpandedFormRichComment
          ref="commentInputRef"
          v-model:value="comment"
          :hide-options="true"
          :show-bubble-menu="true"
          :placeholder="`${$t('general.comment')}...`"
          class="expanded-form-comment-input !py-1.5 !px-2 cursor-text w-full !border-0 bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
          data-testid="nc-doc-comment-input"
          @keydown="handleKeyPress"
          @save="onSaveComment"
          @focus="isCommentFocused = true"
          @blur="isCommentFocused = false"
        />
        <div class="flex items-center justify-end gap-1 px-1.5 pb-1.5">
          <NcTooltip>
            <NcButton v-e="['c:doc:comment:save']" size="xsmall" type="primary" :disabled="!comment.trim()" @mousedown.prevent @click="onSaveComment" data-testid="nc-doc-comment-save-btn">
              <GeneralIcon icon="ncSendAlt" />
            </NcButton>
            <template #title>{{ $t('general.comment') }}</template>
          </NcTooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-comments-sidebar {
  width: 320px;
  flex-shrink: 0;
  height: 100vh;
  height: 100dvh;
}

.nc-doc-thread-card:hover {
  @apply bg-nc-bg-gray-light;
}

:deep(.expanded-form-comment-input) {
  @apply transition-all duration-150 min-h-8;
  box-shadow: none;
}

.nc-doc-comment-quote {
  @apply rounded-lg bg-nc-bg-gray-light p-2;

  .nc-doc-comment-quote-text {
    @apply pl-2 border-l-2 border-nc-border-brand italic;
  }
}

.nc-doc-reply-box,
.nc-doc-comment-box {
  @apply bg-nc-bg-default transition-all duration-150;

  &.nc-doc-reply-box-focused,
  &.nc-doc-comment-box-focused {
    @apply border-nc-border-brand;
    box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24);
  }
}

:deep(.expanded-form-comment-reply-input) {
  @apply min-h-7;
  box-shadow: none;
}
</style>
