import type { ViewTypes } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { useNuxtApp } from '#app'

export default (onViewCreate?: (viewMeta: any) => void) => {
  const view = reactive<{ title: string; type?: ViewTypes }>({
    title: '',
  })

  const { $api } = useNuxtApp()

  const createView = async () => {
    if (!sqlUi?.value) return
    const columns = sqlUi?.value?.getNewTableColumns().filter((col) => {
      if (col.column_name === 'id' && table.columns.includes('id_ag')) {
        Object.assign(col, sqlUi?.value?.getDataTypeForUiType({ uidt: UITypes.ID }, 'AG'))
        col.dtxp = sqlUi?.value?.getDefaultLengthForDatatype(col.dt)
        col.dtxs = sqlUi?.value?.getDefaultScaleForDatatype(col.dt)
        return true
      }
      return table.columns.includes(col.column_name)
    })

    const tableMeta = await $api.dbTable.create(project?.value?.id as string, {
      ...table,
      columns,
    })

    onViewCreate?.(tableMeta)
  }

  const generateUniqueTitle = () => {
    // let c = 1
    // while (tables?.value?.some((t) => t.title === `Sheet${c}`)) {
    //   c++
    // }
    // table.title = `Sheet${c}`
  }

  return { view, createView, generateUniqueTitle }
}
