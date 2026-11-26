<script setup lang="ts">
import dayjs from 'dayjs'
import tippy from 'tippy.js'
import type { CommentThread, CommentTypeExtended } from '~/composables/useRowComments'
import { threadComments } from '~/composables/useCommentThreadList'

/**
 * Copy URL builds a base-data deep link — hosts whose consumers have no data
 * route (interface record sheets) hide it.
 */
const props = defineProps<{
  hideCopyUrl?: boolean
  hideRoleInfo?: boolean
  /**
   * Narrow the feed to a comment kind (the interface discussion panel's
   * comment filters). When SET, resolved comments are hidden unless
   * `showResolved` — classic mounts pass nothing and see everything.
   */
  commentFilter?: 'all' | 'record' | 'onAttachments' | 'withAttachments' | 'mentions' | 'unread'
  /**
   * Include resolved comments (the "Show resolved comments" toggle —
   * offered for the all/record filters only; attachment filters stay
   * open-comments-only).
   */
  showResolved?: boolean
  /** Search box open — toggled by the host header's search icon. */
  showSearch?: boolean
  /** Show the record's field changes between the comments. */
  showRevisions?: boolean
}>()

const emits = defineEmits<{
  (e: 'update:showSearch', value: boolean): void
}>()

const { user } = useGlobal()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

// Hosted inside the attachment viewer — new comments tag the open image
// (pin-less annotation) so they count toward its badge.
const viewerCommentAnchor = inject(AttachmentViewerCommentAnchorInj, ref(null))

const {
  isCommentsLoading,
  comments,
  saveComment: _saveComment,
  parsedHtmlComments,
  primaryKey,
  commentsRowId,
  threads,
  isCommentExtrasEnabled,
  isCommentUnread,
  acknowledgeUnread,
} = useRowCommentsOrThrow()

// Absent in the attachment viewer and other hosts without a record form.
const expandedFormStore = useExpandedFormStore()

const {
  isCommentAttachmentsEnabled,
  pendingAttachments,
  isUploading: isAttachmentUploading,
  openFilePicker,
  handlePaste: handleAttachmentPaste,
  handleDrop: handleAttachmentDrop,
  removeAttachment,
  clearAttachments,
} = useCommentAttachments()

const commentsWrapperEl = ref<HTMLDivElement>()

const searchQuery = ref('')

const isSearching = computed(() => !!props.showSearch && !!searchQuery.value.trim())

const commentList = useProvideCommentThreadList({
  containerEl: commentsWrapperEl,
  hideCopyUrl: () => !!props.hideCopyUrl,
  hideRoleInfo: () => !!props.hideRoleInfo,
  isSearching: () => isSearching.value,
})

const {
  hasEditPermission,
  annotationRefByCommentId,
  deepLinkCommentId,
  hoveredCommentId,
  threadExpansion,
  scrollToComment,
  revealComment,
  handleResetHoverEffect,
  firstName,
  handleKeyPress,
} = commentList

function mentionsMe(commentItem: CommentTypeExtended) {
  return !!user.value?.id && !!commentItem.comment?.includes(`@(${user.value.id}|`)
}

// The rendered list — the caller's filter applied over the loaded threads. A
// thread filters as a unit: annotation anchoring is inherited by replies
// (annotationRefByCommentId) and 'record' is its complement; the other filters
// keep a thread when any of its comments match. Resolved threads are hidden
// unless the toggle is on — it is only offered for the all/record filters.
const visibleThreads = computed(() => {
  const filter = props.commentFilter
  if (!filter) return threads.value

  let list = threads.value

  if (filter === 'record') list = list.filter((t) => !t.root.id || !annotationRefByCommentId.value[t.root.id])
  else if (filter === 'onAttachments') list = list.filter((t) => !!t.root.id && !!annotationRefByCommentId.value[t.root.id])
  else if (filter === 'withAttachments') list = list.filter((t) => threadComments(t).some((c) => !!c.attachments?.length))
  else if (filter === 'mentions') list = list.filter((t) => threadComments(t).some(mentionsMe))
  else if (filter === 'unread') list = list.filter((t) => threadComments(t).some(isCommentUnread))

  const includeResolved = props.showResolved && (filter === 'all' || filter === 'record')
  if (!includeResolved) list = list.filter((t) => !t.root.resolved_by)

  return list
})

const { unreadComments, firstUnreadRootId, isJumpToUnreadDismissed, isFirstUnreadBelow, jumpToUnread, shouldHoldScroll } =
  useCommentListUnread(
    commentList,
    commentsWrapperEl,
    visibleThreads,
    // Each attachment-viewer open is a new visit: load the read state again.
    !inject(AttachmentViewerCommentAnchorInj, null),
  )

type FeedEntry =
  | { type: 'thread'; key: string; at?: string; thread: CommentThread }
  | { type: 'audit'; key: string; at?: string; audit: any }

// Threads in order, with the record's field changes between them when asked for.
const feedEntries = computed<FeedEntry[]>(() => {
  const entries: FeedEntry[] = visibleThreads.value.map((thread) => ({
    type: 'thread',
    key: thread.root.id!,
    at: thread.root.created_at,
    thread,
  }))

  if (!props.showRevisions || !expandedFormStore) return entries

  for (const audit of expandedFormStore.consolidatedAudits.value) {
    entries.push({ type: 'audit', key: `audit-${audit.id}`, at: (audit as any).created_at, audit })
  }

  return entries.sort((a, b) => dayjs(a.at).valueOf() - dayjs(b.at).valueOf())
})

const pinnedComment = computed(() =>
  isCommentExtrasEnabled.value ? comments.value.find((c) => !!getCommentMeta(c).pinned) : undefined,
)

const commentInputRef = ref<any>()

const comment = ref('')

const debouncedLoadCommentEditedTooltip = useDebounceFn(loadCommentEditedTooltip, 1000)

function scrollComments() {
  if (commentsWrapperEl.value) {
    commentsWrapperEl.value.scrollTo({
      top: commentsWrapperEl.value.scrollHeight,
      behavior: 'smooth',
    })
  }
}

const saveComment = async () => {
  if (!comment.value.trim() && !pendingAttachments.value.length) return

  // don't post mid-upload — wait for files to finish
  if (isAttachmentUploading.value) return

  while (comment.value.endsWith('<br />') || comment.value.endsWith('\n')) {
    if (comment.value.endsWith('<br />')) {
      comment.value = comment.value.slice(0, -6)
    } else {
      comment.value = comment.value.slice(0, -2)
    }
  }

  // User is posting — drop any pending deep-link so the scroll watchers
  // scroll to their new comment at the bottom instead of jumping back.
  deepLinkCommentId.value = null

  // Whoever answers has read what was there.
  acknowledgeUnread()

  const tempAttachments = [...pendingAttachments.value]

  // Optimistic Insert
  comments.value = [
    ...comments.value,
    {
      id: `temp-${new Date().getTime()}`,
      comment: comment.value,
      attachments: tempAttachments,
      created_at: new Date().toISOString(),
      created_by: user.value?.id,
      created_by_email: user.value?.email,
      created_display_name: user.value?.display_name ?? '',
      created_display_name_short: extractUserDisplayNameOrEmail(user.value),
      created_by_meta: user.value?.meta ?? '',
    },
  ]

  const tempCom = comment.value
  comment.value = ''
  clearAttachments()

  commentInputRef?.value?.setEditorContent('', true)
  await nextTick(() => {
    scrollComments()
  })

  try {
    await _saveComment(
      tempCom,
      tempAttachments,
      viewerCommentAnchor.value ? { annotation: { attachment: viewerCommentAnchor.value } } : undefined,
    )
    await nextTick(() => {
      isExpandedFormCommentMode.value = true
    })
    scrollComments()
  } catch (e) {
    console.error(e)
  }
}

function tryScrollToDeepLinkComment(): boolean {
  const id = deepLinkCommentId.value
  if (!id) return false
  const el = document.querySelector(`.${id}`)
  if (!el) return false
  scrollToComment(id)
  hoveredCommentId.value = id
  onClickOutside(el as HTMLDivElement, handleResetHoverEffect)
  return true
}

// The link survives the list remounting while comments load, and a notification clicked with the panel open.
useCommentDeepLinkFromRoute(deepLinkCommentId, primaryKey)

function closeSearch() {
  searchQuery.value = ''
  emits('update:showSearch', false)
}

watch(commentsWrapperEl, (el) => {
  if (!el) return
  setTimeout(() => {
    nextTick(() => {
      // Deep-link in progress (initial mount OR remount after the loader
      // toggled) — anchor on the linked comment. If the comment isn't in
      // the DOM yet, the length watcher will retry once comments load.
      // Either way, skip the bottom-scroll so we don't jump away from the
      // linked comment.
      if (deepLinkCommentId.value) {
        tryScrollToDeepLinkComment()
        return
      }
      scrollComments()
    })
  }, 100)
})

const tooltipInstances: any[] = []

function loadCommentEditedTooltip() {
  resetTooltipInstances()

  document.querySelectorAll('.nc-rich-link-tooltip').forEach((el) => {
    const tooltip = Object.values(el.attributes).find((attr) => attr.name === 'data-tooltip')
    if (!tooltip) return

    const content = document.createElement('span')
    content.className = 'tooltip nc-rich-link-tooltip-popup'
    content.textContent = tooltip.value

    const instance = tippy(el, {
      content,
      placement: 'top',
      allowHTML: false,
      arrow: true,
      animation: 'fade',
      duration: 0,
    })

    tooltipInstances.push(instance)
  })
}

function resetTooltipInstances() {
  tooltipInstances.forEach((instance) => instance?.destroy())
  tooltipInstances.length = 0
}

watch(
  comments,
  () => {
    debouncedLoadCommentEditedTooltip()
  },
  { immediate: true },
)

watch([() => comments.value?.length ?? 0, commentsRowId], ([length, rowId], [prevLength, prevRowId]) => {
  // Keyed on the list's row, not primaryKey: the row and its comments load separately on prev/next.
  const isArrival = rowId === prevRowId && !!prevLength && length > prevLength
  if (isArrival && shouldHoldScroll(comments.value[comments.value.length - 1])) return

  nextTick(() => {
    // Deep-link target still in scope (only cleared on user post / row
    // change) — keep anchoring on it rather than snapping to bottom.
    if (deepLinkCommentId.value) {
      tryScrollToDeepLinkComment()
      return
    }
    // A reply lands inside its thread, not at the end of the list.
    if (comments.value[comments.value.length - 1]?.parent_comment_id) return
    scrollComments()
  })
})

watch(primaryKey, () => {
  searchQuery.value = ''
})

watch(
  () => props.showRevisions,
  (show) => {
    if (show && expandedFormStore && !expandedFormStore.audits.value.length) expandedFormStore.loadAudits()
  },
  { immediate: true },
)

watch(
  () => props.showSearch,
  (open) => {
    if (!open) searchQuery.value = ''
  },
)

onBeforeUnmount(() => {
  resetTooltipInstances()

  // Switching feeds unmounts the list; it comes back with search closed.
  if (props.showSearch) emits('update:showSearch', false)
})
</script>

<template>
  <div
    class="h-full"
    :class="{
      'pb-1': !hasEditPermission,
    }"
  >
    <div v-if="isCommentsLoading" class="flex flex-col items-center justify-center w-full h-full">
      <GeneralLoader size="xlarge" />
    </div>
    <div v-else class="flex flex-col h-full">
      <div v-if="showSearch" class="flex-none px-3 pt-2 pb-1">
        <SmartsheetExpandedFormCommentSearchBar
          v-model:query="searchQuery"
          :container="commentsWrapperEl"
          :refresh-on="[visibleThreads, parsedHtmlComments, threadExpansion]"
          @close="closeSearch"
        />
      </div>
      <div
        v-if="comments.length === 0 && !feedEntries.length"
        class="flex flex-col my-1 text-center justify-center h-full nc-scrollbar-thin"
      >
        <div class="text-center text-3xl text-nc-content-gray-subtle opacity-40">
          <GeneralIcon icon="commentHere" />
        </div>
        <div class="text-center my-4 px-6">
          <div class="font-medium text-nc-content-gray-muted">
            {{ hasEditPermission ? $t('activity.startCommenting') : $t('activity.noCommentsYet') }}
          </div>
          <div v-if="hasEditPermission" class="text-xs text-nc-content-gray-subtle2 mt-2">
            {{ $t('activity.startCommentingDescription') }}
          </div>
        </div>
      </div>
      <!-- Comments exist but the active filter matches none -->
      <div
        v-else-if="visibleThreads.length === 0 && !feedEntries.length"
        class="flex flex-col my-1 text-center justify-center h-full nc-scrollbar-thin"
        data-testid="nc-comments-no-filter-match"
      >
        <div class="text-center text-3xl text-nc-content-gray-subtle opacity-40">
          <GeneralIcon icon="commentHere" />
        </div>
        <div class="text-center my-4 px-6 font-medium text-nc-content-gray-muted">
          {{ $t('labels.noCommentsMatchFilter') }}
        </div>
      </div>
      <template v-else>
        <button
          v-if="pinnedComment"
          type="button"
          class="nc-comment-pinned flex-none mx-3 mt-2 mb-1 flex items-center gap-2 rounded-lg border-1 border-nc-border-brand-medium bg-nc-bg-brand px-2.5 py-1.5 text-left text-small cursor-pointer hover:border-nc-border-brand"
          data-testid="nc-comment-pinned"
          @click="revealComment(pinnedComment.id!)"
        >
          <GeneralIcon icon="ncPin" class="flex-none w-3.5 h-3.5 text-nc-content-brand" />
          <span class="min-w-0 flex-1 truncate text-nc-content-gray">
            <span class="font-semibold">{{ firstName(pinnedComment) }}:</span>
            {{ commentPlainText(pinnedComment) }}
          </span>
          <GeneralIcon icon="chevronRight" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
        </button>

        <div ref="commentsWrapperEl" class="relative flex flex-col h-full pt-4 pb-1 nc-scrollbar-thin">
          <div class="mt-auto" />
          <template v-for="entry of feedEntries" :key="entry.key">
            <SmartsheetExpandedFormSidebarCommentActivity v-if="entry.type === 'audit'" :audit="entry.audit" />

            <SmartsheetExpandedFormSidebarCommentThread
              v-else
              :thread="entry.thread"
              :show-new-divider="entry.thread.root.id === firstUnreadRootId"
            />
          </template>

          <button
            v-if="unreadComments.length && isFirstUnreadBelow && !isJumpToUnreadDismissed"
            type="button"
            class="nc-comment-jump-unread sticky bottom-2 z-20 mx-auto mt-2 flex flex-none items-center gap-1.5 rounded-full bg-nc-fill-primary px-3 py-1 text-xs font-semibold text-white shadow-md cursor-pointer hover:bg-nc-fill-primary-hover"
            data-testid="nc-comment-jump-unread"
            @click="jumpToUnread"
          >
            <GeneralIcon icon="arrowDown" class="w-3.5 h-3.5" />
            {{ $t('activity.commentThread.newComments', { count: unreadComments.length }, unreadComments.length) }}
          </button>
        </div>
      </template>
      <SmartsheetExpandedFormCommentTypingIndicator v-if="isEeUI && hasEditPermission" :draft="comment" />
      <div
        v-if="hasEditPermission"
        class="px-3 pt-1 pb-3 nc-comment-input !rounded-br-2xl gap-2 flex relative z-10 bg-nc-bg-elevated"
        @paste="isCommentAttachmentsEnabled ? handleAttachmentPaste($event) : undefined"
        @dragover.prevent
        @drop="isCommentAttachmentsEnabled ? handleAttachmentDrop($event) : undefined"
      >
        <SmartsheetExpandedFormRichComment
          ref="commentInputRef"
          v-model:value="comment"
          :hide-options="false"
          :extra-save-enabled="pendingAttachments.length > 0"
          :placeholder="`${$t('general.comment')}...`"
          class="expanded-form-comment-input !py-2 !px-2 cursor-text border-1 rounded-lg w-full bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
          :autofocus="isExpandedFormCommentMode"
          data-testid="expanded-form-comment-input"
          @focus="isExpandedFormCommentMode = false"
          @keydown="handleKeyPress"
          @save="saveComment"
          @keydown.enter.exact.prevent="saveComment"
        >
          <template v-if="pendingAttachments.length" #attachments>
            <SmartsheetExpandedFormCommentAttachments
              :attachments="pendingAttachments"
              editable
              class="px-1 pt-1"
              @remove="removeAttachment"
            />
          </template>
          <template v-if="isCommentAttachmentsEnabled" #bottom-bar-start>
            <NcTooltip :title="$t('activity.attachFile')" placement="top">
              <NcButton
                v-e="['c:comment:attach-file']"
                type="text"
                size="xsmall"
                class="nc-comment-attach-btn !h-7 !w-7"
                :loading="isAttachmentUploading"
                :disabled="isAttachmentUploading"
                data-testid="nc-comment-attach-btn"
                :aria-label="$t('activity.attachFile')"
                @click="openFilePicker"
              >
                <GeneralIcon v-if="!isAttachmentUploading" icon="lucidePaperclip" class="h-3.5 w-3.5" />
              </NcButton>
            </NcTooltip>
          </template>
        </SmartsheetExpandedFormRichComment>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.expanded-form-comment-input) {
  @apply transition-all duration-150 min-h-8;
  box-shadow: none;
  &:focus,
  &:focus-within {
    @apply min-h-16 !bg-nc-bg-elevated border-nc-border-brand;
    box-shadow: 0px 0px 0px 2px rgba(var(--nc-brand-accent-rgb), 0.24);
  }
  &::placeholder {
    @apply !text-gray-400;
  }
}

[theme='dark'] .expanded-form-comment-input {
  background-color: var(--nc-bg-input) !important;
}
</style>

<style lang="scss">
.nc-rich-link-tooltip-popup {
  @apply text-xs bg-nc-content-gray text-nc-content-inverted-primary px-2 py-1 rounded-lg;
}
</style>
