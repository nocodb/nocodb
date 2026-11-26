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

const { $e } = useNuxtApp()

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
  commentPlainText,
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

const searchInputRef = ref<HTMLInputElement>()

const route = useRoute()

const router = useRouter()

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

// Capture commentId from the URL into our own ref before stripping it,
// so subsequent wrapper remounts (caused by isCommentsLoading toggles)
// still know there's a deep-link in progress. Also fires when the user
// clicks another notification while the panel is already open.
watch(
  () => route.query.commentId,
  (newId) => {
    if (!newId) return
    deepLinkCommentId.value = newId as string
    // Preserve `path` so the group context survives a reload after the
    // comment deep-link is consumed; only commentId needs to be stripped.
    const { commentId: _drop, ...rest } = router.currentRoute.value.query
    router.push({ query: rest })
  },
  { immediate: true },
)

// Reset deep-link state when row changes so a new row defaults back to
// the usual scroll-to-bottom behavior on first open.
watch(primaryKey, (_pk, prev) => {
  // The first key to arrive is the deep-linked record itself.
  if (prev) deepLinkCommentId.value = null
})

const SEARCH_HIGHLIGHT = 'nc-comment-search'

const SEARCH_HIGHLIGHT_ACTIVE = 'nc-comment-search-active'

const SEARCH_LINE_BREAK_TAGS = new Set(['BR', 'P', 'DIV', 'LI', 'BLOCKQUOTE'])

const hasHighlightApi = typeof CSS !== 'undefined' && 'highlights' in CSS

// Ranges over the rendered text in document order (oldest first), so mentions match as shown.
const searchMatches = shallowRef<Range[]>([])

const activeMatchIndex = ref(-1)

function clearSearchHighlights() {
  if (!hasHighlightApi) return

  CSS.highlights.delete(SEARCH_HIGHLIGHT)
  CSS.highlights.delete(SEARCH_HIGHLIGHT_ACTIVE)
}

function paintActiveMatch() {
  if (!hasHighlightApi) return

  const range = searchMatches.value[activeMatchIndex.value]

  if (!range) {
    CSS.highlights.delete(SEARCH_HIGHLIGHT_ACTIVE)
    return
  }

  const highlight = new Highlight(range)
  highlight.priority = 1

  CSS.highlights.set(SEARCH_HIGHLIGHT_ACTIVE, highlight)
}

function scrollToActiveMatch() {
  searchMatches.value[activeMatchIndex.value]?.startContainer.parentElement?.scrollIntoView({
    block: 'center',
    behavior: 'smooth',
  })
}

// `keepPosition`: re-collect after the list changed without jumping away from where the reader is.
function collectSearchMatches(keepPosition = false) {
  clearSearchHighlights()

  const query = searchQuery.value.trim()

  if (!query || !commentsWrapperEl.value) {
    searchMatches.value = []
    activeMatchIndex.value = -1
    return
  }

  // Matched on the original text: lower-casing first can change its length ("İ" → 2 chars) and shift offsets.
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')

  const ranges: Range[] = []

  commentsWrapperEl.value.querySelectorAll('.nc-comment-author, .nc-comment-body').forEach((el) => {
    // One string per comment, so a match can span bold, links and mentions (each its own text node).
    // Line breaks and blocks add a "\n" that maps to no node; the query is one line, so no match crosses it.
    const segments: { node: Text; start: number }[] = []

    let text = ''

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        segments.push({ node: node as Text, start: text.length })
        text += node.textContent ?? ''
      } else if (SEARCH_LINE_BREAK_TAGS.has(node.nodeName) && text && !text.endsWith('\n')) {
        text += '\n'
      }
    }

    // Last segment starting at or before `offset`; `isEnd` places an end offset at the end of the previous node.
    function locate(offset: number, isEnd: boolean) {
      let found = segments[0]!

      for (const segment of segments) {
        if (isEnd ? segment.start < offset : segment.start <= offset) found = segment
        else break
      }

      return { node: found.node, offset: offset - found.start }
    }

    for (const match of text.matchAll(pattern)) {
      const start = locate(match.index, false)
      const end = locate(match.index + match[0].length, true)

      const range = new Range()
      range.setStart(start.node, start.offset)
      range.setEnd(end.node, end.offset)
      ranges.push(range)
    }
  })

  searchMatches.value = ranges

  // Threads read bottom-up: a new search starts at the newest match.
  activeMatchIndex.value =
    keepPosition && activeMatchIndex.value >= 0 ? Math.min(activeMatchIndex.value, ranges.length - 1) : ranges.length - 1

  if (hasHighlightApi && ranges.length) CSS.highlights.set(SEARCH_HIGHLIGHT, new Highlight(...ranges))

  paintActiveMatch()

  if (!keepPosition) scrollToActiveMatch()
}

/** -1 = older (up), 1 = newer (down); wraps around. */
function moveActiveMatch(step: -1 | 1) {
  const total = searchMatches.value.length
  if (!total) return

  activeMatchIndex.value = (activeMatchIndex.value + step + total) % total

  $e('c:comment:search:navigate', { direction: step === -1 ? 'older' : 'newer' })

  paintActiveMatch()
  scrollToActiveMatch()
}

function closeSearch() {
  searchQuery.value = ''
  emits('update:showSearch', false)
}

// One listener: several `@keydown` modifiers compile to an array, which AInput's Function prop rejects
function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    closeSearch()
    return
  }

  if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return

  e.preventDefault()
  moveActiveMatch(e.shiftKey ? 1 : -1)
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

watch([() => comments.value?.length ?? 0, primaryKey], ([length, pk], [prevLength, prevPk]) => {
  // A record switch replaces the list; only an arrival on the same record is held.
  const isArrival = pk === prevPk && !!prevLength && length > prevLength
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
    if (!open) {
      searchQuery.value = ''
      return
    }

    nextTick(() => searchInputRef.value?.focus())
  },
)

const debouncedCollectSearchMatches = useDebounceFn(() => collectSearchMatches(), 150)

watch(searchQuery, () => debouncedCollectSearchMatches())

// New, edited or re-filtered comments re-render the text the ranges point into.
watch(
  [visibleThreads, parsedHtmlComments, threadExpansion],
  () => {
    if (searchQuery.value.trim()) nextTick(() => collectSearchMatches(true))
  },
  { deep: true },
)

onBeforeUnmount(() => {
  resetTooltipInstances()

  // Switching feeds unmounts the list; it comes back with search closed.
  if (props.showSearch) emits('update:showSearch', false)

  // The registry is global: an instance that never searched must not erase another's highlights.
  if (searchMatches.value.length) clearSearchHighlights()
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
        <a-input
          ref="searchInputRef"
          v-model:value="searchQuery"
          allow-clear
          :placeholder="$t('activity.searchComments')"
          class="nc-comment-search-input !h-8 !rounded-lg !text-small"
          data-testid="nc-comment-search-input"
          @keydown="onSearchKeydown"
        >
          <template #prefix>
            <GeneralIcon icon="search" class="h-3.5 w-3.5 mr-1 text-nc-content-gray-muted" />
          </template>
          <template v-if="searchQuery.trim()" #suffix>
            <div class="flex items-center gap-0.5">
              <span
                class="nc-comment-search-count text-captionSm text-nc-content-gray-muted tabular-nums px-1 whitespace-nowrap"
                data-testid="nc-comment-search-count"
              >
                {{ searchMatches.length ? activeMatchIndex + 1 : 0 }}/{{ searchMatches.length }}
              </span>
              <NcButton
                type="text"
                size="xxsmall"
                icon-only
                :disabled="!searchMatches.length"
                :aria-label="$t('labels.previous')"
                data-testid="nc-comment-search-prev"
                @click="moveActiveMatch(-1)"
              >
                <template #icon>
                  <GeneralIcon icon="ncChevronUp" class="h-3.5 w-3.5" />
                </template>
              </NcButton>
              <NcButton
                type="text"
                size="xxsmall"
                icon-only
                :disabled="!searchMatches.length"
                :aria-label="$t('labels.next')"
                data-testid="nc-comment-search-next"
                @click="moveActiveMatch(1)"
              >
                <template #icon>
                  <GeneralIcon icon="ncChevronDown" class="h-3.5 w-3.5" />
                </template>
              </NcButton>
            </div>
          </template>
        </a-input>
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
// Same fixed colours as the doc find bar (_doc-content.scss): theme tokens turn yellow orange in dark mode,
// which made the active match indistinguishable. Higher `priority` (set in script) paints the active one on top.
::highlight(nc-comment-search) {
  background-color: rgba(255, 212, 0, 0.4);
  color: inherit;
}

::highlight(nc-comment-search-active) {
  background-color: rgba(255, 150, 0, 0.6);
  color: inherit;
}

.nc-rich-link-tooltip-popup {
  @apply text-xs bg-nc-content-gray text-nc-content-inverted-primary px-2 py-1 rounded-lg;
}
</style>
