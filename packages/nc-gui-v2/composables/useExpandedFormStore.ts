import { useNuxtApp } from '#app'
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useInjectionState } from '#imports'
import { useApi } from '~/composables/useApi'
import { extractPkFromRow } from '~/utils'
import { message } from 'ant-design-vue'

const [useProvideExpandedFormStore, useExpandedFormStore] = useInjectionState(
  (meta: Ref<TableType>, row: Ref<Record<string, any>>) => {
    const { $e, $state } = useNuxtApp()
    const { api, isLoading: isCommentsLoading, error: commentsError } = useApi()
    // { useGlobalInstance: true },
    const commentsOnly = ref(false)
    const commentsAndLogs = ref([])
    const comment = ref('')

    const loadCommentsAndLogs = async () => {
      if (!row.value) return
      const rowId = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])
      if (!rowId) return
      commentsAndLogs.value = await api.utils.commentList({
        row_id: rowId,
        fk_model_id: meta.value.id as string,
        comments_only: commentsOnly.value,
      })
    }

    const  isYou = (email) => {
      return $state.user?.value?.email === email;
    }

    const saveComment = async () => {
      try {


        if (!row.value) return
        const rowId = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])
        if (!rowId) return

        await api.utils.commentRow({
          fk_model_id: meta.value?.id as string,
          row_id: rowId,
          description: comment.value,
        })

        comment.value = ''
        message.success('Comment added successfully')
        await loadCommentsAndLogs()
      } catch (e) {
        message.error(e.message)
      }

      $e('a:row-expand:comment')
    }
    return {
      commentsOnly,
      loadCommentsAndLogs,
      commentsAndLogs,
      isCommentsLoading,
      commentsError,
      saveComment,
      comment,isYou
    }
  },
  'expanded-form-store',
)

export { useProvideExpandedFormStore }

export function useExpandedFormStoreOrThrow() {
  const expandedFormStore = useExpandedFormStore()
  if (expandedFormStore == null) throw new Error('Please call `useExpandedFormStore` on the appropriate parent component')
  return expandedFormStore
}
