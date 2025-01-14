import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import type { SidebarTableNode } from '~/lib/types'
import { generateUniqueTitle as generateTitle } from '#imports'

export function useTableNew(param: { onTableCreate?: (tableMeta: TableType) => void; baseId: string; sourceId?: string }) {
  const table = reactive<{ title: string; table_name: string; description?: string; columns: string[]; is_hybrid: boolean }>({
    title: '',
    table_name: '',
    description: '',
    columns: SYSTEM_COLUMNS,
    is_hybrid: true,
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

  const openTable = async (table: SidebarTableNode, cmdOrCtrl = false, navigate = true) => {
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

    const navigateToTable = async () => {
      if (navigate && openedViewsTab.value === 'view') {
        await navigateTo(
          `${cmdOrCtrl ? '#' : ''}/${workspaceIdOrType}/${baseIdOrBaseId}/${table?.id}`,
          cmdOrCtrl
            ? {
                open: navigateToBlankTargetOpenOption,
              }
            : undefined,
        )
      }

      table.isViewsLoading = true

      try {
        await loadViews({ tableId: table.id as string })

        const views = viewsByTable.value.get(table.id as string) ?? []
        if (navigate && openedViewsTab.value !== 'view' && views.length && views[0].id) {
          // find the default view and navigate to it, if not found navigate to the first one
          const defaultView = views.find((v) => v.is_default) || views[0]

          await navigateTo(
            `${cmdOrCtrl ? '#' : ''}/${workspaceIdOrType}/${baseIdOrBaseId}/${table?.id}/${defaultView.id}/${
              openedViewsTab.value
            }`,
            cmdOrCtrl
              ? {
                  open: navigateToBlankTargetOpenOption,
                }
              : undefined,
          )
        }
      } catch (e) {
        console.error(e)
      } finally {
        table.isViewsLoading = false
      }
    }

    const loadTableMeta = async () => {
      table.isMetaLoading = true

      try {
        await getMeta(table.id as string)
      } catch (e) {
        console.error(e)
      } finally {
        table.isMetaLoading = false
      }
    }
    if (cmdOrCtrl) {
      await navigateToTable()
    } else {
      await Promise.all([navigateToTable(), loadTableMeta()])
    }
  }

  const createTable = async () => {
    const { onTableCreate, baseId } = param

    if (table.title) {
      table.title = table.title.trim()
    }

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
    table.title = generateTitle(t('objects.table'), tables.value, 'title')
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
