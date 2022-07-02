import type { TableType } from 'nocodb-sdk'
import { useNuxtApp } from '#app'

export const useProject = () => {
  const { $api } = useNuxtApp()

  const project = useState<{ id?: string; title?: string }>('project', null)
  const tables = useState<Array<TableType>>('tables', null)

  const loadTables = async () => {
    const tablesResponse = await $api.dbTable.list(project?.value?.id)

    console.log(tablesResponse)
    tables.value = tablesResponse.list
  }

  const loadProject = async (projectId: string) => {
    const projectResponse = await $api.project.read(projectId)

    console.log(projectResponse)
    project.value = projectResponse
  }

  return { project, tables, loadProject, loadTables }
}
