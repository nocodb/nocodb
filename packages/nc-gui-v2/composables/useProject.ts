import { SqlUiFactory } from 'nocodb-sdk'
import type { ProjectType, TableType } from 'nocodb-sdk'
import { useNuxtApp, useState } from '#app'
import { USER_PROJECT_ROLES } from '~/lib/constants'

export default () => {
  const projectRoles = useState<Record<string, boolean>>(USER_PROJECT_ROLES, () => ({}))

  const { $api } = useNuxtApp()

  const project = useState<ProjectType>('project')
  const tables = useState<TableType[]>('tables')

  const loadProjectRoles = async () => {
    projectRoles.value = {}

    if (project.value.id) {
      const user = await $api.auth.me({ project_id: project.value.id })
      projectRoles.value = user.roles
    }
  }
  const loadTables = async () => {
    if (project.value.id) {
      const tablesResponse = await $api.dbTable.list(project.value.id)
      if (tablesResponse.list) tables.value = tablesResponse.list
    }
  }

  const loadProject = async (projectId: string) => {
    project.value = await $api.project.read(projectId)
    await loadProjectRoles()
  }

  const isMysql = computed(() => ['mysql', 'mysql2'].includes(project.value?.bases?.[0]?.type || ''))
  const isPg = computed(() => project.value?.bases?.[0]?.type === 'pg')
  const sqlUi = computed(() => SqlUiFactory.create({ client: project.value?.bases?.[0]?.type || '' }))

  return { project, tables, loadProject, loadTables, isMysql, isPg, sqlUi }
}
