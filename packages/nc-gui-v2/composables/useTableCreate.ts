import type { TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { useNuxtApp } from '#app'
import { useProject } from '#imports'

export default (onTableCreate?: (tableMeta: TableType) => void) => {
  const table = reactive<{ title: string; table_name: string; columns: Record<string, boolean> }>({
    title: '',
    table_name: '',
    columns: {
      id: true,
      title: true,
      created_at: true,
      updated_at: true,
    },
  })

  const { sqlUi, project, tables } = useProject()
  const { $api } = useNuxtApp()

  const createTable = async () => {
    if (!sqlUi?.value) return
    const columns = sqlUi?.value?.getNewTableColumns().filter((col) => {
      if (col.column_name === 'id' && table.columns.id_ag) {
        Object.assign(col, sqlUi?.value?.getDataTypeForUiType({ uidt: UITypes.ID }, 'AG'))
        col.dtxp = sqlUi?.value?.getDefaultLengthForDatatype(col.dt)
        col.dtxs = sqlUi?.value?.getDefaultScaleForDatatype(col.dt)
        return true
      }
      return !!table.columns[col.column_name]
    })

    const tableMeta = await $api.dbTable.create(project?.value?.id as string, {
      ...table,
      columns,
    })

    onTableCreate?.(tableMeta)
  }

  watch(
    () => table.title,
    (title) => {
      table.table_name = `${project?.value?.prefix || ''}${title}`
    },
  )

  const generateUniqueTitle = () => {
    let c = 1
    while (tables?.value?.some((t) => t.title === `Sheet${c}`)) {
      c++
    }
    table.title = `Sheet${c}`
  }

  return { table, createTable, generateUniqueTitle, tables, project }
}
