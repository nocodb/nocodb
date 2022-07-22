import { SqlUiFactory } from 'nocodb-sdk'
import type { ProjectType, TableType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { useNuxtApp, useState } from '#app'
import { USER_PROJECT_ROLES } from '~/lib/constants'
import type { Role } from '~/lib/enums'

interface UseProjectProps {
  projectId?: MaybeRef<string>
  reloadOnRouteChange?: MaybeRef<boolean>
}

type ProjectRoles = Record<Role, boolean>

export default ({ projectId, reloadOnRouteChange = false }: UseProjectProps) => {
  const projectRoles = useState<ProjectRoles>(USER_PROJECT_ROLES, () => ({} as ProjectRoles))
  const project = useState<ProjectType | null>('project')
  const tables = useState<TableType[]>('tables', () => [] as TableType[])

  const { $api } = useNuxtApp()
  const route = useRoute()

  const _projectId = $computed(() => unref(projectId) ?? (route.params?.projectId as string))

  async function loadProjectRoles() {
    projectRoles.value = {} as ProjectRoles

    if (projectId) {
      const user = await $api.auth.me({ project_id: _projectId })
      projectRoles.value = user.roles
    }
  }

  async function loadTables() {
    if (projectId) {
      const tablesResponse = await $api.dbTable.list(_projectId)
      if (tablesResponse.list) tables.value = tablesResponse.list
    }
  }

  async function loadProject() {
    if (projectId) {
      project.value = await $api.project.read(_projectId)
      await loadProjectRoles()
    }
  }

  const projectBaseType = $computed(() => project.value?.bases?.[0]?.type || '')

  const isMysql = computed(() => ['mysql', 'mysql2'].includes(projectBaseType))
  const isPg = computed(() => projectBaseType === 'pg')
  const sqlUi = computed(() => SqlUiFactory.create({ client: projectBaseType }))

  watchEffect(async () => {
    if (route.params?.projectId !== _projectId && unref(reloadOnRouteChange)) {
      await loadProject()
      await loadTables()
    } else if (_projectId) {
      await loadProject()
      await loadTables()
    } else {
      project.value = null
      tables.value = []
    }
  })

  return { project, tables, loadProjectRoles, loadProject, loadTables, isMysql, isPg, sqlUi }
}
