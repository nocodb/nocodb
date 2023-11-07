import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import {
  Modal,
  SYSTEM_COLUMNS,
  TabType,
  computed,
  extractSdkResponseErrorMsg,
  generateUniqueTitle as generateTitle,
  message,
  reactive,
  storeToRefs,
  useBase,
  useCommandPalette,
  useI18n,
  useMetas,
  useNuxtApp,
  useTabs,
  watch,
} from '#imports'

export function useTableNew(param: { onTableCreate?: (tableMeta: TableType) => void; baseId: string; sourceId?: string }) {
  const table = reactive<{ title: string; table_name: string; columns: string[] }>({
    title: '',
    table_name: '',
    columns: SYSTEM_COLUMNS,
  })

  const { t } = useI18n()

  const { $e, $api } = useNuxtApp()

  const { getMeta, removeMeta } = useMetas()

  const { closeTab } = useTabs()

  const { refreshCommandPalette } = useCommandPalette()

  const router = useRouter()

  const route = router.currentRoute

  const basesStore = useBases()

  const { bases } = storeToRefs(basesStore)
  const { baseTables } = storeToRefs(useTablesStore())

  const { loadProjectTables } = useTablesStore()

  const { loadTables, baseUrl, isXcdbBase } = useBase()

  const { loadViews } = useViewsStore()

  const { openedViewsTab, viewsByTable } = storeToRefs(useViewsStore())

  const workspaceId = computed(() => route.value.params.typeOrId as string)

  const tables = computed(() => baseTables.value.get(param.baseId) || [])
  const base = computed(() => bases.value.get(param.baseId))

  const openTable = async (table: TableType) => {
    if (!table.base_id) return

    let base = bases.value.get(table.base_id)
    if (!base) {
      await basesStore.loadProject(table.base_id)
      await loadProjectTables(table.base_id)

      base = bases.value.get(table.base_id)
      if (!base) throw new Error('Base not found')
    }

    let workspaceIdOrType = workspaceId.value ?? 'nc'

    if (['nc', 'base'].includes(route.value.params.typeOrId as string)) {
      workspaceIdOrType = route.value.params.typeOrId as string
    }

    let baseIdOrBaseId = base.id

    if (['base'].includes(route.value.params.typeOrId as string)) {
      baseIdOrBaseId = route.value.params.baseId as string
    }

    await getMeta(table.id as string, (route.value.params?.viewId as string) !== table.id)

    await loadViews({ tableId: table.id as string })

    const views = viewsByTable.value.get(table.id as string) ?? []
    if (openedViewsTab.value !== 'view' && views.length && views[0].id) {
      await navigateTo({
        path: `/${workspaceIdOrType}/${baseIdOrBaseId}/${table?.id}/${views[0].id}/${openedViewsTab.value}`,
        query: route.value.query,
      })
    } else
      await navigateTo({
        path: `/${workspaceIdOrType}/${baseIdOrBaseId}/${table?.id}`,
        query: route.value.query,
      })
  }

  const createTable = async () => {
    const { onTableCreate, baseId } = param
    let { sourceId } = param

    if (!(baseId in bases.value)) {
      await basesStore.loadProject(baseId)
    }

    if (!sourceId) {
      sourceId = bases.value.get(baseId)?.sources?.[0].id
      if (!sourceId) throw new Error('Source not found')
    }

    const sqlUi = await basesStore.getSqlUi(baseId, sourceId)
    const source = bases.value.get(baseId)?.sources?.find((s) => s.id === sourceId)

    if (!sqlUi) return
    const columns = sqlUi
      ?.getNewTableColumns()
      .filter((col: ColumnType) => {
        if (col.column_name === 'id' && table.columns.includes('id_ag')) {
          Object.assign(col, sqlUi?.getDataTypeForUiType({ uidt: UITypes.ID }, 'AG'))
          col.dtxp = sqlUi?.getDefaultLengthForDatatype(col.dt)
          col.dtxs = sqlUi?.getDefaultScaleForDatatype(col.dt)
          return true
        }
        return table.columns.includes(col.column_name!)
      })
      .map((column) => {
        if (!source) return column

        if (source.inflection_column !== 'camelize') {
          column.title = column.column_name
        }

        return column
      })

    try {
      const tableMeta = await $api.source.tableCreate(baseId, sourceId!, {
        ...table,
        columns,
      })
      $e('a:table:create')
      onTableCreate?.(tableMeta)
      refreshCommandPalette()

      await openTable(tableMeta)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  watch(
    () => table.title,
    (title) => {
      table.table_name = `${title}`
    },
  )

  const generateUniqueTitle = () => {
    table.title = generateTitle('Table', tables.value, 'title')
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

          // Navigate to base if no tables left or open first table
          if (tables.value.length === 0) {
            await navigateTo(
              baseUrl({
                id: base.value!.id!,
                type: 'database',
              }),
            )
          } else {
            await openTable(tables.value[0])
          }
        } catch (e: any) {
          message.error(await extractSdkResponseErrorMsg(e))
        }
      },
    })
  }

  return {
    table,
    tables,
    base,

    createTable,
    generateUniqueTitle,
    deleteTable,
    openTable,
  }
}
