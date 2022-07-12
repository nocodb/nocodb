import { useNuxtApp } from '#app'

export default (onTableCreate?: (tableMeta: any) => void) => {
  const table = reactive<{ title: string; table_name: string }>({
    title: '',
    table_name: '',
  })

  const { sqlUi, project } = useProject()
  const { $api } = useNuxtApp()

  const createTable = async () => {
    if (!sqlUi?.value) return
    const columns = sqlUi?.value?.getNewTableColumns().filter((col) => {
      // if (col.column_name === "id" && newTable.columns.includes("id_ag")) {
      //   Object.assign(col, sqlUi?.value?.getDataTypeForUiType({ uidt: UITypes.ID }, "AG"));
      //
      //   col.dtxp = sqlUi?.value?.getDefaultLengthForDatatype(col.dt);
      //   col.dtxs = sqlUi?.value?.getDefaultScaleForDatatype(col.dt);
      //
      //   return true;
      // }
      // return this.nodes.newTable.columns.includes(col.column_name);
      return true
    })
    await $api.dbTable.create(project?.value?.id as string, {
      ...table,
      columns,
    })

    onTableCreate?.({})
  }

  watch(
    () => table.title,
    (title) => {
      table.table_name = `${project?.value?.prefix || ''}${title}`
    },
  )

  const generateUniqueTitle = () => {

  }

  return { table, createTable }
}
