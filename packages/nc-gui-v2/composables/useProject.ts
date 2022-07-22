import { SqlUiFactory } from 'nocodb-sdk'
import type { ProjectType, TableType } from 'nocodb-sdk'
import { useNuxtApp, useState } from '#app'
import { USER_PROJECT_ROLES } from '~/lib/constants'

export default (reloadOnRouteChange = false) => {
  const projectRoles = useState<Record<string, boolean>>(USER_PROJECT_ROLES, () => ({}))
  const project = useState<ProjectType | null>('project')
  const tables = useState<TableType[]>('tables', () => [] as TableType[])

  const { $api } = useNuxtApp()
  const route = useRoute()

  const projectId = $computed<string>(() => route.params?.projectId as string)

  async function loadProjectRoles() {
    projectRoles.value = {}

    if (projectId) {
      const user = await $api.auth.me({ project_id: projectId })
      projectRoles.value = user.roles
    }
  }

  async function loadTables() {
    if (projectId) {
      const tablesResponse = await $api.dbTable.list(projectId)
      if (tablesResponse.list) tables.value = tablesResponse.list
    }
  }

  async function loadProject() {
    if (projectId) {
      project.value = await $api.project.read(projectId)
      await loadProjectRoles()
    }
  }

  const projectBaseType = $computed(() => project.value?.bases?.[0]?.type || '')

  const isMysql = computed(() => ['mysql', 'mysql2'].includes(projectBaseType))
  const isPg = computed(() => projectBaseType === 'pg')
  const sqlUi = computed(() => SqlUiFactory.create({ client: projectBaseType }))

  if (reloadOnRouteChange) {
    watch(
      () => route.params?.projectId,
      async (id) => {
        if (id) {
          await loadProject()
          await loadTables()
        } else {
          project.value = null
          tables.value = []
        }
      },
      { immediate: true },
    )
  }

  return { project, tables, loadProjectRoles, loadProject, loadTables, isMysql, isPg, sqlUi }
}
