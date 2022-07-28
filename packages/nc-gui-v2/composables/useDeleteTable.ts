import { Modal } from 'ant-design-vue'
import type { LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { useToast } from 'vue-toastification'
import useTabs, { TabType } from '~/composables/useTabs'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'

export default () => {
  const { $e, $api } = useNuxtApp()
  const toast = useToast()
  const { getMeta, removeMeta } = useMetas()
  const { loadTables } = useProject()
  const { closeTab } = useTabs()

  const deleteTable = (table: TableType) => {
    $e('c:table:delete')
    // 'Click Submit to Delete The table'
    Modal.confirm({
      title: `Click Yes to Delete The table : ${table.title}`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      async onOk() {
        try {
          const meta = (await getMeta(table.id as string)) as TableType
          const relationColumns = meta?.columns?.filter((c) => c.uidt === UITypes.LinkToAnotherRecord)

          if (relationColumns?.length) {
            const refColMsgs = await Promise.all(
              relationColumns.map(async (c, i) => {
                const refMeta = (await getMeta(
                  (c?.colOptions as LinkToAnotherRecordType)?.fk_related_model_id as string,
                )) as TableType
                return `${i + 1}. ${c.title} is a LinkToAnotherRecord of ${(refMeta && refMeta.title) || c.title}`
              }),
            )
            toast.info(
              h('div', {
                innerHTML: `<div style="padding:10px 4px">Unable to delete tables because of the following.
                <br><br>${refColMsgs.join('<br>')}<br><br>
                Delete them & try again</div>`,
              }),
            )
            return
          }

          await $api.dbTable.delete(table?.id as string)

          closeTab({
            type: TabType.TABLE,
            id: table.id,
            title: table.title,
          })

          await loadTables()

          removeMeta(table.id as string)
          toast.info(`Deleted table ${table.title} successfully`)
          $e('a:table:delete')
        } catch (e: any) {
          toast.error(await extractSdkResponseErrorMsg(e))
        }
      },
    })
  }

  return { deleteTable }
}
