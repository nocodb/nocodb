import { SqlUiFactory } from 'nocodb-sdk'
import type { OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import type { MaybeRef } from '@vueuse/core'
import { useNuxtApp, useRoute, useState } from '#app'
import type { ProjectMetaInfo } from '~/lib'
import { USER_PROJECT_ROLES } from '~/lib'
import type { ThemeConfig } from '@/composables/useTheme'

export function useProject(projectId?: MaybeRef<string>) {
  const projectRoles = useState<Record<string, boolean>>(USER_PROJECT_ROLES, () => ({}))
  const { $api } = useNuxtApp()
  let _projectId = $ref('')

  const project = useState<ProjectType>('project')
  const tables = useState<TableType[]>('tables', () => [] as TableType[])
  const route = useRoute()
  const { includeM2M } = useGlobal()
  const { setTheme } = useTheme()
  const projectMetaInfo = useState<ProjectMetaInfo | undefined>('projectMetaInfo')
  // todo: refactor path param name and variable name
  const projectType = $computed(() => route.params.projectType as string)
  const isLoaded = ref(false)

  const projectBaseType = $computed(() => project.value?.bases?.[0]?.type || '')
  const isMysql = computed(() => ['mysql', 'mysql2'].includes(projectBaseType))
  const isMssql = computed(() => projectBaseType === 'mssql')
  const isPg = computed(() => projectBaseType === 'pg')
  const sqlUi = computed(
    () => SqlUiFactory.create({ client: projectBaseType }) as Exclude<ReturnType<typeof SqlUiFactory['create']>, typeof OracleUi>,
  )
  const isSharedBase = computed(() => projectType === 'base')

  const projectMeta = computed(() => {
    try {
      return typeof project.value.meta === 'string' ? JSON.parse(project.value.meta) : project.value.meta
    } catch (e) {
      return {}
    }
  })

  async function loadProjectMetaInfo(force?: boolean) {
    if (!projectMetaInfo.value || force) {
      const data = await $api.project.metaGet(project.value.id!, {}, {})
      projectMetaInfo.value = data
    }
  }

  async function loadProjectRoles() {
    projectRoles.value = {}

    if (isSharedBase.value) {
      const user = await $api.auth.me(
        {},
        {
          headers: {
            'xc-shared-base-id': route.params.projectId,
          },
        },
      )
      projectRoles.value = user.roles
    } else if (project.value.id) {
      const user = await $api.auth.me({ project_id: project.value.id })
      projectRoles.value = user.roles
    }
  }

  async function loadTables() {
    if (project.value.id) {
      const tablesResponse = await $api.dbTable.list(project.value.id, {
        includeM2M: includeM2M.value,
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
    isLoaded.value = true
    project.value = await $api.project.read(_projectId!)
    await loadProjectRoles()
    await loadTables()
    setTheme(projectMeta.value?.theme)
  }

  async function updateProject(data: Partial<ProjectType>) {
    if (unref(projectId)) {
      _projectId = unref(projectId)!
    } else if (projectType === 'base') {
      return
    } else {
      _projectId = route.params.projectId as string
    }

    await $api.project.update(_projectId, data)
  }

  async function saveTheme(theme: Partial<ThemeConfig>) {
    await updateProject({
      color: theme.primaryColor,
      meta: JSON.stringify({
        ...projectMeta.value,
        theme,
      }),
    })
    setTheme(theme)
  }

  onScopeDispose(() => {
    if (isLoaded.value === true) {
      project.value = {}
      tables.value = []
      projectMetaInfo.value = undefined
      projectRoles.value = {}
      setTheme({})
    }
  })

  return {
    project,
    tables,
    loadProjectRoles,
    loadProject,
    updateProject,
    loadTables,
    isMysql,
    isMssql,
    isPg,
    sqlUi,
    isSharedBase,
    loadProjectMetaInfo,
    projectMetaInfo,
    projectMeta,
    saveTheme,
  }
}
