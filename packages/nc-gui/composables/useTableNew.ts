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
  useCommandPalette,
  useI18n,
  useMetas,
  useNuxtApp,
  useProject,
  useTabs,
  watch,
} from '#imports'

export function useTableNew(param: { onTableCreate?: (tableMeta: TableType) => void; projectId: string; baseId?: string }) {
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

  const projectsStore = useProjects()

  const { projects } = storeToRefs(projectsStore)
  const { projectTables } = storeToRefs(useTablesStore())

  const { loadProjectTables } = useTablesStore()

  const { loadTables, projectUrl, isXcdbBase } = useProject()

  const workspaceId = computed(() => route.value.params.typeOrId as string)

  const tables = computed(() => projectTables.value.get(param.projectId) || [])
  const project = computed(() => projects.value.get(param.projectId))

  const openTable = async (table: TableType) => {
    if (!table.project_id) return

    let project = projects.value.get(table.project_id)
    if (!project) {
      await projectsStore.loadProject(table.project_id)
      await loadProjectTables(table.project_id)

      project = projects.value.get(table.project_id)
      if (!project) throw new Error('Project not found')
    }

    let workspaceIdOrType = workspaceId.value ?? 'nc'

    if (['nc', 'base'].includes(route.value.params.typeOrId as string)) {
      workspaceIdOrType = route.value.params.typeOrId as string
    }

    let projectIdOrBaseId = project.id

    if (['base'].includes(route.value.params.typeOrId as string)) {
      projectIdOrBaseId = route.value.params.projectId as string
    }

    await navigateTo({
      path: `/${workspaceIdOrType}/${projectIdOrBaseId}/${table?.id}`,
      query: route.value.query,
    })

    await getMeta(table.id as string)
  }

  const createTable = async () => {
    const { onTableCreate, projectId } = param
    let { baseId } = param

    if (!(projectId in projects.value)) {
      await projectsStore.loadProject(projectId)
    }

    if (!baseId) {
      baseId = projects.value.get(projectId)?.bases?.[0].id
      if (!baseId) throw new Error('Base not found')
    }

    const sqlUi = await projectsStore.getSqlUi(projectId, baseId)

    if (!sqlUi) return
    const columns = sqlUi?.getNewTableColumns().filter((col: ColumnType) => {
      if (col.column_name === 'id' && table.columns.includes('id_ag')) {
        Object.assign(col, sqlUi?.getDataTypeForUiType({ uidt: UITypes.ID }, 'AG'))
        col.dtxp = sqlUi?.getDefaultLengthForDatatype(col.dt)
        col.dtxs = sqlUi?.getDefaultScaleForDatatype(col.dt)
        return true
      }
      return table.columns.includes(col.column_name!)
    })

    try {
      const tableMeta = await $api.base.tableCreate(projectId, baseId!, {
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
    table.title = generateTitle('Untitled Table', tables.value, 'title')
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

          if (relationColumns?.length && !isXcdbBase(table.base_id)) {
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

          // Navigate to project if no tables left or open first table
          if (tables.value.length === 0) {
            await navigateTo(
              projectUrl({
                id: project.value!.id!,
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
    project,

    createTable,
    generateUniqueTitle,
    deleteTable,
    openTable,
  }
}
