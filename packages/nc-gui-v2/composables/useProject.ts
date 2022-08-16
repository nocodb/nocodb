import { SqlUiFactory } from 'nocodb-sdk'
import type { OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { useNuxtApp, useRoute, useState } from '#app'
import type { ProjectMetaInfo } from '~/lib'
import { USER_PROJECT_ROLES } from '~/lib'

export function useProject(projectId?: MaybeRef<string>) {
  const projectRoles = useState<Record<string, boolean>>(USER_PROJECT_ROLES, () => ({}))
  const { $api } = useNuxtApp()
  let _projectId = $ref('')

  const project = useState<ProjectType>('project')
  const tables = useState<TableType[]>('tables', () => [] as TableType[])
  const route = useRoute()
  const { includeM2M } = useGlobal()
  const projectMetaInfo = useState<ProjectMetaInfo | undefined>('projectMetaInfo')
  // todo: refactor path param name and variable name
  const projectType = $computed(() => route.params.projectType as string)

  async function loadProjectMetaInfo(force?: boolean) {
    if (!projectMetaInfo.value || force) {
      const data = await $api.project.metaGet(project.value.id!, {}, {})
      projectMetaInfo.value = data
    }
  }

  async function loadProjectRoles() {
    projectRoles.value = {}

    if (project.value.id) {
      const user = await $api.auth.me({ project_id: project.value.id })
      projectRoles.value = user.roles
    }
  }

  async function loadTables() {
    if (project.value.id) {
      const tablesResponse = await $api.dbTable.list(project.value.id, {
        // FIXME: type
        includeM2M: includeM2M.value || '',
      })
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
    await loadProjectRoles()
    await loadTables()
  }

  const projectBaseType = $computed(() => project.value?.bases?.[0]?.type || '')

  const isMysql = computed(() => ['mysql', 'mysql2'].includes(projectBaseType))
  const isPg = computed(() => projectBaseType === 'pg')
  const sqlUi = computed(
    () => SqlUiFactory.create({ client: projectBaseType }) as Exclude<ReturnType<typeof SqlUiFactory['create']>, typeof OracleUi>,
  )
  const isSharedBase = computed(() => projectType === 'base')

  return {
    project,
    tables,
    loadProjectRoles,
    loadProject,
    loadTables,
    isMysql,
    isPg,
    sqlUi,
    isSharedBase,
    loadProjectMetaInfo,
    projectMetaInfo,
  }
}
