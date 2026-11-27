import dayjs from 'dayjs'
import type {
  AttachmentType,
  ColumnType,
  CommentMeta,
  CommentNotificationPreference,
  CommentType,
  MetaType,
  TableType,
} from 'nocodb-sdk'
import { NcMarkdownParser } from '~/helpers/tiptap'

export interface CommentTypeExtended extends CommentType {
  created_display_name?: string | null
  created_display_name_short?: string
  resolved_display_name?: string | null
  resolved_display_name_short?: string
  created_by_meta?: MetaType
  resolved_by_meta?: MetaType
}

export interface CommentReactionItem {
  reaction?: string
  created_by?: string
}

export interface CommentReactionSummaryItem {
  emoji: string
  count: number
  hasReacted: boolean
  names: string[]
}

/** A top-level comment and its replies, oldest first. */
export interface CommentThread {
  root: CommentTypeExtended
  replies: CommentTypeExtended[]
}

export interface CommentThreadSummary {
  loading: boolean
  text?: string
  /** Comments in the thread when the summary was written. */
  count?: number
}

/** Pin and annotation state of a comment — `meta` arrives parsed or as JSON. */
export function getCommentMeta(comment?: CommentType | null): CommentMeta {
  const meta = comment?.meta
  if (!meta) return {}
  if (ncIsString(meta)) {
    try {
      return JSON.parse(meta) ?? {}
    } catch {
      return {}
    }
  }
  return meta as CommentMeta
}

/**
 * Top-level comments with their replies. A reply whose parent is gone starts its own thread; a reply to a
 * reply (stored before replies were flattened server-side) joins the thread at the top of its chain.
 */
export function buildCommentThreads(comments: CommentTypeExtended[]): CommentThread[] {
  const byId = new Map(comments.filter((c) => c.id).map((c) => [c.id!, c]))
  const threadByRootId = new Map<string, CommentThread>()
  const threads: CommentThread[] = []

  function rootOf(comment: CommentTypeExtended) {
    let current = comment
    const seen = new Set<string>()

    while (current.parent_comment_id && byId.has(current.parent_comment_id) && !seen.has(current.parent_comment_id)) {
      seen.add(current.id!)
      current = byId.get(current.parent_comment_id)!
    }

    return current
  }

  for (const comment of comments) {
    if (rootOf(comment) !== comment) continue
    const thread = { root: comment, replies: [] }
    if (comment.id) threadByRootId.set(comment.id, thread)
    threads.push(thread)
  }

  for (const comment of comments) {
    const root = rootOf(comment)
    if (root !== comment) threadByRootId.get(root.id!)?.replies.push(comment)
  }

  return threads
}

const [useProvideRowComments, useRowComments] = useInjectionState((meta: Ref<TableType>, row: Ref<Row>) => {
  const isCommentsLoading = ref(false)

  const { user } = useGlobal()

  const { isUIAllowed } = useRoles()

  const { $e, $state, $api } = useNuxtApp()

  // When mounted inside an interface record overlay, route comment ops through
  // the injected record-sidebar adapter (the interface-scoped, grant +
  // builder-toggle + record-scope gated ops) so interface-only consumers can
  // use them. Absent → normal base ops.
  const ifaceSidebar = inject(InterfaceRecordSidebarInj, undefined)

  const basesStore = useBases()

  const { basesUser } = storeToRefs(basesStore)

  const { isSharedBase } = storeToRefs(useBase())

  const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

  const comments = ref<Array<CommentTypeExtended>>([])

  const parsedHtmlComments = computed(() => {
    return comments.value.reduce((acc, comment) => {
      if (comment.id) {
        let commentValue = unref(comment.comment)
        if (comment.updated_at !== comment.created_at && comment.updated_at) {
          const str = timeAgo(comment.updated_at).replace(' ', '_')
          commentValue += ` [(edited)](a~~~###~~~Edited_${str}) `
        }
        acc[comment.id] =
          NcMarkdownParser.parse(
            commentValue,
            {
              enableMention: !!isEeUI,
              users: unref(baseUsers.value),
              currentUser: unref(user.value),
            },
            true,
          ) ?? ''
      }
      return acc
    }, {} as Record<string, any>)
  })

  /**
   * Reactions, pin, read state and thread summary run on EE base ops
   * that interface surfaces and shared-base sessions don't have.
   */
  const isCommentExtrasEnabled = computed(() => isEeUI && !ifaceSidebar && !isSharedBase.value && !!user.value?.id)

  const threads = computed(() => buildCommentThreads(comments.value))

  const reactions = ref<Record<string, CommentReactionItem[]>>({})

  /** When the caller last had this record's comments open — null until they have. */
  const lastReadAt = ref<string | null>(null)

  const threadSummaries = ref<Record<string, CommentThreadSummary>>({})

  let readStateSeq = 0

  function isCommentUnread(comment: CommentTypeExtended) {
    if (!lastReadAt.value || !comment.created_at || comment.created_by === user.value?.id) return false
    if (comment.id?.startsWith('temp-')) return false
    return dayjs(comment.created_at).isAfter(dayjs(lastReadAt.value))
  }

  /** Row whose comments are on screen — set before the record object may be. */
  const commentsRowId = ref<string>()

  async function loadReactions(rowId = commentsRowId.value) {
    if (!isCommentExtrasEnabled.value || !isUIAllowed('commentList')) return

    if (!rowId) return

    try {
      const res = (await $api.internal.getOperation(meta.value!.fk_workspace_id!, meta.value!.base_id!, {
        operation: 'commentReactionList',
        row_id: rowId,
        fk_model_id: meta.value.id as string,
      })) as Record<string, CommentReactionItem[]>

      if (rowId === commentsRowId.value) reactions.value = res ?? {}
    } catch {
      // Reactions are decoration: the comments stay usable without them.
    }
  }

  function getReactionSummary(commentId?: string): CommentReactionSummaryItem[] {
    const grouped = new Map<string, CommentReactionSummaryItem>()

    for (const item of (commentId && reactions.value[commentId]) || []) {
      if (!item.reaction) continue

      const entry = grouped.get(item.reaction) ?? { emoji: item.reaction, count: 0, hasReacted: false, names: [] }
      entry.count++

      if (item.created_by === user.value?.id) entry.hasReacted = true

      const reactor = baseUsers.value.find((u) => u.id === item.created_by)
      if (reactor) entry.names.push(extractUserDisplayNameOrEmail(reactor))

      grouped.set(item.reaction, entry)
    }

    return [...grouped.values()]
  }

  async function toggleReaction(commentId: string, emoji: string) {
    if (!isCommentExtrasEnabled.value || !user.value?.id || commentId.startsWith('temp-')) return

    const previous = reactions.value[commentId] ?? []
    const mine = previous.find((r) => r.reaction === emoji && r.created_by === user.value!.id)

    reactions.value = {
      ...reactions.value,
      [commentId]: mine ? previous.filter((r) => r !== mine) : [...previous, { reaction: emoji, created_by: user.value.id }],
    }

    try {
      const res = (await $api.internal.postOperation(
        meta.value!.fk_workspace_id!,
        meta.value!.base_id!,
        { operation: 'commentReactionToggle' },
        { commentId, fk_model_id: meta.value.id as string, reaction: emoji },
      )) as { reactions?: CommentReactionItem[] }

      if (res?.reactions) reactions.value = { ...reactions.value, [commentId]: res.reactions }

      $e('a:comment:reaction:toggle', { added: !mine })
    } catch (e: unknown) {
      reactions.value = { ...reactions.value, [commentId]: previous }
      message.error(await extractSdkResponseErrorMsg(e as Error))
    }
  }

  /** One pin per record: pinning a comment unpins the previous one. */
  async function pinComment(commentId: string, pinned: boolean) {
    if (!isCommentExtrasEnabled.value) return

    const previous = comments.value

    comments.value = comments.value.map((c) => {
      const commentMeta = getCommentMeta(c)

      if (c.id === commentId) {
        return {
          ...c,
          meta: { ...commentMeta, pinned: pinned ? { by: user.value!.id, at: new Date().toISOString() } : null },
        }
      }

      return pinned && commentMeta.pinned ? { ...c, meta: { ...commentMeta, pinned: null } } : c
    })

    try {
      await $api.internal.postOperation(
        meta.value!.fk_workspace_id!,
        meta.value!.base_id!,
        { operation: 'commentPin' },
        { commentId, fk_model_id: meta.value.id as string, pinned },
      )

      $e('a:comment:pin:toggle', { pinned })
    } catch (e: unknown) {
      comments.value = previous
      message.error(await extractSdkResponseErrorMsg(e as Error))
    }
  }

  /** Row whose read state `lastReadAt` holds. */
  let readStateRowId: string | undefined

  /**
   * Fetches when the caller last read this record's comments, then stamps the visit.
   * `reuseLoaded` keeps a state already loaded for this row, so switching feeds keeps the same "new" marks.
   */
  async function loadReadState(reuseLoaded = false) {
    const rowId = extractPkFromRow(row.value?.row, meta.value?.columns as ColumnType[])

    if (reuseLoaded && rowId && readStateRowId === rowId) return

    const seq = ++readStateSeq

    lastReadAt.value = null
    readStateRowId = undefined

    if (!isCommentExtrasEnabled.value || !isUIAllowed('commentList')) return

    if (!rowId) return

    try {
      const res = (await $api.internal.getOperation(meta.value!.fk_workspace_id!, meta.value!.base_id!, {
        operation: 'commentNotificationPreferenceGet',
        row_id: rowId,
        fk_model_id: meta.value.id as string,
      })) as { last_read_at?: string | null }

      if (seq !== readStateSeq) return

      lastReadAt.value = res?.last_read_at ?? null
      readStateRowId = rowId

      // The list may still be loading; records that stay empty write nothing.
      await until(() => comments.value.length > 0).toBe(true, { timeout: 5000 })

      if (seq === readStateSeq) await markCommentsRead(rowId)
    } catch {
      // Without a read state nothing is flagged as new.
    }
  }

  async function markCommentsRead(_rowId?: string) {
    // Nothing to have read: no row is written for records without comments.
    if (!isCommentExtrasEnabled.value || !comments.value.length) return

    const rowId = _rowId ?? extractPkFromRow(row.value?.row, meta.value?.columns as ColumnType[])
    if (!rowId || !meta.value?.id) return

    try {
      await $api.internal.postOperation(
        meta.value.fk_workspace_id!,
        meta.value.base_id!,
        { operation: 'commentReadMark' },
        { fk_model_id: meta.value.id as string, row_id: rowId },
      )
    } catch {
      // Best effort: the next visit stamps it again.
    }
  }

  /** The reader has caught up: nothing on screen counts as new any more. */
  function acknowledgeUnread() {
    if (!isCommentExtrasEnabled.value) return

    lastReadAt.value = new Date().toISOString()
    markCommentsRead()
  }

  async function summarizeThread(rootId: string) {
    if (!isCommentExtrasEnabled.value || threadSummaries.value[rootId]?.loading) return

    threadSummaries.value = { ...threadSummaries.value, [rootId]: { loading: true } }

    try {
      const res = (await $api.internal.postOperation(
        meta.value!.fk_workspace_id!,
        meta.value!.base_id!,
        { operation: 'aiCommentThreadSummarize' },
        { commentId: rootId, modelId: meta.value.id as string },
      )) as { text?: string; count?: number }

      threadSummaries.value = { ...threadSummaries.value, [rootId]: { loading: false, text: res?.text, count: res?.count } }

      $e('a:comment:thread:summarize')
    } catch (e: unknown) {
      const { [rootId]: _failed, ...rest } = threadSummaries.value
      threadSummaries.value = rest
      message.error(await extractSdkResponseErrorMsg(e as Error))
    }
  }

  function dismissThreadSummary(rootId: string) {
    const { [rootId]: _dismissed, ...rest } = threadSummaries.value
    threadSummaries.value = rest
  }

  const loadComments = async (_rowId?: string, ignoreLoadingIndicator = true) => {
    // Interface consumers lack base ACL — the adapter's op is grant/toggle gated.
    if ((!ifaceSidebar && !isUIAllowed('commentList')) || (!row.value && !_rowId)) return

    const rowId = _rowId ?? extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

    if (!rowId) return

    try {
      if (!ignoreLoadingIndicator) isCommentsLoading.value = true

      const res = ((ifaceSidebar
        ? await ifaceSidebar.commentList(rowId)
        : await $api.internal.getOperation(meta.value!.fk_workspace_id!, meta.value!.base_id!, {
            operation: 'commentList',
            row_id: rowId,
            fk_model_id: meta.value.id as string,
          })
      ).list || []) as Array<CommentTypeExtended>

      comments.value = res.map((comment) => {
        const user = baseUsers.value.find((u) => u.id === comment.created_by) ?? findServiceUser(comment.created_by)
        const resolvedUser = comment.resolved_by
          ? baseUsers.value.find((u) => u.id === comment.resolved_by) ?? findServiceUser(comment.resolved_by)
          : null
        return {
          ...comment,
          created_display_name: user?.display_name,
          created_display_name_short: extractUserDisplayNameOrEmail(user),
          resolved_display_name: resolvedUser?.display_name,
          resolved_display_name_short: extractUserDisplayNameOrEmail(resolvedUser),
          created_by_meta: user?.meta,
          resolved_by_meta: resolvedUser?.meta,
        }
      })

      commentsRowId.value = rowId

      loadReactions(rowId)
    } catch (e: unknown) {
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    } finally {
      if (!ignoreLoadingIndicator) isCommentsLoading.value = false
    }
  }

  const deleteComment = async (commentId: string) => {
    if (!ifaceSidebar && !isUIAllowed('commentDelete')) return
    const tempC = comments.value.find((c) => c.id === commentId)

    if (!tempC) return

    try {
      comments.value = comments.value.filter((c) => c.id !== commentId)

      if (ifaceSidebar) {
        await ifaceSidebar.commentDelete(commentId)
      } else {
        await $api.internal.postOperation(
          (meta.value as any).fk_workspace_id!,
          meta.value!.base_id!,
          { operation: 'commentDelete' },
          { commentId },
        )
      }

      // update comment count in rowMeta
      Object.assign(row.value, {
        ...row.value,
        rowMeta: {
          ...row.value.rowMeta,
          commentCount: (row.value.rowMeta.commentCount ?? 1) - 1,
        },
      })
    } catch (e: unknown) {
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
      comments.value = [...comments.value, tempC]
    }
  }

  const resolveComment = async (commentId: string) => {
    if (!ifaceSidebar && !isUIAllowed('commentResolve')) return
    const tempC = comments.value.find((c) => c.id === commentId)

    if (!tempC) return

    try {
      comments.value = comments.value.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            resolved_by: tempC.resolved_by ? undefined : $state.user?.value?.id,
            resolved_by_email: tempC.resolved_by ? undefined : $state.user?.value?.email,
            resolved_display_name: tempC.resolved_by ? undefined : $state.user?.value?.display_name,
            resolved_display_name_short: tempC.resolved_by ? undefined : extractUserDisplayNameOrEmail($state.user?.value),
            resolved_by_meta: tempC.resolved_by ? undefined : $state.user?.value?.meta,
          }
        }
        return c
      })
      if (ifaceSidebar) {
        await ifaceSidebar.commentResolve(commentId)
      } else {
        await $api.internal.postOperation(
          (meta.value as any).fk_workspace_id!,
          meta.value!.base_id!,
          { operation: 'commentResolve' },
          { commentId },
        )
      }
    } catch (e: unknown) {
      comments.value = comments.value.map((c) => {
        if (c.id === commentId) {
          return tempC
        }
        return c
      })
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    }
  }

  const saveComment = async (
    comment: string,
    attachments?: AttachmentType[],
    commentMeta?: CommentType['meta'],
    parentCommentId?: string,
    // false: throw the failure (for an inline error) instead of toasting it.
    { notify = true }: { notify?: boolean } = {},
  ) => {
    try {
      if (!row.value || (!comment && !attachments?.length)) {
        comments.value = comments.value.filter((c) => !c.id?.startsWith('temp-'))
        return
      }

      const rowId = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

      if (!rowId) return

      if (ifaceSidebar) {
        await ifaceSidebar.commentRow(rowId, {
          comment: `${comment}`.replace(/(<br \/>)+$/g, ''),
          ...(attachments?.length ? { attachments } : {}),
          ...(commentMeta !== undefined ? { meta: commentMeta } : {}),
          ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
        })
      } else {
        await $api.internal.postOperation(
          (meta.value as any).fk_workspace_id!,
          meta.value!.base_id!,
          { operation: 'commentRow' },
          {
            fk_model_id: meta.value?.id as string,
            row_id: rowId,
            comment: `${comment}`.replace(/(<br \/>)+$/g, ''),
            ...(attachments?.length ? { attachments } : {}),
            ...(commentMeta !== undefined ? { meta: commentMeta } : {}),
            ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
          },
        )
      }

      // Increase Comment Count in rowMeta
      Object.assign(row.value, {
        rowMeta: {
          ...row.value.rowMeta,
          commentCount: (row.value.rowMeta.commentCount ?? 0) + 1,
        },
      })

      // reloadTrigger?.trigger()

      await loadComments()

      // Commenting auto-subscribes server-side (unless an explicit
      // "only @mentions" pick exists) — refresh so the bell reflects it.
      loadCommentNotificationPreference().catch(() => undefined)
    } catch (e: any) {
      comments.value = comments.value.filter((c) => !(c.id ?? '').startsWith('temp-'))
      const errorMessage = await extractSdkResponseErrorMsg(
        e as Error & {
          response: any
        },
      )
      if (!notify) throw new Error(errorMessage)
      message.error(errorMessage)
    }

    $e('a:row-expand:comment')
  }

  const updateComment = async (commentId: string, comment: Partial<CommentType>) => {
    const tempEdit = comments.value.find((c) => c.id === commentId)
    if (!tempEdit) return
    try {
      comments.value = comments.value.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            ...comment,
            updated_at: new Date().toISOString(),
          }
        }
        return c
      })
      if (ifaceSidebar) {
        await ifaceSidebar.commentUpdate(commentId, { ...comment })
      } else {
        await $api.internal.postOperation(
          (meta.value as any).fk_workspace_id!,
          meta.value!.base_id!,
          { operation: 'commentUpdate' },
          { commentId, ...comment },
        )
      }
    } catch (e: any) {
      comments.value = comments.value.map((c) => {
        if (c.id === commentId) {
          return tempEdit
        }
        return c
      })
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    }
  }

  // Optional chaining is load-bearing: `watch(primaryKey)` below evaluates
  // this during setup, and the interface record body mounts before its meta
  // resolves. extractPkFromRow already returns null for a missing row/columns.
  const primaryKey = computed(() => {
    return extractPkFromRow(row.value?.row, meta.value?.columns as ColumnType[])
  })

  /**
   * Record bell — the caller's comment-notification preference for THIS record.
   * 'mentions' (default, no stored row) | 'all' (subscribed — set explicitly
   * via the bell, or auto-set server-side by commenting). Backend ops are
   * EE-only; the bell UI gates on isEeUI.
   */
  const commentNotificationPreference = ref<CommentNotificationPreference>('mentions')

  // Guards the bell against stale writes: every load/set claims a ticket, and
  // only the newest one may land. Without it, two quick next/prev navigations
  // let the slower (older record's) response win.
  let commentNotificationPreferenceSeq = 0

  // Mounted bells; record switches refetch only while one is shown, so a scope
  // without a bell (e.g. an interface page with comments off) never asks.
  let mountedNotificationBells = 0

  /** Called by a bell on mount; returns its unmount release. */
  function trackNotificationBell() {
    mountedNotificationBells++

    let released = false

    return () => {
      if (released) return
      released = true
      mountedNotificationBells--
    }
  }

  async function loadCommentNotificationPreference() {
    // The bell is per-user; a shared-base session has no user and is refused.
    if (!isEeUI || isSharedBase.value) return
    if (!ifaceSidebar && !isUIAllowed('commentList')) return

    const seq = ++commentNotificationPreferenceSeq

    // Back to the default before we know: a failed or slow load must never
    // leave the previous record's answer on screen, or the bell's
    // already-selected check silently swallows the user's next pick.
    commentNotificationPreference.value = 'mentions'

    const rowId = primaryKey.value
    if (!rowId) return

    try {
      const res = (
        ifaceSidebar
          ? await ifaceSidebar.commentNotificationPreferenceGet(rowId)
          : await $api.internal.getOperation(meta.value!.fk_workspace_id!, meta.value!.base_id!, {
              operation: 'commentNotificationPreferenceGet',
              row_id: rowId,
              fk_model_id: meta.value.id as string,
            })
      ) as { preference?: CommentNotificationPreference }

      if (seq !== commentNotificationPreferenceSeq) return

      commentNotificationPreference.value = res?.preference === 'all' ? 'all' : 'mentions'
    } catch {
      // Silent — the bell keeps the default reset above.
    }
  }

  async function setCommentNotificationPreference(preference: CommentNotificationPreference) {
    const rowId = primaryKey.value
    if (!rowId) return

    const seq = ++commentNotificationPreferenceSeq
    const previous = commentNotificationPreference.value
    commentNotificationPreference.value = preference

    try {
      if (ifaceSidebar) {
        await ifaceSidebar.commentNotificationPreferenceSet(rowId, preference)
      } else {
        await $api.internal.postOperation(
          meta.value!.fk_workspace_id!,
          meta.value!.base_id!,
          { operation: 'commentNotificationPreferenceSet' },
          {
            fk_model_id: meta.value?.id as string,
            row_id: rowId,
            preference,
          },
        )
      }

      $e('a:row-expand:comment-notification-preference', { preference })
    } catch (e: unknown) {
      if (seq === commentNotificationPreferenceSeq) commentNotificationPreference.value = previous
      message.error(await extractSdkResponseErrorMsg(e as Error))
    }
  }

  // Next/prev record navigation rebinds the same engine (the panel stays
  // mounted) — the bell must follow the row, not its mount.
  watch(primaryKey, (pk, prev) => {
    if (mountedNotificationBells > 0 && pk && pk !== prev) loadCommentNotificationPreference().catch(() => undefined)

    // First load (no previous record) keeps what loadComments already fetched.
    if (prev && pk !== prev) {
      reactions.value = {}
      threadSummaries.value = {}
    }
  })

  return {
    comments,
    loadComments,
    saveComment,
    updateComment,
    resolveComment,
    deleteComment,
    isCommentsLoading,
    commentsRowId,
    primaryKey,
    parsedHtmlComments,
    row,
    commentNotificationPreference,
    loadCommentNotificationPreference,
    trackNotificationBell,
    setCommentNotificationPreference,
    isCommentExtrasEnabled,
    isReactionsEnabled: isCommentExtrasEnabled,
    threads,
    reactions,
    getReactionSummary,
    toggleReaction,
    pinComment,
    lastReadAt,
    isCommentUnread,
    loadReadState,
    markCommentsRead,
    acknowledgeUnread,
    threadSummaries,
    summarizeThread,
    dismissThreadSummary,
  }
})

export { useProvideRowComments, useRowComments }

export function useRowCommentsOrThrow() {
  const rowComments = useRowComments()
  if (!rowComments) {
    throw new Error('useRowComments is not provided')
  }
  return rowComments
}
