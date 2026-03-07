import type { CommentReactionsType, CommentType } from 'nocodb-sdk'
import { NcMarkdownParser } from '~/helpers/tiptap'

export interface ReactionSummaryItem {
  emoji: string
  count: number
  hasReacted: boolean
}

export interface DocCommentExtended extends CommentType {
  created_display_name?: string | null
  created_display_name_short?: string
  resolved_display_name?: string | null
  resolved_display_name_short?: string
  created_by_meta?: Record<string, any>
  resolved_by_meta?: Record<string, any>
}

/** Top-level comment with its single-level replies grouped together for rendering. */
export interface ThreadedComment extends DocCommentExtended {
  replies: DocCommentExtended[]
}

/**
 * Composable for document-level comments.
 *
 * Uses `createSharedComposable` — singleton per Vue app instance, shared
 * across all consumers (Editor, Sidebar, etc.).
 *
 * Pattern mirrors `useRowComments` but targets document comments via
 * the `documentComment*` internal API operations.
 */
export const useDocumentComments = createSharedComposable(() => {
  const { user } = useGlobal()

  const { isUIAllowed } = useRoles()

  const { $api, $e } = useNuxtApp()

  const basesStore = useBases()
  const { basesUser } = storeToRefs(basesStore)
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const documentsStore = useDocumentsStore()
  const { activeProjectId } = storeToRefs(useBases())

  const comments = ref<DocCommentExtended[]>([])
  const isCommentsLoading = ref(false)
  const activeCommentId = ref<string | null>(null)
  const activeDocId = ref<string | null>(null)
  const replyingTo = ref<DocCommentExtended | null>(null)

  // Group flat comments into single-level threads: top-level parents with their replies.
  // Orphaned replies (parent deleted) are silently excluded from the UI.
  const threadedComments = computed<ThreadedComment[]>(() => {
    const topLevel = comments.value.filter((c) => !c.parent_comment_id)
    const replyMap = new Map<string, DocCommentExtended[]>()

    for (const c of comments.value) {
      if (c.parent_comment_id) {
        const list = replyMap.get(c.parent_comment_id) || []
        list.push(c)
        replyMap.set(c.parent_comment_id, list)
      }
    }

    return topLevel.map((c) => ({
      ...c,
      replies: replyMap.get(c.id!) || [],
    }))
  })

  const setReplyingTo = (comment: DocCommentExtended) => {
    // Always reply to the root parent (single-level threading)
    if (comment.parent_comment_id) {
      const parent = comments.value.find((c) => c.id === comment.parent_comment_id)
      if (parent) {
        replyingTo.value = parent
        return
      }
    }
    replyingTo.value = comment
  }

  const clearReplyingTo = () => {
    replyingTo.value = null
  }

  const baseUsers = computed(() => {
    if (!activeProjectId.value) return []
    return basesUser.value.get(activeProjectId.value) || []
  })

  const parsedHtmlComments = computed(() => {
    return comments.value.reduce((acc, comment) => {
      if (comment.id) {
        let commentValue = unref(comment.comment) ?? ''
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
    }, {} as Record<string, string>)
  })

  const enrichComment = (comment: CommentType): DocCommentExtended => {
    const creator = baseUsers.value.find((u) => u.id === comment.created_by)
    const resolver = comment.resolved_by ? baseUsers.value.find((u) => u.id === comment.resolved_by) : null
    return {
      ...comment,
      created_display_name: creator?.display_name,
      created_display_name_short: creator?.display_name ?? extractNameFromEmail(creator?.email),
      resolved_display_name: resolver?.display_name,
      resolved_display_name_short: resolver?.display_name ?? extractNameFromEmail(resolver?.email),
      created_by_meta: creator?.meta,
      resolved_by_meta: resolver?.meta,
    }
  }

  const loadComments = async (docId: string) => {
    if (!isUIAllowed('documentCommentList')) return
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      isCommentsLoading.value = true
      activeDocId.value = docId

      const res = ((
        await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
          operation: 'documentCommentList',
          fk_doc_id: docId,
        })
      ).list || []) as CommentType[]

      comments.value = res.map(enrichComment)

      // Load reactions for all comments in the background
      const commentIds = res.map((c) => c.id).filter(Boolean) as string[]
      if (commentIds.length) {
        loadReactions(commentIds)
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isCommentsLoading.value = false
    }
  }

  const saveComment = async (commentText: string, anchorId?: string | null, parentCommentId?: string) => {
    if (!activeDocId.value || !commentText) return
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      const result = await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        { operation: 'documentCommentCreate' },
        {
          fk_doc_id: activeDocId.value,
          comment: commentText.replace(/(<br \/>)+$/g, ''),
          anchor_id: anchorId ?? null,
          parent_comment_id: parentCommentId,
        },
      )

      // Replace the optimistic temp comment with the real one from server
      // instead of reloading the full list (which causes scroll flash)
      if (result?.id) {
        const tempIdx = comments.value.findIndex((c) => c.id?.startsWith('temp-'))
        if (tempIdx !== -1) {
          comments.value[tempIdx] = { ...comments.value[tempIdx], id: result.id }
        }
      }

      $e('a:doc:comment:create')
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      // Reload on error to get consistent state
      await loadComments(activeDocId.value)
    }
  }

  const updateComment = async (commentId: string, commentText: string) => {
    if (!isUIAllowed('documentCommentUpdate')) return

    const original = comments.value.find((c) => c.id === commentId)
    if (!original) return

    try {
      // Optimistic update
      comments.value = comments.value.map((c) =>
        c.id === commentId ? { ...c, comment: commentText, updated_at: new Date().toISOString() } : c,
      )

      await $api.internal.postOperation(
        activeWorkspaceId.value!,
        activeProjectId.value!,
        { operation: 'documentCommentUpdate' },
        { commentId, comment: commentText },
      )
    } catch (e: any) {
      // Revert on failure
      comments.value = comments.value.map((c) => (c.id === commentId ? original : c))
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const deleteComment = async (commentId: string) => {
    if (!isUIAllowed('documentCommentDelete')) return

    const original = comments.value.find((c) => c.id === commentId)
    if (!original) return

    // Snapshot removed items (parent + its replies) so we can revert on failure
    const removedReplies = comments.value.filter((c) => c.parent_comment_id === commentId)

    try {
      // Optimistic delete — also removes child replies to keep UI consistent.
      // Backend cascade-deletes replies; this mirrors that behavior optimistically.
      comments.value = comments.value.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId)

      await $api.internal.postOperation(
        activeWorkspaceId.value!,
        activeProjectId.value!,
        { operation: 'documentCommentDelete' },
        { commentId },
      )
    } catch (e: any) {
      // Revert parent and its replies on failure
      comments.value = [...comments.value, original, ...removedReplies]
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const resolveComment = async (commentId: string) => {
    if (!isUIAllowed('documentCommentResolve')) return

    const original = comments.value.find((c) => c.id === commentId)
    if (!original) return

    try {
      // Optimistic toggle
      comments.value = comments.value.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            resolved_by: original.resolved_by ? undefined : user.value?.id,
            resolved_display_name: original.resolved_by ? undefined : user.value?.display_name,
            resolved_display_name_short: original.resolved_by
              ? undefined
              : user.value?.display_name ?? extractNameFromEmail(user.value?.email),
            resolved_by_meta: original.resolved_by ? undefined : user.value?.meta,
          }
        }
        return c
      })

      await $api.internal.postOperation(
        activeWorkspaceId.value!,
        activeProjectId.value!,
        { operation: 'documentCommentResolve' },
        { commentId },
      )
    } catch (e: any) {
      comments.value = comments.value.map((c) => (c.id === commentId ? original : c))
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  /**
   * Apply a realtime event to the local comments list without refetching.
   * Called from useRealtime when a DOCUMENT_COMMENT_EVENT arrives.
   */
  const applyRealtimeEvent = (action: string, payload: Record<string, any>) => {
    const commentData = payload as CommentType

    if (action === 'add') {
      // Skip if we already have this comment (e.g., the sender's own optimistic insert)
      if (commentData.id && comments.value.some((c) => c.id === commentData.id)) return
      // Also skip if there's a temp placeholder from the current user
      if (commentData.created_by === user.value?.id && comments.value.some((c) => c.id?.startsWith('temp-'))) return

      comments.value = [...comments.value, enrichComment(commentData)]
    } else if (action === 'update') {
      if (!commentData.id) return
      comments.value = comments.value.map((c) => (c.id === commentData.id ? enrichComment(commentData) : c))
    } else if (action === 'delete') {
      if (!commentData.id) return
      comments.value = comments.value.filter((c) => c.id !== commentData.id)
    } else if (action === 'resolve') {
      if (!commentData.id) return
      comments.value = comments.value.map((c) => (c.id === commentData.id ? enrichComment(commentData) : c))
    }
  }

  // --- Reactions ---

  const reactions = ref<Record<string, CommentReactionsType[]>>({})

  const loadReactions = async (commentIds: string[]) => {
    if (!commentIds.length) return
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      const res = await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'documentCommentReactionList',
        commentIds: commentIds.join(','),
      })

      // Merge into existing reactions (replace entries for loaded comment IDs)
      const updated = { ...reactions.value }
      for (const id of commentIds) {
        updated[id] = res?.[id] || []
      }
      reactions.value = updated
    } catch (_e: any) {
      // Silently fail — reactions are non-critical
    }
  }

  const toggleReaction = async (commentId: string, emoji: string) => {
    if (!activeWorkspaceId.value || !activeProjectId.value || !user.value?.id) return

    // Optimistic update
    const prev = reactions.value[commentId] || []
    const existing = prev.find((r) => r.reaction === emoji && ((r as any).created_by ?? r.user_id) === user.value!.id)

    let optimistic: CommentReactionsType[]
    if (existing) {
      optimistic = prev.filter((r) => r.id !== existing.id)
    } else {
      optimistic = [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          comment_id: commentId,
          reaction: emoji,
          // Backend returns `created_by`, SDK type has `user_id` — set both for safety
          user_id: user.value.id,
          created_by: user.value.id,
          created_at: new Date().toISOString(),
        } as CommentReactionsType & { created_by?: string },
      ]
    }
    reactions.value = { ...reactions.value, [commentId]: optimistic }

    try {
      await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        { operation: 'documentCommentReactionToggle' },
        { commentId, reaction: emoji },
      )

      // Reload reactions for this comment to get accurate server state
      await loadReactions([commentId])
    } catch (e: any) {
      // Revert on error
      reactions.value = { ...reactions.value, [commentId]: prev }
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const getReactionSummary = (commentId: string): ReactionSummaryItem[] => {
    const list = reactions.value[commentId] || []
    if (!list.length) return []

    const grouped = new Map<string, { count: number; hasReacted: boolean }>()

    for (const r of list) {
      if (!r.reaction) continue
      const entry = grouped.get(r.reaction) || { count: 0, hasReacted: false }
      entry.count++
      if (((r as any).created_by ?? r.user_id) === user.value?.id) entry.hasReacted = true
      grouped.set(r.reaction, entry)
    }

    return Array.from(grouped.entries()).map(([emoji, { count, hasReacted }]) => ({
      emoji,
      count,
      hasReacted,
    }))
  }

  const scrollToComment = (commentId: string) => {
    activeCommentId.value = commentId
  }

  const clearActiveComment = () => {
    activeCommentId.value = null
  }

  return {
    comments,
    isCommentsLoading,
    activeCommentId,
    activeDocId,
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
    applyRealtimeEvent,
    scrollToComment,
    clearActiveComment,
    reactions,
    toggleReaction,
    getReactionSummary,
    loadReactions,
  }
})
