import type { ColumnType, CommentType, MetaType, TableType } from 'nocodb-sdk'
import { NcMarkdownParser } from '~/helpers/tiptap'

const [useProvideRowComments, useRowComments] = useInjectionState((meta: Ref<TableType>, row: Ref<Row>) => {
  const isCommentsLoading = ref(false)

  const { user } = useGlobal()

  const { isUIAllowed } = useRoles()

  const { $e, $state, $api } = useNuxtApp()

  const basesStore = useBases()

  const { basesUser } = storeToRefs(basesStore)

  const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

  const comments = ref<
    Array<
      CommentType & {
        created_display_name: string
        resolved_display_name?: string
        created_by_meta?: MetaType
        resolved_by_meta?: MetaType
      }
    >
  >([])

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
        await $api.utils.commentList({
          row_id: rowId,
          fk_model_id: meta.value.id as string,
        })
      ).list || []) as Array<
        CommentType & {
          created_display_name: string
        }
      >

      comments.value = res.map((comment) => {
        const user = baseUsers.value.find((u) => u.id === comment.created_by)
        const resolvedUser = comment.resolved_by ? baseUsers.value.find((u) => u.id === comment.resolved_by) : null
        return {
          ...comment,
          created_display_name: user?.display_name ?? (user?.email ?? '').split('@')[0] ?? '',
          resolved_display_name: resolvedUser ? resolvedUser.display_name ?? resolvedUser.email.split('@')[0] : undefined,
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

    try {
      comments.value = comments.value.filter((c) => c.id !== commentId)

      await $api.utils.commentDelete(commentId)

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
            resolved_display_name: tempC.resolved_by
              ? undefined
              : $state.user?.value?.display_name ?? $state.user?.value?.email.split('@')[0],
            resolved_by_meta: tempC.resolved_by ? undefined : $state.user?.value?.meta,
          }
        }
        return c
      })
      await $api.utils.commentResolve(commentId, {})
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

  const saveComment = async (comment: string) => {
    try {
      if (!row.value || !comment) {
        comments.value = comments.value.filter((c) => !c.id?.startsWith('temp-'))
        return
      }

      const rowId = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

      if (!rowId) return

      await $api.utils.commentRow({
        fk_model_id: meta.value?.id as string,
        row_id: rowId,
        comment: `${comment}`.replace(/(<br \/>)+$/g, ''),
      })

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
      await $api.utils.commentUpdate(commentId, comment)
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

  const primaryKey = computed(() => {
    return extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])
  })

  return {
    comments,
    loadComments,
    saveComment,
    updateComment,
    resolveComment,
    deleteComment,
    isCommentsLoading,
    primaryKey,
    parsedHtmlComments,
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
