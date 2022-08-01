import { SqlUiFactory } from 'nocodb-sdk'
import type { OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { useNuxtApp, useState } from '#app'
import { USER_PROJECT_ROLES } from '~/lib/constants'

export default (projectId?: MaybeRef<string>) => {
  const projectRoles = useState<Record<string, boolean>>(USER_PROJECT_ROLES, () => ({}))
  const { $api } = useNuxtApp()

  const _projectId = $computed(() => unref(projectId))

  const project = useState<ProjectType>('project')
  const tables = useState<TableType[]>('tables', () => [] as TableType[])

  async function loadProjectRoles() {
    projectRoles.value = {}

    if (project.value.id) {
      const user = await $api.auth.me({ project_id: project.value.id })
      projectRoles.value = user.roles
    }
  }

  async function loadTables() {
    if (project.value.id) {
      const tablesResponse = await $api.dbTable.list(project.value.id)
      if (tablesResponse.list) tables.value = tablesResponse.list
    }
  }

  async function loadProject(id: string) {
    project.value = await $api.project.read(id)
    await loadProjectRoles()
  }

  watchEffect(async () => {
    if (_projectId) {
      await loadProject(_projectId)
      await loadTables()
    }
  })

  const projectBaseType = $computed(() => project.value?.bases?.[0]?.type || '')

  const isMysql = computed(() => ['mysql', 'mysql2'].includes(projectBaseType))
  const isPg = computed(() => projectBaseType === 'pg')
  const sqlUi = computed(
    () => SqlUiFactory.create({ client: projectBaseType }) as Exclude<ReturnType<typeof SqlUiFactory['create']>, typeof OracleUi>,
  )

  return { project, tables, loadProjectRoles, loadProject, loadTables, isMysql, isPg, sqlUi }
}
