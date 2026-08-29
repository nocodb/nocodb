import type { AttachmentType, ColumnType, CommentType, MetaType, TableType } from 'nocodb-sdk'
import { NcMarkdownParser } from '~/helpers/tiptap'

export interface CommentTypeExtended extends CommentType {
  created_display_name?: string | null
  created_display_name_short?: string
  resolved_display_name?: string | null
  resolved_display_name_short?: string
  created_by_meta?: MetaType
  resolved_by_meta?: MetaType
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
  const commentNotificationPreference = ref<'all' | 'mentions'>('mentions')

  // Guards the bell against stale writes: every load/set claims a ticket, and
  // only the newest one may land. Without it, two quick next/prev navigations
  // let the slower (older record's) response win.
  let commentNotificationPreferenceSeq = 0

  async function loadCommentNotificationPreference() {
    if (!isEeUI) return
    if (!ifaceSidebar && !isUIAllowed('commentList')) return

    const seq = ++commentNotificationPreferenceSeq

    // Back to the default before we know: a failed or slow load must never
    // leave the previous record's answer on screen, or the bell's
    // already-selected check silently swallows the user's next pick.
    commentNotificationPreference.value = 'mentions'

    const rowId = primaryKey.value
    if (!rowId) return

    try {
      const res = ifaceSidebar
        ? await ifaceSidebar.commentNotificationPreferenceGet(rowId)
        : await $api.internal.getOperation(meta.value!.fk_workspace_id!, meta.value!.base_id!, {
            operation: 'commentNotificationPreferenceGet',
            row_id: rowId,
            fk_model_id: meta.value.id as string,
          })

      if (seq !== commentNotificationPreferenceSeq) return

      commentNotificationPreference.value = (res as any)?.preference === 'all' ? 'all' : 'mentions'
    } catch {
      // Silent — the bell keeps the default reset above.
    }
  }

  async function setCommentNotificationPreference(preference: 'all' | 'mentions') {
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
    } catch (e: any) {
      if (seq === commentNotificationPreferenceSeq) commentNotificationPreference.value = previous
      message.error(
        await extractSdkResponseErrorMsg(
          e as Error & {
            response: any
          },
        ),
      )
    }
  }

  // Next/prev record navigation rebinds the same engine (the panel stays
  // mounted) — the bell must follow the row, not its mount.
  watch(primaryKey, (pk, prev) => {
    if (pk && pk !== prev) loadCommentNotificationPreference().catch(() => undefined)
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
    row,
    commentNotificationPreference,
    loadCommentNotificationPreference,
    setCommentNotificationPreference,
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
