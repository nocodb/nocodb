import type { ComputedRef, Ref } from 'vue'
import {
  PlanFeatureTypes,
  ProjectRoles,
  RoleLabels,
  UITypes,
  WorkspaceRolesToProjectRoles,
  getAttachmentAnnotationKey,
} from 'nocodb-sdk'
import type { ColumnType, CommentImageAnnotation, CommentType, WorkspaceUserRoles } from 'nocodb-sdk'
import type { CommentThread, CommentTypeExtended } from '~/composables/useRowComments'
import { suggestionHandledKeyEvents } from '~/helpers/tiptap'

/** Replies stay folded behind a summary line once a thread grows past this. */
export const COLLAPSE_AFTER_REPLIES = 3

/** Shorter threads are quicker to read than to summarize. */
const SUMMARIZE_FROM_REPLIES = 3

export function threadComments(thread: CommentThread) {
  return [thread.root, ...thread.replies]
}

interface CommentThreadListOptions {
  /** Scroll container the comment elements are looked up in. */
  containerEl: Ref<HTMLElement | undefined>
  hideCopyUrl?: () => boolean
  hideRoleInfo?: () => boolean
  /** A search is active: collapsed replies open so matches are in the DOM. */
  isSearching?: () => boolean
}

/**
 * UI state shared by the comment threads of one list (the sidebar feed, the
 * Discussion timeline): expansion, the reply and edit forms, and the
 * helpers each thread item renders with.
 */
const [useProvideCommentThreadList, useCommentThreadList] = useInjectionState((options: CommentThreadListOptions) => {
  const { user } = useGlobal()

  const { t } = useI18n()

  const { $e } = useNuxtApp()

  const { isUIAllowed } = useRoles()

  const { dashboardUrl } = useDashboard()

  const { copy } = useCopy()

  const route = useRoute()

  const basesStore = useBases()

  const { basesUser } = storeToRefs(basesStore)

  const meta = inject(MetaInj, ref())

  const activeView = inject(ActiveViewInj, ref())

  const isInterfaceSurface = inject(IsInterfaceRecordSurfaceInj, false)

  const {
    comments,
    loadComments,
    updateComment,
    saveComment,
    primaryKey,
    row,
    threads,
    isCommentExtrasEnabled,
    isCommentUnread,
    acknowledgeUnread,
  } = useRowCommentsOrThrow()

  const { isAiFeaturesEnabled, aiIntegrationAvailable } = useNocoAi()

  const { getFeature } = useEeConfig()

  // Present only inside the attachment carousel — exposes image-annotation state.
  const imageAnnotations = useImageAnnotations()

  const { request: annotationFocusRequest } = useAnnotationFocusRequest()

  const { getPossibleAttachmentSrc } = useAttachment()

  const hasEditPermission = computed(() => isUIAllowed('commentEdit'))

  const hideCopyUrl = computed(() => !!options.hideCopyUrl?.())

  const hideRoleInfo = computed(() => !!options.hideRoleInfo?.() || !!isInterfaceSurface)

  const isSearching = computed(() => !!options.isSearching?.())

  /* users */

  const baseUsers = computed(() => (meta.value?.base_id ? basesUser.value.get(meta.value?.base_id) || [] : []))

  function getUserRole(email: string) {
    const baseUser = baseUsers.value.find((u) => u.email === email)
    if (!baseUser) return ProjectRoles.NO_ACCESS

    return (
      baseUser.roles ??
      (baseUser.workspace_roles
        ? WorkspaceRolesToProjectRoles[baseUser.workspace_roles as WorkspaceUserRoles] ?? ProjectRoles.NO_ACCESS
        : ProjectRoles.NO_ACCESS)
    )
  }

  function getUserRoleLabel(email: string) {
    const role = getUserRole(email)
    const key = RoleLabels[role as keyof typeof RoleLabels] ?? role
    return t(`objects.roleType.${key}`, key)
  }

  function createdBy(comment: CommentType & { created_display_name_short?: string }) {
    if (comment.created_by === user.value?.id) {
      return t('general.you')
    } else if (comment.created_display_name_short?.trim()) {
      return comment.created_display_name_short || t('labels.sharedSource')
    } else if (comment.created_by_email) {
      // Alias when configured, else a name derived from the email's local part.
      return extractUserDisplayNameOrEmail({
        display_name: comment.created_display_name as string,
        email: comment.created_by_email,
      })
    } else {
      return t('labels.sharedSource')
    }
  }

  function firstName(commentItem: CommentTypeExtended) {
    return createdBy(commentItem).split(' ')[0]
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

  /* annotations */

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

  // Attachment context (thumbnail + filename) for annotation comments. Replies
  // inherit the anchor of their root.
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

  function viewAnnotationComment(commentItem: CommentType) {
    if (!commentItem.id) return

    // Inside the carousel — focus the annotation directly.
    if (imageAnnotations) {
      imageAnnotations.viewAnnotation(commentItem)
      return
    }

    // Outside — ask the owning attachment cell to open its carousel on this annotation.
    const refInfo = annotationRefByCommentId.value[commentItem.id]
    if (!refInfo?.matched || !primaryKey.value) return

    annotationFocusRequest.value = {
      rowId: primaryKey.value,
      attachmentKey: refInfo.key,
      // Replies resolve to their root annotation comment.
      commentId: refInfo.rootId,
    }
  }

  /* threads */

  // Survives the loader remounting the list; cleared on post and on row change.
  const deepLinkCommentId = ref<string | null>(null)

  const hoveredCommentId = ref<null | string>(null)

  /** Explicit open/closed picks, keyed by root id (and `resolved-<id>` for a resolved thread's one-line row). */
  const threadExpansion = ref<Record<string, boolean>>({})

  function threadHasComment(thread: CommentThread, commentId: string) {
    return threadComments(thread).some((c) => c.id === commentId)
  }

  function findThread(commentId: string) {
    return threads.value.find((thread) => threadHasComment(thread, commentId))
  }

  /** Root id of the thread whose reply composer is open. */
  const replyThreadId = ref<string | null>(null)

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

  function canSummarize(thread: CommentThread) {
    return (
      isCommentExtrasEnabled.value &&
      isAiFeaturesEnabled.value &&
      aiIntegrationAvailable.value &&
      getFeature(PlanFeatureTypes.FEATURE_AI) &&
      isUIAllowed('dataEdit') &&
      thread.replies.length >= SUMMARIZE_FROM_REPLIES
    )
  }

  function queryInList(selector: string) {
    return (options.containerEl.value ?? document).querySelector(selector)
  }

  function scrollToComment(commentId: string) {
    queryInList(`.${CSS.escape(commentId)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
    setTimeout(() => {
      if (hoveredCommentId.value === commentId) hoveredCommentId.value = null
    }, 2000)
  }

  function handleResetHoverEffect() {
    if (!hoveredCommentId.value) return

    hoveredCommentId.value = null
  }

  /* reply */

  const reply = ref('')

  const {
    isCommentAttachmentsEnabled,
    pendingAttachments: replyAttachments,
    isUploading: isReplyAttachmentUploading,
    openFilePicker: openReplyFilePicker,
    handlePaste: handleReplyAttachmentPaste,
    handleDrop: handleReplyAttachmentDrop,
    removeAttachment: removeReplyAttachment,
    clearAttachments: clearReplyAttachments,
  } = useCommentAttachments()

  function startReply(commentItem: CommentTypeExtended) {
    const thread = findThread(commentItem.id!)
    if (!thread?.root.id || thread.root.id.startsWith('temp-')) return

    if (replyThreadId.value !== thread.root.id) {
      reply.value = ''
      clearReplyAttachments()
    }

    replyThreadId.value = thread.root.id
    threadExpansion.value = { ...threadExpansion.value, [thread.root.id]: true, [`resolved-${thread.root.id}`]: true }

    // Wait for the thread to expand and the editor to mount, or the composer's lower edge stays hidden.
    setTimeout(() => {
      queryInList('.nc-comment-reply-composer')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 150)
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

    await saveComment(text, tempAttachments, undefined, rootId)

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

  /* edit */

  const editCommentValue = ref<CommentType>()

  const isEditing = ref(false)

  // Initialised from the comment being edited so the user can add/remove files.
  const {
    pendingAttachments: editAttachments,
    isUploading: isEditAttachmentUploading,
    openFilePicker: openEditFilePicker,
    handlePaste: handleEditAttachmentPaste,
    handleDrop: handleEditAttachmentDrop,
    removeAttachment: removeEditAttachment,
    clearAttachments: clearEditAttachments,
  } = useCommentAttachments()

  const editValue = computed({
    get() {
      return editCommentValue.value?.comment || ''
    },
    set(val) {
      if (!editCommentValue.value) return
      editCommentValue.value.comment = val
    },
  })

  function editComment(comment: CommentType) {
    editCommentValue.value = { ...comment }
    editAttachments.value = [...(comment.attachments ?? [])]
    isEditing.value = true
    nextTick(() => {
      scrollToComment(comment.id!)
    })
  }

  function onEditCancel(e: KeyboardEvent) {
    if (!isEditing.value) return
    e.preventDefault()
    e.stopPropagation()
    editCommentValue.value = undefined
    clearEditAttachments()
    loadComments()
    isEditing.value = false
  }

  function onEditBlur() {
    editCommentValue.value = undefined
    isEditing.value = false
    clearEditAttachments()
  }

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

    const tempCom = { ...editCommentValue.value }
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

  /* misc */

  async function copyComment(comment: CommentType) {
    const viewId = activeView.value?.fk_model_id === meta.value?.id ? activeView.value?.id : undefined

    // Keep &path=… so the link still resolves when the source view is grouped.
    const pathParam = route.query?.path ? `&path=${route.query.path}` : ''

    await copy(
      encodeURI(
        `${dashboardUrl?.value}/${route.params.typeOrId}/${route.params.baseId}/${meta.value?.id}${
          viewId ? `/${viewId}` : ''
        }?rowId=${primaryKey.value}&commentId=${comment.id}${pathParam}`,
      ),
    )
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key !== 'Escape') {
      event.stopPropagation()
    }
  }

  /** Clears the per-record UI state when another record opens. */
  function resetThreadState() {
    threadExpansion.value = {}
    cancelReply()
  }

  return {
    hasEditPermission,
    hideCopyUrl,
    hideRoleInfo,
    getUserRoleLabel,
    createdBy,
    firstName,
    commentPlainText,
    imageAnnotations,
    annotationLabels,
    annotationRefByCommentId,
    viewAnnotationComment,
    deepLinkCommentId,
    hoveredCommentId,
    threadExpansion,
    findThread,
    isThreadExpanded,
    isResolvedCollapsed,
    shownComments,
    setThreadExpanded,
    setResolvedOpen,
    unreadReplyCount,
    threadRepliers,
    canSummarize,
    scrollToComment,
    revealComment,
    handleResetHoverEffect,
    isCommentAttachmentsEnabled,
    replyThreadId,
    reply,
    replyAttachments,
    isReplyAttachmentUploading,
    openReplyFilePicker,
    handleReplyAttachmentPaste,
    handleReplyAttachmentDrop,
    removeReplyAttachment,
    startReply,
    cancelReply,
    saveReply,
    onReplyEscape,
    onReplyBlur,
    editCommentValue,
    isEditing,
    editAttachments,
    isEditAttachmentUploading,
    openEditFilePicker,
    handleEditAttachmentPaste,
    handleEditAttachmentDrop,
    removeEditAttachment,
    editValue,
    editComment,
    onEditCancel,
    onEditBlur,
    onEditComment,
    copyComment,
    handleKeyPress,
    resetThreadState,
  }
}, 'comment-thread-list')

export { useProvideCommentThreadList }

/**
 * Moves `?commentId=` from the URL into the list's deep link. The link holds until a switch to a record
 * other than the one it names, so it survives the linked record loading in an already-open panel.
 */
export function useCommentDeepLinkFromRoute(
  deepLinkCommentId: Ref<string | null>,
  primaryKey: Ref<unknown>,
  onLink?: () => void,
) {
  const route = useRoute()

  const router = useRouter()

  let linkedRowId: string | undefined

  watch(
    () => route.query.commentId,
    (id) => {
      if (!id) return
      deepLinkCommentId.value = id as string
      linkedRowId = route.query.rowId as string | undefined
      onLink?.()
      // Keep `path` so the group context survives a reload; only commentId is consumed.
      const { commentId: _drop, ...rest } = router.currentRoute.value.query
      router.push({ query: rest })
    },
    { immediate: true },
  )

  watch(primaryKey, (pk, prev) => {
    if (prev && `${pk}` !== linkedRowId) deepLinkCommentId.value = null
  })
}

export function useCommentThreadListOrThrow() {
  const state = useCommentThreadList()
  if (!state) throw new Error('useCommentThreadList is not provided')
  return state
}

/**
 * Read state for a rendered thread list: loads it on mount and per record,
 * stamps it on leave, and drives the "New" line and the jump-to-new button.
 */
export function useCommentListUnread(
  list: ReturnType<typeof useProvideCommentThreadList>,
  wrapperEl: Ref<HTMLElement | undefined>,
  visibleThreads: ComputedRef<CommentThread[]>,
  /** Keep a read state another view of the open record loaded; off for hosts that remount per visit. */
  reuseReadState = true,
) {
  const { $e } = useNuxtApp()

  const { user } = useGlobal()

  const { primaryKey, isCommentUnread, loadReadState, markCommentsRead } = useRowCommentsOrThrow()

  const unreadComments = computed(() => visibleThreads.value.flatMap(threadComments).filter(isCommentUnread))

  /** The "New" line sits above the first thread that started since the last visit. */
  const firstUnreadRootId = computed(() => visibleThreads.value.find((thread) => isCommentUnread(thread.root))?.root.id)

  const isJumpToUnreadDismissed = ref(false)

  /** First new comment below the visible part of the list; the jump button targets it. */
  const unreadBelowId = ref<string | null>(null)

  const isFirstUnreadBelow = computed(() => !!unreadBelowId.value)

  function updateUnreadVisibility() {
    const wrapper = wrapperEl.value
    unreadBelowId.value = null
    if (!wrapper) return

    const bottom = wrapper.getBoundingClientRect().bottom - 24
    for (const thread of visibleThreads.value) {
      for (const unread of threadComments(thread).filter(isCommentUnread)) {
        // A new reply in a collapsed thread is not rendered; its root marks the spot.
        const id = list.isThreadExpanded(thread) ? unread.id : thread.root.id
        const el = id && wrapper.querySelector(`.nc-comment-item.${CSS.escape(id)}`)
        if (el && el.getBoundingClientRect().top > bottom) {
          unreadBelowId.value = unread.id ?? null
          return
        }
      }
    }
  }

  /** Someone else's unread comment doesn't pull a reader who scrolled up; the jump button offers it instead. */
  function shouldHoldScroll(newest?: CommentTypeExtended) {
    const wrapper = wrapperEl.value
    if (!wrapper || !newest || newest.created_by_email === user.value?.email || !isCommentUnread(newest)) return false
    if (wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight <= 120) return false

    isJumpToUnreadDismissed.value = false
    return true
  }

  function jumpToUnread() {
    const targetId = unreadBelowId.value ?? unreadComments.value[0]?.id
    if (!targetId) return

    isJumpToUnreadDismissed.value = true
    list.revealComment(targetId)

    $e('c:comment:unread:navigate')
  }

  useEventListener(wrapperEl, 'scroll', useDebounceFn(updateUnreadVisibility, 50), { passive: true })

  watch(
    () => [unreadComments.value.length, wrapperEl.value],
    () => setTimeout(updateUnreadVisibility, 600),
  )

  watch(primaryKey, (_pk, prev) => {
    // Stamp the record being left: what arrived while it was open has been seen.
    if (prev) markCommentsRead(`${prev}`)
    list.resetThreadState()
    isJumpToUnreadDismissed.value = false
    loadReadState()
  })

  onMounted(() => {
    loadReadState(reuseReadState)
  })

  onBeforeUnmount(() => {
    // What arrived while the list was open has been seen.
    markCommentsRead()
  })

  return { unreadComments, firstUnreadRootId, isJumpToUnreadDismissed, isFirstUnreadBelow, jumpToUnread, shouldHoldScroll }
}
