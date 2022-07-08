import type { ProjectType, TableType } from 'nocodb-sdk'
import { useNuxtApp } from '#app'

export default () => {
  const { $api } = useNuxtApp()

  const project = useState<ProjectType>('project')
  const tables = useState<Array<TableType>>('tables')

  const loadTables = async () => {
    if (project.value.id) {
      const tablesResponse = await $api.dbTable.list(project.value.id)

      if (tablesResponse.list) tables.value = tablesResponse.list
    }
  }

  const loadProject = async (projectId: string) => {
    project.value = await $api.project.read(projectId)
  }

  const isMysql = computed(() => ['mysql', 'mysql2'].includes(project.value?.bases?.[0]?.type || ''))
  const isPg = computed(() => project.value?.bases?.[0]?.type === 'pg')

  return { project, tables, loadProject, loadTables, isMysql, isPg }
}
