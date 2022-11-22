import type { OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vueuse/core'
import {
  ClientType,
  computed,
  createEventHook,
  ref,
  useApi,
  useGlobal,
  useInjectionState,
  useNuxtApp,
  useRoles,
  useRoute,
  useRouter,
  useTheme,
} from '#imports'
import type { ProjectMetaInfo, ThemeConfig } from '~/lib'

const [setup, use] = useInjectionState(() => {
  const { $e } = useNuxtApp()

  const { api, isLoading } = useApi()

  const route = useRoute()

  const { includeM2M } = useGlobal()

  const { setTheme, theme } = useTheme()

  const router = useRouter()

  const { projectRoles, loadProjectRoles } = useRoles()

  const projectLoadedHook = createEventHook<ProjectType>()

  const project = ref<ProjectType>({})

  const tables = ref<TableType[]>([])

  const projectMetaInfo = ref<ProjectMetaInfo | undefined>()

  const lastOpenedViewMap = ref<Record<string, string>>({})

  const projectId = computed(() => route.params.projectId as string)

  // todo: refactor path param name and variable name
  const projectType = $computed(() => route.params.projectType as string)

  const projectMeta = computed<Record<string, any>>(() => {
    try {
      return isString(project.value.meta) ? JSON.parse(project.value.meta) : project.value.meta
    } catch (e) {
      return {}
    }
  })

  const projectBaseType = $computed(() => project.value?.bases?.[0]?.type || ClientType.MYSQL)

  const sqlUi = computed(
    () => SqlUiFactory.create({ client: projectBaseType }) as Exclude<ReturnType<typeof SqlUiFactory['create']>, typeof OracleUi>,
  )

  const isMysql = computed(() => ['mysql', ClientType.MYSQL].includes(projectBaseType))
  const isMssql = computed(() => projectBaseType === 'mssql')
  const isPg = computed(() => projectBaseType === 'pg')
  const isSharedBase = computed(() => projectType === 'base')

  async function loadProjectMetaInfo(force?: boolean) {
    if (!projectMetaInfo.value || force) {
      projectMetaInfo.value = await api.project.metaGet(project.value.id!, {}, {})
    }
  }

  async function loadTables() {
    if (project.value.id) {
      const tablesResponse = await api.dbTable.list(project.value.id, {
        includeM2M: includeM2M.value,
      })

      if (tablesResponse.list) tables.value = tablesResponse.list
    }
  }

  async function loadProject(withTheme = true) {
    if (projectType === 'base') {
      try {
        const baseData = await api.public.sharedBaseGet(route.params.projectId as string)

        project.value = await api.project.read(baseData.project_id!)
      } catch (e: any) {
        if (e?.response?.status === 404) {
          return router.push('/error/404')
        }
        throw e
      }
    } else if (projectId.value) {
      project.value = await api.project.read(projectId.value)
    } else {
      console.warn('Project id not found')
      return
    }

    await loadProjectRoles(project.value.id || projectId.value, isSharedBase.value, projectId.value)

    await loadTables()

    if (withTheme) setTheme(projectMeta.value?.theme)

    return projectLoadedHook.trigger(project.value)
  }

  async function updateProject(data: Partial<ProjectType>) {
    if (projectType === 'base') {
      return
    }
    if (data.meta && typeof data.meta === 'string') {
      await api.project.update(projectId.value, data)
    } else {
      await api.project.update(projectId.value, { ...data, meta: JSON.stringify(data.meta) })
    }
  }

  async function saveTheme(_theme: Partial<ThemeConfig>) {
    const fullTheme = {
      primaryColor: theme.value.primaryColor,
      accentColor: theme.value.accentColor,
      ..._theme,
    }

    await updateProject({
      color: fullTheme.primaryColor,
      meta: {
        ...projectMeta.value,
        theme: fullTheme,
      },
    })

    setTheme(fullTheme)

    $e('c:themes:change')
  }

  const reset = () => {
    project.value = {}
    tables.value = []
    projectMetaInfo.value = undefined
    projectRoles.value = {}
    setTheme()
  }

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
    projectLoadedHook: projectLoadedHook.on,
    reset,
    isLoading,
    lastOpenedViewMap,
  }
}, 'useProject')

export const provideProject = setup

export function useProject() {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}
