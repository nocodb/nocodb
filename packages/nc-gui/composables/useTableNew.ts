import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import { computed } from '@vue/reactivity'
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

export function useTableNew(param: { onTableCreate?: (tableMeta: TableType) => void; projectId: string; baseId?: string }) {
  const table = reactive<{ title: string; table_name: string; columns: string[] }>({
    title: '',
    table_name: '',
    columns: SYSTEM_COLUMNS,
  })

  const { t } = useI18n()

  const { $e, $api } = useNuxtApp()

  const { getMeta, removeMeta, metas } = useMetas()

  const { closeTab } = useTabs()

  const { refreshCommandPalette } = useCommandPalette()

  const router = useRouter()

  const route = $(router.currentRoute)

  const projectsStore = useProjects()

  const { projects, projectTableList } = storeToRefs(projectsStore)

  const workspaceId = $computed(() => route.params.workspaceId as string)

  // const projectStore = useProject()

  // const { sqlUis, project, tables } = storeToRefs(projectStore)

  // const sqlUi = computed(() => (baseId && sqlUis.value[baseId] ? sqlUis.value[baseId] : Object.values(sqlUis.value)[0]))

  const createTable = async () => {
    let { onTableCreate, projectId, baseId } = param

    if (!(projectId in projects.value)) {
      await projectsStore.loadProject(projectId)
    }

    if (!baseId) {
      baseId = projects.value[projectId]?.bases?.[0].id
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
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const tables = computed(() => projectTableList.value[param.projectId] || [])
  const project = computed(() => projects.value[param.projectId] || {})

  /*  const createTableMagic = async () => {
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
  } */

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

  const openTable = async (table: TableType) => {
    if (!table.project_id) return

    let project = projects.value[table.project_id]
    if (!project) {
      await projectsStore.loadProject(table.project_id)
      await projectsStore.loadProjectTables(table.project_id)

      project = projects.value[table.project_id]
    }

    await getMeta(table.id as string)

    const projectType = (route.params.projectType as string) || 'nc'

    await navigateTo({
      path: `/ws/${workspaceId}/${projectType}/${project.id!}/table/${table?.id}${table.title ? `/${table.title}` : ''}`,
      query: route.query,
    })
  }

  return {
    table,
    tables,
    project,

    createTable,
    // createTableMagic,
    // createSchemaMagic,
    // createSqlView,
    generateUniqueTitle,
    // tables,
    // project,
    deleteTable,
    openTable,
  }
}
