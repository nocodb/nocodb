import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import { generateUniqueTitle as generateTitle } from '#imports'

export function useTable(onTableCreate?: (tableMeta: TableType) => void, sourceId?: string) {
  const table = reactive<{ title: string; table_name: string; columns: string[] }>({
    title: '',
    table_name: '',
    columns: SYSTEM_COLUMNS,
  })

  const { t } = useI18n()

  const { $e, $api } = useNuxtApp()

  const { getMeta, removeMeta } = useMetas()

  const { closeTab } = useTabs()

  const baseStore = useBase()
  const { loadTables, isXcdbBase } = baseStore
  const { sqlUis, base, tables } = storeToRefs(baseStore)

  const { refreshCommandPalette } = useCommandPalette()

  const { createTableMagic: _createTableMagic, createSchemaMagic: _createSchemaMagic } = useNocoEe()

  const sqlUi = computed(() => (sourceId && sqlUis.value[sourceId] ? sqlUis.value[sourceId] : Object.values(sqlUis.value)[0]))

  const createTable = async (baseId?: string) => {
    if (!sourceId) {
      sourceId = base.value.sources?.[0].id
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
      const tableMeta = await $api.source.tableCreate(
        baseId ?? (base?.value?.id as string),
        (sourceId || base?.value?.sources?.[0].id)!,
        {
          ...table,
          columns,
        },
      )
      $e('a:table:create')
      onTableCreate?.(tableMeta)
      refreshCommandPalette()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const createTableMagic = async () => {
    if (!sqlUi?.value || !sourceId) return

    await _createTableMagic(base, sourceId, table, onTableCreate)
  }

  const createSchemaMagic = async () => {
    if (!sqlUi?.value || !sourceId) return

    return await _createSchemaMagic(base, sourceId, table, onTableCreate)
  }

  const createSqlView = async (sql: string) => {
    if (!sqlUi?.value) return
    if (!sql || sql.trim() === '') return

    try {
      const tableMeta = await $api.source.createSqlView(base?.value?.id as string, sourceId as string, {
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
          const relationColumns = meta?.columns?.filter((c) => isLinksOrLTAR(c) && !isSystemColumn(c))

          // Check if table has any relation columns and show notification
          // skip for xcdb source
          if (relationColumns?.length && !isXcdbBase(table.source_id)) {
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
    base,
    deleteTable,
  }
}
