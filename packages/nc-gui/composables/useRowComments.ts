import type { ColumnType, CommentReactionType, CommentType, GroupedCommentReactionType, MetaType, TableType } from 'nocodb-sdk'
import { NcMarkdownParser } from '~/helpers/tiptap'

export interface CommentTypeExtended extends CommentType {
  created_display_name?: string | null
  created_display_name_short?: string
  resolved_display_name?: string | null
  resolved_display_name_short?: string
  created_by_meta?: MetaType
  resolved_by_meta?: MetaType
  reactions?: CommentReactionType[]
}

export interface ThreadedCommentType extends CommentTypeExtended {
  replies: CommentTypeExtended[]
}

const [useProvideRowComments, useRowComments] = useInjectionState((meta: Ref<TableType>, row: Ref<Row>) => {
  const isCommentsLoading = ref(false)

  const { user } = useGlobal()

  const { isUIAllowed } = useRoles()

  const { $e, $state, $api } = useNuxtApp()

  const basesStore = useBases()

  const { basesUser } = storeToRefs(basesStore)

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

  const loadComments = async (_rowId?: string, ignoreLoadingIndicator = true) => {
    if (!isUIAllowed('commentList') || (!row.value && !_rowId)) return

    const rowId = _rowId ?? extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

    if (!rowId) return

    try {
      if (!ignoreLoadingIndicator) isCommentsLoading.value = true

      const res = ((
        await $api.internal.getOperation(meta.value!.fk_workspace_id!, meta.value!.base_id!, {
          operation: 'commentList',
          row_id: rowId,
          fk_model_id: meta.value.id as string,
        })
      ).list || []) as Array<CommentTypeExtended>

      comments.value = res.map((comment) => {
        const user = baseUsers.value.find((u) => u.id === comment.created_by)
        const resolvedUser = comment.resolved_by ? baseUsers.value.find((u) => u.id === comment.resolved_by) : null
        return {
          ...comment,
          created_display_name: user?.display_name,
          created_display_name_short: user?.display_name ?? extractNameFromEmail(user?.email),
          resolved_display_name: resolvedUser?.display_name,
          resolved_display_name_short: resolvedUser?.display_name ?? extractNameFromEmail(resolvedUser?.email),
          created_by_meta: user?.meta,
          resolved_by_meta: resolvedUser?.meta,
        }
      })
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
    if (!isUIAllowed('commentDelete')) return
    const tempC = comments.value.find((c) => c.id === commentId)

    if (!tempC) return

    // Save full state for revert (comment + its replies)
    const prevComments = [...comments.value]

    try {
      // Remove comment and its replies (if it's a parent)
      comments.value = comments.value.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId)

      await $api.internal.postOperation(
        (meta.value as any).fk_workspace_id!,
        meta.value!.base_id!,
        {
          operation: 'commentDelete',
        },
        {
          commentId,
        },
      )

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
      comments.value = prevComments
    }
  }

  const resolveComment = async (commentId: string) => {
    if (!isUIAllowed('commentResolve')) return
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
            resolved_display_name_short: tempC.resolved_by
              ? undefined
              : $state.user?.value?.display_name ?? extractNameFromEmail($state.user?.value?.email),
            resolved_by_meta: tempC.resolved_by ? undefined : $state.user?.value?.meta,
          }
        }
        return c
      })
      await $api.internal.postOperation(
        (meta.value as any).fk_workspace_id!,
        meta.value!.base_id!,
        {
          operation: 'commentResolve',
        },
        {
          commentId,
        },
      )
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

  const saveComment = async (comment: string, parentCommentId?: string) => {
    try {
      if (!row.value || !comment) {
        comments.value = comments.value.filter((c) => !c.id?.startsWith('temp-'))
        return
      }

      const rowId = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

      if (!rowId) return

      const payload: Record<string, string> = {
        fk_model_id: meta.value?.id as string,
        row_id: rowId,
        comment: `${comment}`.replace(/(<br \/>)+$/g, ''),
      }

      if (parentCommentId) {
        payload.parent_comment_id = parentCommentId
      }

      await $api.internal.postOperation(
        (meta.value as any).fk_workspace_id!,
        meta.value!.base_id!,
        {
          operation: 'commentRow',
        },
        payload,
      )

      // Increase Comment Count in rowMeta
      Object.assign(row.value, {
        rowMeta: {
          ...row.value.rowMeta,
          commentCount: (row.value.rowMeta.commentCount ?? 0) + 1,
        },
      })

      // reloadTrigger?.trigger()

      await loadComments()
    } catch (e: any) {
      comments.value = comments.value.filter((c) => !(c.id ?? '').startsWith('temp-'))
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
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
      await $api.internal.postOperation(
        (meta.value as any).fk_workspace_id!,
        meta.value!.base_id!,
        {
          operation: 'commentUpdate',
        },
        {
          commentId,
          ...comment,
        },
      )
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

  const groupedReactions = computed(() => {
    const result: Record<string, GroupedCommentReactionType[]> = {}

    for (const comment of comments.value) {
      if (!comment.id) continue

      const reactions = (comment as CommentTypeExtended).reactions || []
      const grouped = new Map<string, { users: { id: string; email?: string; display_name?: string }[] }>()

      for (const r of reactions) {
        if (!r.reaction) continue
        if (!grouped.has(r.reaction)) {
          grouped.set(r.reaction, { users: [] })
        }
        const u = baseUsers.value.find((bu) => bu.id === r.created_by)
        grouped.get(r.reaction)!.users.push({
          id: r.created_by || '',
          email: u?.email,
          display_name: u?.display_name ?? undefined,
        })
      }

      result[comment.id] = Array.from(grouped.entries()).map(([emoji, data]) => ({
        reaction: emoji,
        count: data.users.length,
        users: data.users,
        isMyReaction: data.users.some((u) => u.id === user.value?.id),
      }))
    }

    return result
  })

  const addReaction = async (commentId: string, emoji: string) => {
    if (!isUIAllowed('commentReactionAdd')) return

    const comment = comments.value.find((c) => c.id === commentId)
    if (!comment) return

    // Optimistic update
    const ext = comment as CommentTypeExtended
    if (!ext.reactions) ext.reactions = []

    // Prevent duplicate from double-click
    const alreadyReacted = ext.reactions.some(
      (r) => r.reaction === emoji && r.created_by === user.value?.id,
    )
    if (alreadyReacted) return

    ext.reactions.push({
      comment_id: commentId,
      reaction: emoji,
      created_by: user.value?.id,
      created_at: new Date().toISOString(),
    })
    // Trigger reactivity
    comments.value = [...comments.value]

    try {
      await $api.internal.postOperation(
        (meta.value as any).fk_workspace_id!,
        meta.value!.base_id!,
        {
          operation: 'commentReactionAdd',
        },
        {
          commentId,
          reaction: emoji,
        },
      )
    } catch (e: unknown) {
      // Revert optimistic update
      ext.reactions = ext.reactions.filter(
        (r) => !(r.reaction === emoji && r.created_by === user.value?.id),
      )
      comments.value = [...comments.value]
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    }
  }

  const removeReaction = async (commentId: string, emoji: string) => {
    if (!isUIAllowed('commentReactionRemove')) return

    const comment = comments.value.find((c) => c.id === commentId)
    if (!comment) return

    const ext = comment as CommentTypeExtended
    if (!ext.reactions) return

    // Save for revert
    const removedReaction = ext.reactions.find(
      (r) => r.reaction === emoji && r.created_by === user.value?.id,
    )
    if (!removedReaction) return

    // Optimistic update
    ext.reactions = ext.reactions.filter(
      (r) => !(r.reaction === emoji && r.created_by === user.value?.id),
    )
    comments.value = [...comments.value]

    try {
      await $api.internal.postOperation(
        (meta.value as any).fk_workspace_id!,
        meta.value!.base_id!,
        {
          operation: 'commentReactionRemove',
        },
        {
          commentId,
          reaction: emoji,
        },
      )
    } catch (e: unknown) {
      // Revert
      ext.reactions.push(removedReaction)
      comments.value = [...comments.value]
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    }
  }

  const toggleReaction = async (commentId: string, emoji: string) => {
    const grouped = groupedReactions.value[commentId] || []
    const existing = grouped.find((r) => r.reaction === emoji)
    if (existing?.isMyReaction) {
      await removeReaction(commentId, emoji)
    } else {
      await addReaction(commentId, emoji)
    }
  }

  const replyingTo = ref<string | null>(null)

  const threadedComments = computed<ThreadedCommentType[]>(() => {
    const topLevel: ThreadedCommentType[] = []
    const repliesMap = new Map<string, CommentTypeExtended[]>()

    for (const c of comments.value) {
      if (c.parent_comment_id) {
        const list = repliesMap.get(c.parent_comment_id) || []
        list.push(c)
        repliesMap.set(c.parent_comment_id, list)
      }
    }

    for (const c of comments.value) {
      if (!c.parent_comment_id) {
        topLevel.push({
          ...c,
          replies: repliesMap.get(c.id!) || [],
        })
      }
    }

    return topLevel
  })

  const primaryKey = computed(() => {
    return extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])
  })

  return {
    comments,
    threadedComments,
    replyingTo,
    loadComments,
    saveComment,
    updateComment,
    resolveComment,
    deleteComment,
    isCommentsLoading,
    primaryKey,
    parsedHtmlComments,
    groupedReactions,
    addReaction,
    removeReaction,
    toggleReaction,
  }
})

export { useProvideRowComments }

export function useRowCommentsOrThrow() {
  const rowComments = useRowComments()
  if (!rowComments) {
    throw new Error('useRowComments is not provided')
  }
  return rowComments
}
