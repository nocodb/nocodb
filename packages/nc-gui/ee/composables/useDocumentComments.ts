import type { CommentType } from 'nocodb-sdk'
import { NcMarkdownParser } from '~/helpers/tiptap'

export interface DocCommentExtended extends CommentType {
  created_display_name?: string | null
  created_display_name_short?: string
  resolved_display_name?: string | null
  resolved_display_name_short?: string
  created_by_meta?: Record<string, any>
  resolved_by_meta?: Record<string, any>
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

  const baseUsers = computed(() => {
    if (!activeProjectId.value) return []
    return basesUser.value.get(activeProjectId.value) || []
  })

  const parsedHtmlComments = computed(() => {
    return comments.value.reduce(
      (acc, comment) => {
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
      },
      {} as Record<string, string>,
    )
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

    try {
      // Optimistic delete
      comments.value = comments.value.filter((c) => c.id !== commentId)

      await $api.internal.postOperation(
        activeWorkspaceId.value!,
        activeProjectId.value!,
        { operation: 'documentCommentDelete' },
        { commentId },
      )
    } catch (e: any) {
      // Revert on failure
      comments.value = [...comments.value, original]
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
              : (user.value?.display_name ?? extractNameFromEmail(user.value?.email)),
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
    loadComments,
    saveComment,
    updateComment,
    deleteComment,
    resolveComment,
    scrollToComment,
    clearActiveComment,
  }
})
