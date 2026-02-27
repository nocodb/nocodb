<script setup lang="ts">
import type { CommentType, TableType } from 'nocodb-sdk'
import type { Editor } from '@tiptap/vue-3'

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
  loadComments,
  saveComment,
  updateComment,
  deleteComment,
  resolveComment,
} = useDocumentComments()

const hasEditPermission = computed(() => isUIAllowed('documentCommentUpdate'))

const commentsWrapperEl = ref<HTMLDivElement>()
const commentInputRef = ref<any>()
const comment = ref('')
const editCommentValue = ref<CommentType>()
const isEditing = ref(false)
const hoveredCommentId = ref<string | null>(null)

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

// Build a map of anchor_id → referenced text by walking editor doc marks
const anchorTextMap = computed<Record<string, string>>(() => {
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

  // Strip trailing <br /> and newlines
  let val = comment.value
  while (val.endsWith('<br />') || val.endsWith('\n')) {
    if (val.endsWith('<br />')) val = val.slice(0, -6)
    else val = val.slice(0, -2)
  }

  // If there's a pending text selection, create an inline comment with anchor mark
  let anchorId: string | null = null
  if (props.pendingSelection && props.editor) {
    const { from, to } = props.pendingSelection
    anchorId = `cmt_${Date.now().toString(36)}`
    props.editor.chain().focus().setTextSelection({ from, to }).setCommentMark({ commentId: anchorId }).run()
    emit('clearPendingSelection')
  }

  // Optimistic insert
  comments.value = [
    ...comments.value,
    {
      id: `temp-${Date.now()}`,
      comment: val,
      anchor_id: anchorId,
      created_at: new Date().toISOString(),
      created_by: user.value?.id,
      created_by_email: user.value?.email,
      created_display_name: user.value?.display_name ?? '',
      created_display_name_short: user.value?.display_name ?? extractNameFromEmail(user.value?.email),
      created_by_meta: user.value?.meta ?? '',
    },
  ]

  const tempComment = val
  comment.value = ''
  commentInputRef.value?.setEditorContent('', true)

  await nextTick(() => scrollComments())

  await saveComment(tempComment, anchorId)
  await nextTick(() => {
    scrollComments()
    commentInputRef.value?.focusEditor?.()
  })
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

  let val = editCommentValue.value.comment
  while (val.endsWith('<br />') || val.endsWith('\n')) {
    if (val.endsWith('<br />')) val = val.slice(0, -6)
    else val = val.slice(0, -2)
  }

  const tempComment = { ...editCommentValue.value, comment: val }
  isEditing.value = false
  editCommentValue.value = undefined

  await updateComment(tempComment.id!, tempComment.comment!)
}

function onCancelEdit(e: KeyboardEvent) {
  if (!isEditing.value) return
  e.preventDefault()
  e.stopPropagation()
  editCommentValue.value = undefined
  isEditing.value = false
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    event.stopPropagation()
  }
}

watch(
  () => comments.value?.length,
  () => {
    nextTick(() => scrollComments())
  },
)
</script>

<template>
  <div class="nc-doc-comments-sidebar flex flex-col border-l-1 border-nc-border-gray-medium bg-nc-bg-default">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2.5 border-b-1 border-nc-border-gray-medium flex-none">
      <div class="flex items-center gap-2">
        <span class="font-semibold text-sm text-nc-content-gray">{{ $t('general.comments') }}</span>
        <NcBadge v-if="comments.length" :count="comments.length" class="nc-doc-comment-count" overflow-count="99" />
      </div>
      <NcButton size="xsmall" type="text" @click="emit('close')">
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
      <template v-for="(commentItem, index) of comments" :key="commentItem.id">
        <!-- Edit mode -->
        <div
          v-if="commentItem.id === editCommentValue?.id && hasEditPermission"
          :class="{ 'mt-auto': index === 0 }"
          class="px-3 py-2"
        >
          <SmartsheetExpandedFormRichComment
            v-model:value="editValue"
            autofocus
            autofocus-to-end
            :hide-options="false"
            class="expanded-form-comment-edit-input cursor-text !py-2 !px-2 !m-0 w-full !border-1 !border-nc-border-gray-medium !rounded-lg !bg-nc-bg-default !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
            @save="onEditComment"
            @keydown.esc="onCancelEdit"
            @keydown="handleKeyPress"
            @blur="
              () => {
                editCommentValue = undefined
                isEditing = false
              }
            "
            @keydown.enter.exact.prevent="onEditComment"
          />
        </div>

        <!-- Display mode -->
        <DocCommentsItem
          v-else
          :comment="commentItem"
          :parsed-html="parsedHtmlComments[commentItem.id!] || ''"
          :is-owner="commentItem.created_by === user?.id"
          :is-hovered="hoveredCommentId === commentItem.id"
          :is-editing="false"
          :anchor-text="commentItem.anchor_id ? anchorTextMap[commentItem.anchor_id] : undefined"
          :class="{ 'mt-auto': index === 0 }"
          @edit="editComment(commentItem)"
          @delete="deleteComment(commentItem.id!)"
          @resolve="resolveComment(commentItem.id!)"
          @mouseover="hoveredCommentId = null"
        />
      </template>
    </div>

    <!-- Comment input — pinned at bottom -->
    <div v-if="hasEditPermission && !isCommentsLoading" class="px-3 pb-3 pt-2 border-t-1 border-nc-border-gray-medium flex-none">
      <!-- Quoted text snippet for inline comments -->
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

      <SmartsheetExpandedFormRichComment
        ref="commentInputRef"
        v-model:value="comment"
        :hide-options="false"
        :placeholder="`${$t('general.comment')}...`"
        class="expanded-form-comment-input !py-2 !px-2 cursor-text border-1 rounded-lg w-full bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
        @keydown="handleKeyPress"
        @save="onSaveComment"
        @keydown.enter.exact.prevent="onSaveComment"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-comments-sidebar {
  width: 320px;
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100dvh;
  flex-shrink: 0;
}

:deep(.expanded-form-comment-input) {
  @apply transition-all duration-150 min-h-8;
  box-shadow: none;
  &:focus,
  &:focus-within {
    @apply min-h-16 !bg-nc-bg-default border-nc-border-brand;
    box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24);
  }
  &::placeholder {
    @apply !text-gray-400;
  }
}

.nc-doc-comment-quote {
  @apply rounded-lg bg-nc-bg-gray-light p-2;

  .nc-doc-comment-quote-text {
    @apply pl-2 border-l-2 border-nc-border-brand italic;
  }
}

:deep(.expanded-form-comment-edit-input .nc-comment-rich-editor) {
  @apply bg-nc-bg-default;
}
</style>
