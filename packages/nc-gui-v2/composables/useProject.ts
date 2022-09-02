import type { MaybeRef } from '@vueuse/core'
import { SqlUiFactory } from 'nocodb-sdk'
import type { OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import { useNuxtApp, useRoute } from '#app'
import type { ProjectMetaInfo } from '~/lib'
import type { ThemeConfig } from '@/composables/useTheme'
import { useInjectionState } from '#imports'

const [setup, use] = useInjectionState((_projectId?: MaybeRef<string>) => {
  const { $api } = useNuxtApp()
  const route = useRoute()
  const { includeM2M } = useGlobal()
  const { setTheme } = useTheme()

  const projectId = computed(() => (_projectId ? unref(_projectId) : (route.params.projectId as string)))
  const project = ref<ProjectType>({})
  const tables = ref<TableType[]>([])
  const projectRoles = useState<Record<string, boolean>>(USER_PROJECT_ROLES, () => ({}))
  const projectMetaInfo = ref<ProjectMetaInfo | undefined>()

  // todo: refactor path param name and variable name
  const projectType = $computed(() => route.params.projectType as string)

  const projectMeta = computed(() => {
    try {
      return typeof project.value.meta === 'string' ? JSON.parse(project.value.meta) : project.value.meta
    } catch (e) {
      return {}
    }
  })

  const projectBaseType = $computed(() => project.value?.bases?.[0]?.type || '')

  const sqlUi = computed(
    () => SqlUiFactory.create({ client: projectBaseType }) as Exclude<ReturnType<typeof SqlUiFactory['create']>, typeof OracleUi>,
  )

  const isMysql = computed(() => ['mysql', 'mysql2'].includes(projectBaseType))
  const isMssql = computed(() => projectBaseType === 'mssql')
  const isPg = computed(() => projectBaseType === 'pg')
  const isSharedBase = computed(() => projectType === 'base')

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
    if (projectType === 'base') {
      const baseData = await $api.public.sharedBaseGet(route.params.projectId as string)
      project.value = await $api.project.read(baseData.project_id!)
    } else if (projectId.value) {
      project.value = await $api.project.read(projectId.value)
    } else {
      return
    }
    await loadProjectRoles()
    await loadTables()
    setTheme(projectMeta.value?.theme)
  }

  async function updateProject(data: Partial<ProjectType>) {
    if (projectType === 'base') {
      return
    }
    if (data.meta && typeof data.meta === 'string') {
      await $api.project.update(projectId.value, data)
    } else {
      await $api.project.update(projectId.value, { ...data, meta: JSON.stringify(data.meta) })
    }
  }

  async function saveTheme(theme: Partial<ThemeConfig>) {
    await updateProject({
      color: theme.primaryColor,
      meta: {
        ...projectMeta.value,
        theme,
      },
    })
    setTheme(theme)
  }

  watch(
    () => route.params,
    (v) => {
      if (!v?.projectId) {
        setTheme()
      }
    },
  )

  // TODO useProject should only called inside a project for now this doesn't work
  onScopeDispose(() => {
    project.value = {}
    tables.value = []
    projectMetaInfo.value = undefined
    projectRoles.value = {}
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
}, 'useProject')

export const provideProject = setup

export function useProject(projectId?: MaybeRef<string>) {
  const state = use()

  if (!state) {
    return setup(projectId)
  }

  return state
}
