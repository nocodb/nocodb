import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import {
  Modal,
  SYSTEM_COLUMNS,
  extractSdkResponseErrorMsg,
  generateUniqueTitle as generateTitle,
  message,
  reactive,
  storeToRefs,
  useCommandPalette,
  useI18n,
  useMetas,
  useNuxtApp,
  useProject,
  useTabs,
  watch,
} from '#imports'
import { TabType } from '~/lib'

export function useTable(onTableCreate?: (tableMeta: TableType) => void, baseId?: string) {
  const table = reactive<{ title: string; table_name: string; columns: string[] }>({
    title: '',
    table_name: '',
    columns: SYSTEM_COLUMNS,
  })

  const { t } = useI18n()

  const { $e, $api } = useNuxtApp()

  const { getMeta, removeMeta } = useMetas()

  const { loadTables } = useProject()

  const { closeTab } = useTabs()

  const projectStore = (useProject())
  const { sqlUis, project, tables } = storeToRefs(projectStore)

  const { refreshCommandPalette } = useCommandPalette()

  const sqlUi = computed(() => (baseId && sqlUis.value[baseId] ? sqlUis.value[baseId] : Object.values(sqlUis.value)[0]))

  const createTable = async () => {
    if (!baseId) {
      baseId = project.value.bases?.[0].id
    }

    if (!sqlUi?.value) return
    const columns = sqlUi?.value?.getNewTableColumns().filter((col: ColumnType) => {
      if (col.column_name === 'id' && table.columns.includes('id_ag')) {
        Object.assign(col, sqlUi?.value?.getDataTypeForUiType({ uidt: UITypes.ID }, 'AG'))
        col.dtxp = sqlUi?.value?.getDefaultLengthForDatatype(col.dt)
        col.dtxs = sqlUi?.value?.getDefaultScaleForDatatype(col.dt)
        return true
      }
      return table.columns.includes(col.column_name!)
    })

    try {
      const tableMeta = await $api.base.tableCreate(project?.value?.id as string, (baseId || project?.value?.bases?.[0].id)!, {
        ...table,
        columns,
      })
      $e('a:table:create')
      onTableCreate?.(tableMeta)
      refreshCommandPalette()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const createTableMagic = async () => {
    if (!sqlUi?.value) return

    try {
      const tableMeta = await $api.base.tableMagic(project?.value?.id as string, baseId as string, {
        table_name: table.table_name,
        title: table.title,
      })

      $e('a:table:create')
      onTableCreate?.(tableMeta as TableType)
      refreshCommandPalette()
    } catch (e: any) {
      message.warning('NocoAI failed for the demo reasons. Please try again.')
    }
  }

  const createSchemaMagic = async () => {
    if (!sqlUi?.value) return

    try {
      const tableMeta = await $api.base.schemaMagic(project?.value?.id as string, baseId as string, {
        schema_name: table.table_name,
        title: table.title,
      })

      $e('a:table:create')
      onTableCreate?.(tableMeta as TableType)
      refreshCommandPalette()
    } catch (e: any) {
      message.warning('NocoAI failed for the demo reasons. Please try again.')
    }
  }

  const createSqlView = async (sql: string) => {
    if (!sqlUi?.value) return
    if (!sql || sql.trim() === '') return

    try {
      const tableMeta = await $api.base.createSqlView(project?.value?.id as string, baseId as string, {
        view_name: table.table_name,
        view_definition: sql,
      })

      onTableCreate?.(tableMeta as TableType)
      refreshCommandPalette()
    } catch (e: any) {
      message.warning(e)
    }
  }

  watch(
    () => table.title,
    (title) => {
      table.table_name = `${title}`
    },
  )

  const generateUniqueTitle = () => {
    table.title = generateTitle('Sheet', tables.value, 'title')
  }

  const deleteTable = (table: TableType) => {
    $e('c:table:delete')
    // 'Click Submit to Delete The table'
    Modal.confirm({
      title: `${t('msg.info.deleteTableConfirmation')} : ${table.title}?`,
      wrapClassName: 'nc-modal-table-delete',
      okText: t('general.yes'),
      okType: 'danger',
      cancelText: t('general.no'),
      width: 450,
      async onOk() {
        try {
          const meta = (await getMeta(table.id as string, true)) as TableType
          const relationColumns = meta?.columns?.filter((c) => c.uidt === UITypes.LinkToAnotherRecord && !isSystemColumn(c))

          if (relationColumns?.length) {
            const refColMsgs = await Promise.all(
              relationColumns.map(async (c, i) => {
                const refMeta = (await getMeta(
                  (c?.colOptions as LinkToAnotherRecordType)?.fk_related_model_id as string,
                )) as TableType
                return `${i + 1}. ${c.title} is a LinkToAnotherRecord of ${(refMeta && refMeta.title) || c.title}`
              }),
            )
            message.info(
              h('div', {
                innerHTML: `<div style="padding:10px 4px">Unable to delete tables because of the following.
              <br><br>${refColMsgs.join('<br>')}<br><br>
              Delete them & try again</div>`,
              }),
            )
            return
          }

          await $api.dbTable.delete(table?.id as string)

          await closeTab({
            type: TabType.TABLE,
            id: table.id,
            title: table.title,
          })

          await loadTables()

          removeMeta(table.id as string)
          refreshCommandPalette()
          // Deleted table successfully
          message.info(t('msg.info.tableDeleted'))
          $e('a:table:delete')
        } catch (e: any) {
          message.error(await extractSdkResponseErrorMsg(e))
        }
      },
    })
  }

  return {
    table,
    createTable,
    createTableMagic,
    createSchemaMagic,
    createSqlView,
    generateUniqueTitle,
    tables,
    project,
    deleteTable,
  }
}
