import { UITypes } from 'nocodb-sdk'
import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { message, notification } from 'ant-design-vue'
import dayjs from 'dayjs'
import getPlainText from '../../nc-gui/components/project/spreadsheet/helpers/getPlainText'
import { useProvideSmartsheetRowStore } from '~/composables/useSmartsheetRowStore'
import { NOCO } from '~/lib'
import { useNuxtApp } from '#app'
import { useInjectionState, useProject } from '#imports'
import { useApi } from '~/composables/useApi'
import type { Row } from '~/composables/useViewData'
import { extractPkFromRow, extractSdkResponseErrorMsg } from '~/utils'

const [useProvideExpandedFormStore, useExpandedFormStore] = useInjectionState((meta: Ref<TableType>, row: Ref<Row>) => {
  const { $e, $state, $api } = useNuxtApp()
  const { api, isLoading: isCommentsLoading, error: commentsError } = useApi()
  // { useGlobalInstance: true },
  // state
  const commentsOnly = ref(false)
  const commentsAndLogs = ref([])
  const comment = ref('')
  const commentsDrawer = ref(false)
  const changedColumns = ref(new Set<string>())
  const { project } = useProject()
  const rowStore = useProvideSmartsheetRowStore(meta, row)
  // todo
  // const activeView = inject(ActiveViewInj)

  // const { updateOrSaveRow, insertRow } = useViewData(meta, activeView as any)

  // getters
  const primaryValue = computed(() => {
    if (row?.value?.row) {
      const col = meta?.value?.columns?.find((c) => c.pv)
      if (!col) {
        return
      }
      const value = row.value.row?.[col.title as string]
      const uidt = col.uidt
      if (uidt === UITypes.Date) {
        return (/^\d+$/.test(value) ? dayjs(+value) : dayjs(value)).format('YYYY-MM-DD')
      } else if (uidt === UITypes.DateTime) {
        return (/^\d+$/.test(value) ? dayjs(+value) : dayjs(value)).format('YYYY-MM-DD HH:mm')
      } else if (uidt === UITypes.Time) {
        let dateTime = dayjs(value)
        if (!dateTime.isValid()) {
          dateTime = dayjs(value, 'HH:mm:ss')
        }
        if (!dateTime.isValid()) {
          dateTime = dayjs(`1999-01-01 ${value}`)
        }
        if (!dateTime.isValid()) {
          return value
        }
        return dateTime.format('HH:mm:ss')
      }
      return value
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

  const isYou = (email: string) => {
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

  const save = async () => {
    let data
    try {
      // todo:
      // if (this.presetValues) {
      //   // cater presetValues
      //   for (const k in this.presetValues) {
      //     this.$set(this.changedColumns, k, true);
      //   }
      // }

      const updateOrInsertObj = [...changedColumns.value].reduce((obj, col) => {
        obj[col] = row.value.row[col]
        return obj
      }, {} as Record<string, any>)

      if (row.value.rowMeta.new) {
        data = await $api.dbTableRow.create('noco', project.value.title as string, meta.value.title, updateOrInsertObj)

        /* todo:
           // save hasmany and manytomany relations from local state
            if (this.$refs.virtual && Array.isArray(this.$refs.virtual)) {
              for (const vcell of this.$refs.virtual) {
                if (vcell.save) {
                  await vcell.save(this.localState);
                }
              }
            } */
        row.value = {
          row: data,
          rowMeta: {},
          oldRow: { ...data },
        }

        /// todo:
        // await this.reload();
      } else if (Object.keys(updateOrInsertObj).length) {
        const id = extractPkFromRow(row.value.row, meta.value.columns as ColumnType[])

        if (!id) {
          return message.info("Update not allowed for table which doesn't have primary Key")
        }
        await $api.dbTableRow.update(NOCO, project.value.title as string, meta.value.title, id, updateOrInsertObj)
        for (const key of Object.keys(updateOrInsertObj)) {
          // audit
          $api.utils
            .auditRowUpdate(id, {
              fk_model_id: meta.value.id,
              column_name: key,
              row_id: id,
              value: getPlainText(updateOrInsertObj[key]),
              prev_value: getPlainText(row.value.oldRow[key]),
            })
            .then(() => {})
        }
      } else {
        return message.info('No columns to update')
      }

      // this.$emit('update:oldRow', { ...this.localState });
      // this.changedColumns = {};
      // this.$emit('input', this.localState);
      // this.$emit('update:isNew', false);

      notification.success({
        message: `${primaryValue.value || 'Row'} updated successfully.`,
        // position: 'bottom-right',
      })

      changedColumns.value = new Set()
    } catch (e: any) {
      notification.error({ message: `Failed to update row`, description: await extractSdkResponseErrorMsg(e) })
    }
    $e('a:row-expand:add')
    return data
  }

  return {
    ...rowStore,
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
    primaryValue,
    save,
    changedColumns,
  }
}, 'expanded-form-store')

export { useProvideExpandedFormStore }

export function useExpandedFormStoreOrThrow() {
  const expandedFormStore = useExpandedFormStore()
  if (expandedFormStore == null) throw new Error('Please call `useExpandedFormStore` on the appropriate parent component')
  return expandedFormStore
}
