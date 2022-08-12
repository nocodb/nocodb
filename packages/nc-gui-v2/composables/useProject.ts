import { SqlUiFactory } from 'nocodb-sdk'
import type { OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { useNuxtApp, useRoute, useState } from '#app'
import { USER_PROJECT_ROLES } from '~/lib'

export function useProject(projectId?: MaybeRef<string>) {
  const projectRoles = useState<Record<string, boolean>>(USER_PROJECT_ROLES, () => ({}))
  const { $api } = useNuxtApp()
  let _projectId = $ref('')

  const project = useState<ProjectType>('project')
  const tables = useState<TableType[]>('tables', () => [] as TableType[])
  const route = useRoute()

  const projectType = $computed(() => route.params.projectType as string)

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

  async function loadProject() {
    if (unref(projectId)) {
      _projectId = unref(projectId)!
    } else if (projectType === 'base') {
      const baseData = await $api.public.sharedBaseGet(route.params.projectId as string)
      _projectId = baseData.project_id!
    } else {
      _projectId = route.params.projectId as string
    }
    project.value = await $api.project.read(_projectId!)
  }

  watchEffect(async () => {
    if (project?.value) {
      await loadProjectRoles()
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
