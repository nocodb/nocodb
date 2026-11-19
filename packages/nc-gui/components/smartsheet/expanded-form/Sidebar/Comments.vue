<script setup lang="ts">
import dayjs from 'dayjs'
import tippy from 'tippy.js'
import { ProjectRoles, UITypes, WorkspaceRolesToProjectRoles, getAttachmentAnnotationKey } from 'nocodb-sdk'
import type { ColumnType, CommentImageAnnotation, CommentType, WorkspaceUserRoles } from 'nocodb-sdk'
import type { CommentThread, CommentTypeExtended } from '~/composables/useRowComments'
import { suggestionHandledKeyEvents } from '~/helpers/tiptap'

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

const { user, appInfo } = useGlobal()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { dashboardUrl } = useDashboard()

const { isUIAllowed } = useRoles()

const { copy } = useCopy()

const route = useRoute()

const hasEditPermission = computed(() => isUIAllowed('commentEdit'))

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

// Hosted inside the attachment viewer — new comments tag the open image
// (pin-less annotation) so they count toward its badge.
const viewerCommentAnchor = inject(AttachmentViewerCommentAnchorInj, ref(null))

const {
  deleteComment,
  resolveComment,
  isCommentsLoading,
  comments,
  loadComments,
  updateComment,
  saveComment: _saveComment,
  primaryKey,
  parsedHtmlComments,
  row,
  threads,
  isCommentExtrasEnabled,
  getReactionSummary,
  toggleReaction,
  pinComment,
  setCommentTask,
  isCommentUnread,
  loadReadState,
  markCommentsRead,
  acknowledgeUnread,
  threadSummaries,
  summarizeThread,
  dismissThreadSummary,
} = useRowCommentsOrThrow()

// Absent in the attachment viewer and other hosts without a record form.
const expandedFormStore = useExpandedFormStore()

const { isAiFeaturesEnabled, aiIntegrationAvailable } = useNocoAi()

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

// Independent attachment state for the edit composer (initialised from the
// comment being edited so the user can add/remove files).
const {
  pendingAttachments: editAttachments,
  isUploading: isEditAttachmentUploading,
  openFilePicker: openEditFilePicker,
  handlePaste: handleEditAttachmentPaste,
  handleDrop: handleEditAttachmentDrop,
  removeAttachment: removeEditAttachment,
  clearAttachments: clearEditAttachments,
} = useCommentAttachments()

// A third, independent attachment state for the thread reply composer.
const {
  pendingAttachments: replyAttachments,
  isUploading: isReplyAttachmentUploading,
  openFilePicker: openReplyFilePicker,
  handlePaste: handleReplyAttachmentPaste,
  handleDrop: handleReplyAttachmentDrop,
  removeAttachment: removeReplyAttachment,
  clearAttachments: clearReplyAttachments,
} = useCommentAttachments()

// Present only inside the attachment carousel — exposes image-annotation state.
const imageAnnotations = useImageAnnotations()

const { request: annotationFocusRequest } = useAnnotationFocusRequest()

const { getPossibleAttachmentSrc } = useAttachment()

// Annotations are EE-only — hide the label pills entirely in CE.
const annotationLabels = computed(() => (isEeUI ? imageAnnotations?.labelByCommentId.value ?? {} : {}))

// Row attachments keyed by their annotation key — resolves a comment's stored
// annotation back to the live cell attachment (signed URLs, thumbnails).
const rowAttachmentByKey = computed<Record<string, any>>(() => {
  const map: Record<string, any> = {}
  for (const col of (meta.value?.columns ?? []) as ColumnType[]) {
    if (col.uidt !== UITypes.Attachment) continue

    let value: any = row?.value?.row?.[col.title!]
    if (ncIsString(value)) {
      try {
        value = JSON.parse(value)
      } catch {
        continue
      }
    }
    if (!ncIsArray(value)) continue

    for (const att of value) {
      const key = getAttachmentAnnotationKey(att)
      if (key && !(key in map)) map[key] = att
    }
  }
  return map
})

// Attachment context (thumbnail + filename) for annotation comments — shown on
// the comment so it's clear which image it was made on. Replies don't carry
// their own annotation; they inherit the anchor of their (root) parent.
const annotationRefByCommentId = computed(() => {
  const map: Record<string, { title: string; key: string; thumbnailSrc?: string; matched: boolean; rootId: string }> = {}
  if (!isEeUI) return map

  const annotationById: Record<string, CommentImageAnnotation> = {}
  for (const c of comments.value) {
    if (!c.id) continue
    const annotation = extractCommentAnnotation(c)
    if (annotation?.attachment) annotationById[c.id] = annotation
  }

  for (const c of comments.value) {
    if (!c.id) continue
    const rootId = annotationById[c.id]
      ? c.id
      : c.parent_comment_id && annotationById[c.parent_comment_id]
      ? c.parent_comment_id
      : undefined
    if (!rootId) continue

    const annotation = annotationById[rootId]!
    const key = getAttachmentAnnotationKey(annotation.attachment) ?? ''
    const matched = key ? rowAttachmentByKey.value[key] : undefined
    map[c.id] = {
      title: annotation.attachment.title || matched?.title || '',
      key,
      thumbnailSrc: matched ? getPossibleAttachmentSrc(matched, 'tiny')[0] : undefined,
      matched: !!matched,
      rootId,
    }
  }
  return map
})

/** Replies stay folded behind a summary line once a thread grows past this. */
const COLLAPSE_AFTER_REPLIES = 3

/** Shorter threads are quicker to read than to summarize. */
const SUMMARIZE_FROM_REPLIES = 3

function threadComments(thread: CommentThread) {
  return [thread.root, ...thread.replies]
}

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

const unreadComments = computed(() => visibleThreads.value.flatMap(threadComments).filter(isCommentUnread))

/** The "New" line sits above the first thread that started since the last visit. */
const firstUnreadRootId = computed(() => visibleThreads.value.find((thread) => isCommentUnread(thread.root))?.root.id)

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

const editCommentValue = ref<CommentType>()

const commentsWrapperEl = ref<HTMLDivElement>()

const isEditing = ref<boolean>(false)

const isCommentMode = ref(false)

const hoveredCommentId = ref<null | string>(null)

const commentInputRef = ref<any>()

const comment = ref('')

/** Explicit open/closed picks, keyed by root id (and `resolved-<id>` for a resolved thread's one-line row). */
const threadExpansion = ref<Record<string, boolean>>({})

/** Root id of the thread whose reply composer is open. */
const replyThreadId = ref<string | null>(null)

const reply = ref('')

const replyInputRef = ref<any>()

/** Comment whose to-do form is open. */
const taskFormCommentId = ref<string | null>(null)

const isJumpToUnreadDismissed = ref(false)

/** The first new comment sits below the visible part of the list. */
const isFirstUnreadBelow = ref(false)

const searchQuery = ref('')

const searchInputRef = ref<HTMLInputElement>()

// Holds the deep-linked commentId for the lifetime of the current row's
// comment session. Side-panel mode triggers loadComments twice (via
// triggerRowLoad AND the activity-tab watcher), which toggles
// isCommentsLoading on/off and unmounts+remounts the wrapper element.
// On remount, the URL has already been stripped of `commentId`, so we
// need our own copy to know whether to anchor on the deep-link or fall
// back to bottom-scroll. Cleared when the user posts a comment or
// switches rows (primaryKey changes).
const deepLinkCommentId = ref<string | null>(null)

const router = useRouter()

const baseUsers = computed(() => (meta.value?.base_id ? basesUser.value.get(meta.value?.base_id) || [] : []))

/** To-dos go to people who can open this record. */
const assignableUsers = computed(() =>
  baseUsers.value.filter((u) => !u.deleted && getUserRole(u.email!) !== ProjectRoles.NO_ACCESS),
)

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

  isCommentMode.value = true

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

const isSearching = computed(() => !!props.showSearch && !!searchQuery.value.trim())

function threadHasComment(thread: CommentThread, commentId: string) {
  return threadComments(thread).some((c) => c.id === commentId)
}

function findThread(commentId: string) {
  return threads.value.find((thread) => threadHasComment(thread, commentId))
}

function isThreadExpanded(thread: CommentThread) {
  const id = thread.root.id!

  if (replyThreadId.value === id) return true
  if (id in threadExpansion.value) return threadExpansion.value[id]
  // Collapsed replies are not in the DOM, so search and deep links open them.
  if (isSearching.value) return true
  if (deepLinkCommentId.value && threadHasComment(thread, deepLinkCommentId.value)) return true

  return thread.replies.length <= COLLAPSE_AFTER_REPLIES
}

/** A resolved thread reads as one line until it is opened. */
function isResolvedCollapsed(thread: CommentThread) {
  if (!thread.root.resolved_by) return false

  const key = `resolved-${thread.root.id}`

  if (key in threadExpansion.value) return !threadExpansion.value[key]
  if (isSearching.value) return false
  if (deepLinkCommentId.value && threadHasComment(thread, deepLinkCommentId.value)) return false

  return true
}

function shownComments(thread: CommentThread) {
  return isThreadExpanded(thread) ? threadComments(thread) : [thread.root]
}

function setThreadExpanded(thread: CommentThread, expanded: boolean) {
  threadExpansion.value = { ...threadExpansion.value, [thread.root.id!]: expanded }

  if (!expanded && replyThreadId.value === thread.root.id) cancelReply()

  $e('c:comment:thread:toggle', { expanded })
}

function setResolvedOpen(thread: CommentThread, open: boolean) {
  threadExpansion.value = { ...threadExpansion.value, [`resolved-${thread.root.id}`]: open }
}

function unreadReplyCount(thread: CommentThread) {
  return thread.replies.filter(isCommentUnread).length
}

/** Up to three distinct repliers, most recent last, for the collapsed summary line. */
function threadRepliers(thread: CommentThread) {
  const seen = new Set<string>()
  const repliers: CommentTypeExtended[] = []

  for (const item of thread.replies) {
    const key = item.created_by ?? item.created_by_email ?? ''
    if (seen.has(key)) continue
    seen.add(key)
    repliers.push(item)
  }

  return repliers.slice(-3)
}

function commentPlainText(commentItem: CommentTypeExtended) {
  return (commentItem.comment ?? '')
    .replace(/@\(([^)]+)\)/g, (_match, inner: string) => {
      const [, email, name] = inner.split('|')
      return `@${name || email || ''}`
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstName(commentItem: CommentTypeExtended) {
  return createdBy(commentItem).split(' ')[0]
}

function updateUnreadVisibility() {
  const wrapper = commentsWrapperEl.value
  // A new reply in a collapsed thread is not rendered; its root marks the spot.
  const firstThread = visibleThreads.value.find((thread) => threadComments(thread).some(isCommentUnread))
  const firstUnread = firstThread && threadComments(firstThread).find(isCommentUnread)
  const firstId = firstThread && firstUnread && !isThreadExpanded(firstThread) ? firstThread.root.id : firstUnread?.id

  if (!wrapper || !firstId) {
    isFirstUnreadBelow.value = false
    return
  }

  const el = wrapper.querySelector(`.nc-comment-item.${CSS.escape(firstId)}`)
  if (!el) {
    isFirstUnreadBelow.value = false
    return
  }

  isFirstUnreadBelow.value = el.getBoundingClientRect().top > wrapper.getBoundingClientRect().bottom - 24
}

function userName(userId?: string | null) {
  const found = baseUsers.value.find((u) => u.id === userId)
  return found ? extractUserDisplayNameOrEmail(found) : t('labels.sharedSource')
}

function canSummarize(thread: CommentThread) {
  return (
    isCommentExtrasEnabled.value &&
    isAiFeaturesEnabled.value &&
    aiIntegrationAvailable.value &&
    isUIAllowed('dataEdit') &&
    thread.replies.length >= SUMMARIZE_FROM_REPLIES
  )
}

function startReply(commentItem: CommentTypeExtended) {
  const thread = findThread(commentItem.id!)
  if (!thread?.root.id || thread.root.id.startsWith('temp-')) return

  if (replyThreadId.value !== thread.root.id) {
    reply.value = ''
    clearReplyAttachments()
  }

  replyThreadId.value = thread.root.id
  threadExpansion.value = { ...threadExpansion.value, [thread.root.id]: true, [`resolved-${thread.root.id}`]: true }

  nextTick(() => {
    document.querySelector('.nc-comment-reply-composer')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

function cancelReply() {
  replyThreadId.value = null
  reply.value = ''
  clearReplyAttachments()
}

async function saveReply() {
  const rootId = replyThreadId.value

  if (!rootId || (!reply.value.trim() && !replyAttachments.value.length)) return

  if (isReplyAttachmentUploading.value) return

  let text = reply.value

  while (text.endsWith('<br />') || text.endsWith('\n')) {
    text = text.endsWith('<br />') ? text.slice(0, -6) : text.slice(0, -1)
  }

  const tempAttachments = [...replyAttachments.value]

  deepLinkCommentId.value = null

  acknowledgeUnread()

  // Optimistic insert, under its thread.
  comments.value = [
    ...comments.value,
    {
      id: `temp-${new Date().getTime()}`,
      comment: text,
      parent_comment_id: rootId,
      attachments: tempAttachments,
      created_at: new Date().toISOString(),
      created_by: user.value?.id,
      created_by_email: user.value?.email,
      created_display_name: user.value?.display_name ?? '',
      created_display_name_short: extractUserDisplayNameOrEmail(user.value),
      created_by_meta: user.value?.meta ?? '',
    },
  ]

  threadExpansion.value = { ...threadExpansion.value, [rootId]: true }

  cancelReply()

  await _saveComment(text, tempAttachments, undefined, rootId)

  $e('a:comment:reply:send')
}

function onReplyEscape(e: KeyboardEvent) {
  // Runs before the editor sees the key; an Escape that closes the @mention list keeps the reply open.
  setTimeout(() => {
    if (!suggestionHandledKeyEvents.has(e)) cancelReply()
  })
}

function onReplyBlur() {
  // Leaving an empty reply box closes it; a draft stays.
  setTimeout(() => {
    if (!reply.value.trim() && !replyAttachments.value.length && !isReplyAttachmentUploading.value) cancelReply()
  }, 150)
}

async function revealComment(commentId: string) {
  const thread = findThread(commentId)
  if (!thread?.root.id) return

  threadExpansion.value = {
    ...threadExpansion.value,
    [`resolved-${thread.root.id}`]: true,
    ...(commentId !== thread.root.id ? { [thread.root.id]: true } : {}),
  }

  await nextTick()

  scrollToComment(commentId)
  hoveredCommentId.value = commentId
}

function jumpToUnread() {
  const first = unreadComments.value[0]
  if (!first?.id) return

  isJumpToUnreadDismissed.value = true
  revealComment(first.id)

  $e('c:comment:unread:navigate')
}

function toggleTaskDone(commentItem: CommentTypeExtended, done: boolean) {
  setCommentTask(commentItem.id!, { done })
}

function saveTask(commentItem: CommentTypeExtended, value: { assignee: string; due: string | null }) {
  taskFormCommentId.value = null
  setCommentTask(commentItem.id!, { task: value })
}

function removeTask(commentItem: CommentTypeExtended) {
  taskFormCommentId.value = null
  setCommentTask(commentItem.id!, { task: null })
}

const copyComment = async (comment: CommentType) => {
  const viewId = activeView.value?.fk_model_id === meta.value?.id ? activeView.value?.id : undefined

  // Mirror copy-record-URL: include &path=… so the link still resolves when
  // the source view is grouped (without it the deep-link can't open the row
  // in another tab).
  const pathParam = route.query?.path ? `&path=${route.query.path}` : ''

  await copy(
    encodeURI(
      `${dashboardUrl?.value}/${route.params.typeOrId}/${route.params.baseId}/${meta.value?.id}${
        viewId ? `/${viewId}` : ''
      }?rowId=${primaryKey.value}&commentId=${comment.id}${pathParam}`,
    ),
  )
}

function viewAnnotationComment(commentItem: CommentType) {
  if (!commentItem.id) return

  // Inside the carousel — focus the annotation directly.
  if (imageAnnotations) {
    imageAnnotations.viewAnnotation(commentItem)
    return
  }

  // Outside (expanded record sidebar) — ask the owning attachment cell to open
  // its carousel focused on this annotation.
  const refInfo = annotationRefByCommentId.value[commentItem.id]
  if (!refInfo?.matched || !primaryKey.value) return

  annotationFocusRequest.value = {
    rowId: primaryKey.value,
    attachmentKey: refInfo.key,
    // Replies resolve to their root annotation comment — that's what the
    // carousel focuses (same conversation, same region).
    commentId: refInfo.rootId,
  }
}

function scrollToComment(commentId: string) {
  const commentEl = document.querySelector(`.${commentId}`)
  if (commentEl) {
    commentEl.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
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

function onCancel(e: KeyboardEvent) {
  if (!isEditing.value) return
  e.preventDefault()
  e.stopPropagation()
  editCommentValue.value = undefined
  clearEditAttachments()
  loadComments()
  isEditing.value = false
  editCommentValue.value = undefined
}

function editComment(comment: CommentType) {
  editCommentValue.value = {
    ...comment,
  }
  editAttachments.value = [...(comment.attachments ?? [])]
  isEditing.value = true
  nextTick(() => {
    scrollToComment(comment.id!)
  })
}

const value = computed({
  get() {
    return editCommentValue.value?.comment || ''
  },
  set(val) {
    if (!editCommentValue.value) return
    editCommentValue.value.comment = val
  },
})

async function onEditComment() {
  if (!isEditing.value) return

  if (isEditAttachmentUploading.value) return

  if (!editCommentValue.value?.comment && !editAttachments.value.length) return

  while (
    editCommentValue.value?.comment &&
    (editCommentValue.value.comment.endsWith('<br />') || editCommentValue.value.comment.endsWith('\n'))
  ) {
    if (editCommentValue.value.comment.endsWith('<br />')) {
      editCommentValue.value.comment = editCommentValue.value.comment.slice(0, -6)
    } else {
      editCommentValue.value.comment = editCommentValue.value.comment.slice(0, -2)
    }
  }

  isCommentMode.value = true

  const tempCom = {
    ...editCommentValue.value,
  }
  const tempAttachments = [...editAttachments.value]

  isEditing.value = false
  editCommentValue.value = undefined
  clearEditAttachments()
  await updateComment(tempCom.id!, {
    comment: tempCom.comment,
    attachments: tempAttachments,
  })

  loadComments()
}

/**
 * Interfaces route comments through the injected adapter — its presence marks
 * an interface surface, where the author hover card keeps its avatar +
 * name + email but drops the base-role footer (backed by the base user
 * list, which interface-only collaborators can't read — and base
 * membership is base-scoped info regardless).
 */
const isInterfaceSurface = inject(IsInterfaceRecordSurfaceInj, false)

function createdBy(
  comment: CommentType & {
    created_display_name_short?: string
  },
) {
  if (comment.created_by === user.value?.id) {
    return t('general.you')
  } else if (comment.created_display_name_short?.trim()) {
    return comment.created_display_name_short || t('labels.sharedSource')
  } else if (comment.created_by_email) {
    // Canonical helper — alias when configured, else a name derived from the
    // email's local part (never the raw address).
    return extractUserDisplayNameOrEmail({
      display_name: comment.created_display_name as string,
      email: comment.created_by_email,
    })
  } else {
    return t('labels.sharedSource')
  }
}

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

function handleResetHoverEffect() {
  if (!hoveredCommentId.value) return

  hoveredCommentId.value = null
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

function getUserRole(email: string) {
  const user = baseUsers.value.find((user) => user.email === email)
  if (!user) return ProjectRoles.NO_ACCESS

  return (
    user.roles ??
    (user.workspace_roles
      ? WorkspaceRolesToProjectRoles[user.workspace_roles as WorkspaceUserRoles] ?? ProjectRoles.NO_ACCESS
      : ProjectRoles.NO_ACCESS)
  )
}

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

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    event.stopPropagation()
  }
}

watch(
  comments,
  () => {
    debouncedLoadCommentEditedTooltip()
  },
  { immediate: true },
)

watch(
  () => comments.value?.length,
  () => {
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
  },
)

watch(primaryKey, (_pk, prev) => {
  // Stamp the record being left: what arrived while it was open has been seen.
  if (prev) markCommentsRead(`${prev}`)
  searchQuery.value = ''
  threadExpansion.value = {}
  taskFormCommentId.value = null
  isJumpToUnreadDismissed.value = false
  cancelReply()
  loadReadState()
})

useEventListener(commentsWrapperEl, 'scroll', useDebounceFn(updateUnreadVisibility, 50), { passive: true })

watch(
  () => [unreadComments.value.length, commentsWrapperEl.value],
  () => setTimeout(updateUnreadVisibility, 600),
)

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

onMounted(() => {
  loadReadState()
})

onBeforeUnmount(() => {
  resetTooltipInstances()

  // What arrived while the panel was open has been seen.
  markCommentsRead()

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

        <div ref="commentsWrapperEl" class="relative flex flex-col h-full py-1 nc-scrollbar-thin">
          <div class="mt-auto" />
          <template v-for="entry of feedEntries" :key="entry.key">
            <SmartsheetExpandedFormSidebarCommentActivity v-if="entry.type === 'audit'" :audit="entry.audit" />

            <div
              v-else
              class="nc-comment-thread"
              :class="{ 'nc-comment-thread-resolved': !!entry.thread.root.resolved_by }"
              :data-testid="`nc-comment-thread-${entry.thread.root.id}`"
            >
              <div
                v-if="entry.thread.root.id === firstUnreadRootId"
                class="nc-comment-new-divider flex items-center gap-2 px-3 py-1 text-[11px] font-semibold uppercase text-nc-content-red-medium"
                data-testid="nc-comment-new-divider"
              >
                <span class="h-px flex-1 bg-nc-border-red" />
                {{ $t('activity.commentThread.newDivider') }}
                <span class="h-px flex-1 bg-nc-border-red" />
              </div>

              <!-- Resolved: one line until opened -->
              <button
                v-if="isResolvedCollapsed(entry.thread)"
                type="button"
                class="nc-comment-resolved-row mx-3 my-1 flex w-[calc(100%_-_24px)] items-center gap-2 rounded-lg border-1 border-nc-border-gray-light bg-nc-bg-gray-extralight px-2.5 py-1.5 text-left text-small cursor-pointer hover:bg-nc-bg-gray-light"
                :class="entry.thread.root.id"
                data-testid="nc-comment-resolved-row"
                @click="setResolvedOpen(entry.thread, true)"
              >
                <GeneralIcon icon="checkFill" class="flex-none w-3.5 h-3.5 rounded-full bg-nc-fill-green-dark text-white" />
                <span class="min-w-0 flex-1 truncate text-nc-content-gray-subtle">
                  <span class="font-semibold text-nc-content-gray">{{ firstName(entry.thread.root) }}:</span>
                  {{ commentPlainText(entry.thread.root) }}
                </span>
                <span class="flex-none text-xs text-nc-content-gray-muted">
                  {{
                    $t(
                      'activity.commentThread.commentCount',
                      { count: entry.thread.replies.length + 1 },
                      entry.thread.replies.length + 1,
                    )
                  }}
                </span>
                <GeneralIcon icon="chevronDown" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
              </button>

              <template v-else>
                <div
                  v-for="commentItem of shownComments(entry.thread)"
                  :key="commentItem.id"
                  :class="[
                    commentItem.id,
                    {
                      'nc-comment-reply': commentItem !== entry.thread.root,
                      'opacity-75': !!entry.thread.root.resolved_by,
                    },
                  ]"
                  class="nc-comment-item"
                  :data-testid="`nc-comment-item-${commentItem.id}`"
                  @mouseover="handleResetHoverEffect"
                  @mouseenter="imageAnnotations?.setHovered(commentItem.id!)"
                  @mouseleave="imageAnnotations?.setHovered(null)"
                >
                  <div
                    :class="{
                      'hover:bg-nc-bg-gray-light': editCommentValue?.id !== commentItem!.id,
                      'nc-hovered-comment bg-nc-bg-gray-light': hoveredCommentId === commentItem!.id,
                      'bg-nc-bg-gray-light':
                        imageAnnotations &&
                        (imageAnnotations.activeAnnotationId.value === commentItem.id ||
                          imageAnnotations.hoveredAnnotationId.value === commentItem.id),
                      'pl-3': commentItem !== entry.thread.root,
                    }"
                    class="group relative overflow-hidden px-3 py-2 transition-colors"
                  >
                    <div class="flex items-start gap-3">
                      <GeneralUserIcon
                        :user="{
                          display_name: commentItem?.created_display_name,
                          email: commentItem?.created_by_email,
                          meta: commentItem?.created_by_meta,
                        }"
                        class="mt-0.5 flex-none"
                        :size="commentItem === entry.thread.root ? 'medium' : 'small'"
                      />
                      <div class="flex min-h-[24px] min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <NcDropdown placement="topLeft" :trigger="['hover']" class="min-w-0 max-w-full">
                          <div
                            class="nc-comment-author truncate text-nc-content-gray font-medium !text-small !leading-[18px] overflow-hidden"
                          >
                            {{ createdBy(commentItem) }}
                          </div>

                          <template #overlay>
                            <div class="bg-nc-bg-elevated rounded-lg">
                              <div class="flex items-center gap-4 py-3 px-2">
                                <GeneralUserIcon
                                  class="border-1 border-nc-border-gray-medium rounded-full"
                                  :user="{
                                    display_name: commentItem?.created_display_name,
                                    email: commentItem?.created_by_email,
                                    meta: commentItem?.created_by_meta,
                                  }"
                                  size="base"
                                />
                                <div class="flex flex-col">
                                  <div class="font-semibold text-nc-content-gray">
                                    {{ createdBy(commentItem) }}
                                  </div>
                                  <div class="text-xs text-nc-content-gray-subtle2">
                                    {{ commentItem.created_by_email }}
                                  </div>
                                </div>
                              </div>
                              <!-- Base-role footer stays off interface surfaces: interface-only
                                   collaborators have no base user list to resolve the role from
                                   (and the base membership itself is base-scoped info). -->
                              <i18n-t
                                v-if="!props.hideRoleInfo && !isInterfaceSurface && isUIAllowed('dataEdit')"
                                keypath="labels.hasRoleInBase"
                                tag="div"
                                class="px-3 rounded-b-lg !text-[13px] items-center text-nc-content-gray-subtle2 flex gap-1 bg-nc-bg-gray-light py-1.5"
                              >
                                <template #role>
                                  <RolesBadge size="sm" :border="false" :role="getUserRole(commentItem.created_by_email!)" />
                                </template>
                              </i18n-t>
                            </div>
                          </template>
                        </NcDropdown>
                        <div class="flex-none text-xs text-nc-content-gray-muted">
                          {{ timeAgo(commentItem.created_at!) }}
                        </div>
                        <span
                          v-if="isCommentUnread(commentItem)"
                          class="nc-comment-unread-dot h-1.5 w-1.5 flex-none rounded-full bg-nc-fill-red-medium"
                          data-testid="nc-comment-unread-dot"
                        />
                        <span
                          v-if="isCommentExtrasEnabled && getCommentMeta(commentItem).pinned"
                          class="inline-flex flex-none items-center gap-0.5 text-[11px] font-medium text-nc-content-brand"
                        >
                          <GeneralIcon icon="ncPin" class="w-3 h-3" />
                        </span>
                        <NcTooltip
                          v-if="commentItem === entry.thread.root && commentItem.resolved_by"
                          class="flex flex-none"
                          data-testid="nc-comment-resolved-badge"
                        >
                          <template #title>{{
                            `${$t('activity.resolvedBy')} ${commentItem.resolved_display_name_short}`
                          }}</template>
                          <span
                            class="inline-flex items-center gap-1 rounded-md bg-nc-bg-green-light px-1.5 py-0.5 text-[11px] font-medium text-nc-content-green-dark"
                          >
                            <GeneralIcon icon="check" class="w-3 h-3" />
                            {{ $t('activity.commentThread.resolvedByName', { name: commentItem.resolved_display_name_short }) }}
                          </span>
                        </NcTooltip>
                      </div>
                    </div>

                    <!-- Hover action bar -->
                    <div
                      v-if="!editCommentValue && !commentItem.id?.startsWith('temp-')"
                      class="nc-comment-actions !hidden !group-hover:flex absolute right-2 top-1.5 z-10 items-center gap-0.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-elevated p-0.5 shadow-sm"
                      data-testid="nc-comment-actions"
                    >
                      <SmartsheetExpandedFormSidebarCommentReactionPicker
                        v-if="isCommentExtrasEnabled && hasEditPermission"
                        @react="toggleReaction(commentItem.id!, $event)"
                      >
                        <NcTooltip :title="$t('general.react')" placement="top" class="flex">
                          <NcButton
                            class="!w-7 !h-7"
                            size="xsmall"
                            type="text"
                            :aria-label="$t('general.react')"
                            data-testid="nc-comment-react-btn"
                          >
                            <GeneralIcon icon="ncSmile" class="w-4 h-4" />
                          </NcButton>
                        </NcTooltip>
                      </SmartsheetExpandedFormSidebarCommentReactionPicker>

                      <NcTooltip v-if="hasEditPermission" :title="$t('general.reply')" placement="top" class="flex">
                        <NcButton
                          v-e="['c:comment:reply']"
                          class="!w-7 !h-7"
                          size="xsmall"
                          type="text"
                          :aria-label="$t('general.reply')"
                          data-testid="nc-comment-reply-btn"
                          @click="startReply(commentItem)"
                        >
                          <GeneralIcon icon="ncCornerDownLeft" class="w-4 h-4" />
                        </NcButton>
                      </NcTooltip>

                      <template v-if="appInfo.ee && commentItem === entry.thread.root">
                        <NcTooltip v-if="!commentItem.resolved_by && hasEditPermission" placement="top" class="flex">
                          <NcButton
                            class="nc-resolve-comment-btn !w-7 !h-7"
                            size="xsmall"
                            type="text"
                            :aria-label="$t('activity.clickToResolve')"
                            @click="resolveComment(commentItem.id!)"
                          >
                            <GeneralIcon icon="checkCircle" class="w-4 h-4" />
                          </NcButton>
                          <template #title>{{ $t('activity.clickToResolve') }}</template>
                        </NcTooltip>
                        <NcTooltip v-else-if="commentItem.resolved_by && hasEditPermission" placement="top" class="flex">
                          <NcButton
                            class="nc-reopen-comment-btn !w-7 !h-7"
                            size="xsmall"
                            type="text"
                            :aria-label="$t('activity.commentThread.reopen')"
                            data-testid="nc-comment-reopen-btn"
                            @click="resolveComment(commentItem.id!)"
                          >
                            <GeneralIcon icon="checkFill" class="w-4 h-4 rounded-full bg-nc-fill-green-dark text-white" />
                          </NcButton>
                          <template #title>{{ $t('activity.commentThread.reopen') }}</template>
                        </NcTooltip>
                      </template>

                      <NcDropdown
                        v-if="
                          !props.hideCopyUrl ||
                          (isCommentExtrasEnabled && hasEditPermission) ||
                          (user && commentItem.created_by_email === user.email && hasEditPermission)
                        "
                        class="nc-comment-more-actions"
                        overlay-class-name="!min-w-[180px]"
                        placement="bottomRight"
                      >
                        <NcButton
                          class="nc-expand-form-more-actions !w-7 !h-7"
                          size="xsmall"
                          type="text"
                          :aria-label="$t('general.more')"
                        >
                          <GeneralIcon class="text-md" icon="threeDotVertical" />
                        </NcButton>
                        <template #overlay>
                          <NcMenu variant="small">
                            <template v-if="isCommentExtrasEnabled && hasEditPermission">
                              <NcMenuItem
                                data-testid="nc-comment-pin"
                                @click="pinComment(commentItem.id!, !getCommentMeta(commentItem).pinned)"
                              >
                                <div class="flex gap-2 items-center">
                                  <GeneralIcon
                                    :icon="getCommentMeta(commentItem).pinned ? 'ncPinOff' : 'ncPin'"
                                    class="flex-none w-4 h-4"
                                  />
                                  {{
                                    getCommentMeta(commentItem).pinned
                                      ? $t('activity.commentThread.unpin')
                                      : $t('activity.commentThread.pin')
                                  }}
                                </div>
                              </NcMenuItem>
                              <NcMenuItem data-testid="nc-comment-task-menu" @click="taskFormCommentId = commentItem.id!">
                                <div class="flex gap-2 items-center">
                                  <GeneralIcon icon="ncCheckSquare" />
                                  {{
                                    getCommentMeta(commentItem).task
                                      ? $t('activity.commentThread.editTodo')
                                      : $t('activity.commentThread.assignTodo')
                                  }}
                                </div>
                              </NcMenuItem>
                            </template>
                            <NcMenuItem
                              v-if="user && commentItem.created_by_email === user.email && hasEditPermission"
                              v-e="['c:comment-expand:comment:edit']"
                              @click="editComment(commentItem)"
                            >
                              <div class="flex gap-2 items-center">
                                <component :is="iconMap.rename" class="cursor-pointer" />
                                {{ $t('general.edit') }}
                              </div>
                            </NcMenuItem>
                            <NcMenuItem
                              v-if="!props.hideCopyUrl"
                              v-e="['c:comment-expand:comment:copy']"
                              @click="copyComment(commentItem)"
                            >
                              <div class="flex gap-2 items-center">
                                <component :is="iconMap.copy" class="cursor-pointer" />
                                {{ $t('activity.copyUrl') }}
                              </div>
                            </NcMenuItem>
                            <template v-if="user && commentItem.created_by_email === user.email && hasEditPermission">
                              <NcDivider />
                              <NcMenuItem v-e="['c:row-expand:comment:delete']" danger @click="deleteComment(commentItem.id!)">
                                <div class="flex gap-2 items-center">
                                  <GeneralIcon icon="delete" class="cursor-pointer" />
                                  {{ $t('general.delete') }}
                                </div>
                              </NcMenuItem>
                            </template>
                          </NcMenu>
                        </template>
                      </NcDropdown>
                    </div>

                    <div
                      :class="{
                        'mt-3': commentItem.id === editCommentValue?.id,
                      }"
                      class="flex-1 flex flex-col gap-1 max-w-[calc(100%)]"
                    >
                      <div
                        v-if="commentItem.id === editCommentValue?.id && hasEditPermission"
                        @paste="isCommentAttachmentsEnabled ? handleEditAttachmentPaste($event) : undefined"
                        @dragover.prevent
                        @drop="isCommentAttachmentsEnabled ? handleEditAttachmentDrop($event) : undefined"
                      >
                        <SmartsheetExpandedFormRichComment
                          v-model:value="value"
                          autofocus
                          autofocus-to-end
                          :hide-options="false"
                          :extra-save-enabled="editAttachments.length > 0"
                          class="expanded-form-comment-edit-input cursor-text expanded-form-comment-input !py-2 !px-2 !m-0 w-full !border-1 !border-nc-border-gray-medium !rounded-lg !bg-nc-bg-elevated !text-nc-content-gray !text-small !leading-18px !max-h-[240px]"
                          data-testid="expanded-form-comment-input"
                          @save="onEditComment"
                          @keydown.esc="onCancel"
                          @keydown="handleKeyPress"
                          @blur="
                            () => {
                              editCommentValue = undefined
                              isEditing = false
                              clearEditAttachments()
                            }
                          "
                          @keydown.enter.exact.prevent="onEditComment"
                        >
                          <template v-if="editAttachments.length" #attachments>
                            <SmartsheetExpandedFormCommentAttachments
                              :attachments="editAttachments"
                              :comment-id="editCommentValue?.id"
                              editable
                              class="px-1 pt-1"
                              @remove="removeEditAttachment"
                            />
                          </template>
                          <template v-if="isCommentAttachmentsEnabled" #bottom-bar-start>
                            <NcTooltip :title="$t('activity.attachFile')" placement="top">
                              <NcButton
                                v-e="['c:comment:attach-file']"
                                type="text"
                                size="xsmall"
                                class="nc-comment-attach-btn !h-7 !w-7"
                                :loading="isEditAttachmentUploading"
                                :disabled="isEditAttachmentUploading"
                                data-testid="nc-comment-attach-btn"
                                :aria-label="$t('activity.attachFile')"
                                @click="openEditFilePicker"
                              >
                                <GeneralIcon v-if="!isEditAttachmentUploading" icon="lucidePaperclip" class="h-3.5 w-3.5" />
                              </NcButton>
                            </NcTooltip>
                          </template>
                        </SmartsheetExpandedFormRichComment>
                      </div>

                      <div v-else class="space-y-1.5" :class="commentItem === entry.thread.root ? 'pl-9' : 'pl-7'">
                        <div
                          v-if="annotationRefByCommentId[commentItem.id!] && commentItem.id === annotationRefByCommentId[commentItem.id!].rootId"
                          class="nc-annotation-attachment inline-flex max-w-full items-center gap-2 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-elevated px-1.5 py-1"
                          :class="{
                            'cursor-pointer hover:bg-nc-bg-gray-light':
                              !!imageAnnotations || annotationRefByCommentId[commentItem.id!].matched,
                          }"
                          :data-testid="`nc-annotation-attachment-${commentItem.id}`"
                          @click="viewAnnotationComment(commentItem)"
                        >
                          <img
                            v-if="annotationRefByCommentId[commentItem.id!].thumbnailSrc"
                            :src="annotationRefByCommentId[commentItem.id!].thumbnailSrc"
                            class="h-6 w-6 flex-none rounded object-cover"
                          />
                          <GeneralIcon v-else icon="image" class="h-4 w-4 flex-none text-nc-content-gray-muted" />
                          <NcTooltip show-on-truncate-only class="truncate text-small text-nc-content-gray">
                            {{ annotationRefByCommentId[commentItem.id!].title }}
                          </NcTooltip>
                        </div>
                        <div
                          v-if="parsedHtmlComments[commentItem.id]"
                          v-dompurify-html="parsedHtmlComments[commentItem.id]"
                          class="nc-comment-body nc-rich-text-content !text-small !leading-18px !text-nc-content-gray"
                          @click="handleDompurifyLinkClick"
                        ></div>
                        <SmartsheetExpandedFormCommentAttachments
                          v-if="commentItem.attachments?.length"
                          :attachments="commentItem.attachments"
                          :comment-id="commentItem.id"
                          class="mt-1"
                        />

                        <div
                          v-if="annotationLabels[commentItem.id] || (annotationRefByCommentId[commentItem.id!]?.matched && commentItem.id === annotationRefByCommentId[commentItem.id!].rootId)"
                          class="nc-annotation-ref mt-1 inline-flex items-center gap-1.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-elevated px-1.5 py-0.5 cursor-pointer hover:bg-nc-bg-gray-light"
                          :data-testid="`nc-annotation-ref-${annotationLabels[commentItem.id] ?? commentItem.id}`"
                          @click="viewAnnotationComment(commentItem)"
                        >
                          <span
                            v-if="annotationLabels[commentItem.id]"
                            class="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full bg-nc-fill-primary text-white text-[9px] font-semibold"
                          >
                            {{ annotationLabels[commentItem.id] }}
                          </span>
                          <span v-e="['c:attachment:annotation:view']" class="text-[11px] font-medium text-nc-content-brand">
                            {{ $t('general.view') }}
                          </span>
                        </div>

                        <SmartsheetExpandedFormSidebarCommentTaskForm
                          v-if="taskFormCommentId === commentItem.id"
                          :task="getCommentMeta(commentItem).task"
                          :users="assignableUsers"
                          @save="saveTask(commentItem, $event)"
                          @remove="removeTask(commentItem)"
                          @cancel="taskFormCommentId = null"
                        />
                        <SmartsheetExpandedFormSidebarCommentTask
                          v-else-if="isCommentExtrasEnabled && getCommentMeta(commentItem).task"
                          :task="getCommentMeta(commentItem).task!"
                          :assignee-name="userName(getCommentMeta(commentItem).task!.assignee)"
                          :can-edit="hasEditPermission"
                          @toggle="toggleTaskDone(commentItem, $event)"
                          @edit="taskFormCommentId = commentItem.id!"
                        />

                        <SmartsheetExpandedFormSidebarCommentReactions
                          v-if="isCommentExtrasEnabled"
                          :summary="getReactionSummary(commentItem.id)"
                          :can-react="hasEditPermission"
                          @react="toggleReaction(commentItem.id!, $event)"
                        />

                        <!-- Thread controls under the root comment -->
                        <div
                          v-if="
                            commentItem === entry.thread.root && (entry.thread.replies.length || entry.thread.root.resolved_by)
                          "
                          class="flex flex-wrap items-center gap-x-3 gap-y-1"
                        >
                          <button
                            v-if="entry.thread.replies.length && !isThreadExpanded(entry.thread)"
                            type="button"
                            class="nc-comment-thread-summary-btn -ml-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md text-left px-1 py-0.5 text-xs font-semibold text-nc-content-brand hover:bg-nc-bg-brand cursor-pointer"
                            data-testid="nc-comment-thread-expand"
                            @click="setThreadExpanded(entry.thread, true)"
                          >
                            <span class="flex -space-x-1">
                              <GeneralUserIcon
                                v-for="replier of threadRepliers(entry.thread)"
                                :key="replier.id"
                                :user="{
                                  display_name: replier.created_display_name,
                                  email: replier.created_by_email,
                                  meta: replier.created_by_meta,
                                }"
                                size="small"
                                class="border-1 border-nc-bg-default rounded-full"
                              />
                            </span>
                            <span class="whitespace-nowrap">
                              {{
                                $t(
                                  'activity.commentThread.replyCount',
                                  { count: entry.thread.replies.length },
                                  entry.thread.replies.length,
                                )
                              }}
                            </span>
                            <template v-if="unreadReplyCount(entry.thread)">
                              <span class="inline-flex items-center gap-1 whitespace-nowrap text-nc-content-red-medium">
                                <span class="h-1.5 w-1.5 rounded-full bg-nc-fill-red-medium" />
                                {{ $t('activity.commentThread.newCount', { count: unreadReplyCount(entry.thread) }) }}
                              </span>
                            </template>
                            <span class="whitespace-nowrap font-normal text-nc-content-gray-muted">
                              {{
                                $t('activity.commentThread.lastReply', {
                                  time: timeAgo(entry.thread.replies[entry.thread.replies.length - 1]!.created_at!),
                                })
                              }}
                            </span>
                          </button>
                          <button
                            v-else-if="entry.thread.replies.length > COLLAPSE_AFTER_REPLIES"
                            type="button"
                            class="-ml-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-nc-content-gray-subtle hover:bg-nc-bg-gray-medium cursor-pointer"
                            data-testid="nc-comment-thread-collapse"
                            @click="setThreadExpanded(entry.thread, false)"
                          >
                            <GeneralIcon icon="ncChevronUp" class="w-3.5 h-3.5" />
                            {{
                              $t(
                                'activity.commentThread.hideReplies',
                                { count: entry.thread.replies.length },
                                entry.thread.replies.length,
                              )
                            }}
                          </button>

                          <button
                            v-if="canSummarize(entry.thread) && !threadSummaries[entry.thread.root.id!]"
                            type="button"
                            class="flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-semibold text-nc-content-purple-dark hover:bg-nc-bg-purple-light cursor-pointer"
                            data-testid="nc-comment-thread-summarize"
                            @click="summarizeThread(entry.thread.root.id!)"
                          >
                            <GeneralIcon icon="ncAutoAwesome" class="w-3.5 h-3.5 !text-current" />
                            {{ $t('activity.commentThread.summarize') }}
                          </button>

                          <button
                            v-if="entry.thread.root.resolved_by"
                            type="button"
                            class="flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-nc-content-gray-subtle hover:bg-nc-bg-gray-medium cursor-pointer"
                            data-testid="nc-comment-resolved-collapse"
                            @click="setResolvedOpen(entry.thread, false)"
                          >
                            <GeneralIcon icon="ncChevronUp" class="w-3.5 h-3.5" />
                            {{ $t('general.collapse') }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="threadSummaries[entry.thread.root.id!]" class="px-3 pb-2 pl-12">
                  <SmartsheetExpandedFormSidebarCommentSummary
                    :summary="threadSummaries[entry.thread.root.id!]!"
                    @dismiss="dismissThreadSummary(entry.thread.root.id!)"
                  />
                </div>

                <div
                  v-if="replyThreadId === entry.thread.root.id && hasEditPermission"
                  class="nc-comment-reply-composer nc-comment-reply flex flex-col gap-1 py-2 pl-3 pr-3"
                  @paste="isCommentAttachmentsEnabled ? handleReplyAttachmentPaste($event) : undefined"
                  @dragover.prevent
                  @drop="isCommentAttachmentsEnabled ? handleReplyAttachmentDrop($event) : undefined"
                  @keydown.esc.capture="onReplyEscape"
                >
                  <div class="flex items-start gap-2">
                    <GeneralUserIcon :user="user" size="small" class="mt-2 flex-none" />
                    <SmartsheetExpandedFormRichComment
                      ref="replyInputRef"
                      v-model:value="reply"
                      autofocus
                      hide-options
                      :placeholder="$t('activity.commentThread.replyPlaceholder')"
                      class="expanded-form-comment-input nc-comment-reply-input !py-1 !px-1.5 cursor-text border-1 rounded-lg min-w-0 flex-1 bg-transparent !text-nc-content-gray !text-small !leading-18px !max-h-[200px]"
                      data-testid="nc-comment-reply-input"
                      @keydown="handleKeyPress"
                      @blur="onReplyBlur"
                      @save="saveReply"
                      @keydown.enter.exact.prevent="saveReply"
                    />
                    <div class="flex flex-none items-center gap-0.5 pt-0.5">
                      <NcTooltip v-if="isCommentAttachmentsEnabled" :title="$t('activity.attachFile')" placement="top">
                        <NcButton
                          v-e="['c:comment:attach-file']"
                          type="text"
                          size="xsmall"
                          class="nc-comment-attach-btn !h-7 !w-7"
                          :loading="isReplyAttachmentUploading"
                          :disabled="isReplyAttachmentUploading"
                          :aria-label="$t('activity.attachFile')"
                          @mousedown.prevent
                          @click="openReplyFilePicker"
                        >
                          <GeneralIcon v-if="!isReplyAttachmentUploading" icon="lucidePaperclip" class="h-3.5 w-3.5" />
                        </NcButton>
                      </NcTooltip>
                      <NcButton
                        class="nc-comment-reply-send !h-7 !w-7 !shadow-none"
                        size="xsmall"
                        :disabled="(!reply.trim() && !replyAttachments.length) || isReplyAttachmentUploading"
                        :aria-label="$t('general.send')"
                        data-testid="nc-comment-reply-send"
                        @mousedown.prevent
                        @click="saveReply"
                      >
                        <GeneralIcon icon="ncSendAlt" />
                      </NcButton>
                    </div>
                  </div>
                  <SmartsheetExpandedFormCommentAttachments
                    v-if="replyAttachments.length"
                    :attachments="replyAttachments"
                    editable
                    class="pl-7"
                    @remove="removeReplyAttachment"
                  />
                </div>
              </template>
            </div>
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

:deep(.expanded-form-comment-edit-input .nc-comment-rich-editor) {
  @apply bg-nc-bg-elevated;
}

.nc-hovered-comment .nc-comment-actions,
.nc-comment-actions:focus-within,
.nc-comment-actions.nc-comment-actions-open {
  @apply !flex;
}

.nc-comment-reply {
  @apply ml-6 border-l-1 border-nc-border-gray-medium;
}

:deep(.nc-rich-link-tooltip) {
  @apply text-nc-content-gray-muted;
}

.nc-rich-text-content {
  p {
    @apply !m-0 !leading-5;
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
