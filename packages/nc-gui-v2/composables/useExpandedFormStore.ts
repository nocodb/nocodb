import { UITypes } from 'nocodb-sdk'
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { message } from 'ant-design-vue'
import { useNuxtApp } from '#app'
import { useInjectionState } from '#imports'
import { useApi } from '~/composables/useApi'
import { useViewData } from '~/composables/useViewData'
import { ActiveViewInj } from '~/context'
import { extractPkFromRow } from '~/utils'
import dayjs from 'dayjs'

const [useProvideExpandedFormStore, useExpandedFormStore] = useInjectionState(
  (meta: Ref<TableType>, row: Ref<Record<string, any>>) => {
    const { $e, $state } = useNuxtApp()
    const { api, isLoading: isCommentsLoading, error: commentsError } = useApi()
    // { useGlobalInstance: true },
    // state
    const commentsOnly = ref(false)
    const commentsAndLogs = ref([])
    const comment = ref('')
    const commentsDrawer = ref(false)

    // todo
    const activeView = inject(ActiveViewInj)

    const { updateOrSaveRow, insertRow } = useViewData(meta, activeView as any)



    // getters
   const primaryValue = computed(() => {
      if (row?.value?.row) {
        const value= '';
        const col = meta?.value?.columns?.find(c => c.pv);
        if (!col) {
          return;
        }
        const uidt = col.uidt;
        if (uidt == UITypes.Date) {
          return (/^\d+$/.test(value) ? dayjs(+value) : dayjs(value)).format('YYYY-MM-DD');
        } else if (uidt == UITypes.DateTime) {
          return (/^\d+$/.test(value) ? dayjs(+value) : dayjs(value)).format('YYYY-MM-DD HH:mm');
        } else if (uidt == UITypes.Time) {
          let dateTime = dayjs(value);
          if (!dateTime.isValid()) {
            dateTime = dayjs(value, 'HH:mm:ss');
          }
          if (!dateTime.isValid()) {
            dateTime = dayjs(`1999-01-01 ${value}`);
          }
          if (!dateTime.isValid()) {
            return value;
          }
          return dateTime.format('HH:mm:ss');
        }
        return value;
      }
    })


    // actions
    const loadCommentsAndLogs = async () => {
      if (!row.value) return
      const rowId = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])
      if (!rowId) return
      commentsAndLogs.value =
        (
          await api.utils.commentList({
            row_id: rowId,
            fk_model_id: meta.value.id as string,
            comments_only: commentsOnly.value,
          })
        )?.reverse?.() || []
    }

    const isYou = (email) => {
      return $state.user?.value?.email === email
    }

    const saveComment = async () => {
      try {
        if (!row.value || !comment.value) return
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
      } catch (e: any) {
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
      comment,
      isYou,
      commentsDrawer,
      row,
      primaryValue
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
