import type { BaseType, OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vue/shared'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
  ClientType,
  computed,
  createEventHook,
  ref,
  useApi,
  useCommandPalette,
  useNuxtApp,
  useProjects,
  useRoles,
  useRouter,
  useTheme,
} from '#imports'
import type { NcProject, ProjectMetaInfo, ThemeConfig } from '#imports'

export const useProject = defineStore('projectStore', () => {
  const { $e } = useNuxtApp()

  const { api, isLoading } = useApi()

  const router = useRouter()

  const route = router.currentRoute

  const { setTheme, theme } = useTheme()

  const { loadRoles } = useRoles()

  const { refreshCommandPalette } = useCommandPalette()

  const forcedProjectId = ref<string>()

  const projectId = computed(() => forcedProjectId.value || (route.value.params.projectId as string))

  const projectsStore = useProjects()

  const tablesStore = useTablesStore()

  // todo: refactor
  const sharedProject = ref<ProjectType>()

  const openedProject = computed(() => projectsStore.projects.get(projectId.value))

  // todo: new-layout
  const project = computed<NcProject>(() => projectsStore.projects.get(projectId.value) || sharedProject.value || {})
  const tables = computed<TableType[]>(() => tablesStore.projectTables.get(projectId.value) || [])

  const projectLoadedHook = createEventHook<ProjectType>()

  const bases = computed<BaseType[]>(() => project.value?.bases || [])

  const projectMetaInfo = ref<ProjectMetaInfo | undefined>()

  const lastOpenedViewMap = ref<Record<string, string>>({})

  // todo: refactor path param name and variable name
  const projectType = computed(() => route.value.params.typeOrId as string)

  const projectMeta = computed<Record<string, any>>(() => {
    const defaultMeta = {
      showNullAndEmptyInFilter: false,
    }
    try {
      return (isString(project.value.meta) ? JSON.parse(project.value.meta) : project.value.meta) ?? defaultMeta
    } catch (e) {
      return defaultMeta
    }
  })

  const sqlUis = computed(() => {
    const temp: Record<string, any> = {}
    for (const base of bases.value) {
      if (base.id) {
        temp[base.id] = SqlUiFactory.create({ client: base.type }) as Exclude<
          ReturnType<(typeof SqlUiFactory)['create']>,
          typeof OracleUi
        >
      }
    }
    return temp
  })

  function getBaseType(baseId?: string) {
    return bases.value.find((base) => base.id === baseId)?.type || ClientType.MYSQL
  }

  function isMysql(baseId?: string) {
    return ['mysql', ClientType.MYSQL].includes(getBaseType(baseId))
  }

  function isSqlite(baseId?: string) {
    return getBaseType(baseId) === ClientType.SQLITE
  }

  function isMssql(baseId?: string) {
    return getBaseType(baseId) === 'mssql'
  }

  function isPg(baseId?: string) {
    return getBaseType(baseId) === 'pg'
  }

  function isXcdbBase(baseId?: string) {
    const base = bases.value.find((base) => base.id === baseId)
    return (base?.is_meta as boolean) || (base?.is_local as boolean) || false
  }

  const isSharedBase = computed(() => projectType.value === 'base')

  const isSharedErd = computed(() => projectType.value === 'ERD')

  async function loadProjectMetaInfo(force?: boolean) {
    if (!projectMetaInfo.value || force) {
      projectMetaInfo.value = await api.project.metaGet(project.value.id!, {})
    }
  }

  // todo: add force parameter
  async function loadTables() {
    if (project.value.id) {
      await tablesStore.loadProjectTables(project.value.id, true)
      // tables.value = projectsStore.projectTableList[project.value.id]
      //   await api.dbTable.list(project.value.id, {
      //   includeM2M: includeM2M.value,
      // })

      // if (tablesResponse.list) {
      //   tables.value = tablesResponse.list
      // }
    }
  }

  async function loadProject(_withTheme = true, forcedId?: string) {
    if (forcedId) forcedProjectId.value = forcedId
    if (projectType.value === 'base') {
      try {
        const baseData = await api.public.sharedBaseGet(route.value.params.projectId as string)

        forcedProjectId.value = baseData.project_id
        sharedProject.value = await api.project.read(baseData.project_id!)
      } catch (e: any) {
        if (e?.response?.status === 404) {
          return router.push('/error/404')
        }
        throw e
      }
    } else if (projectId.value) {
      await projectsStore.loadProject(projectId.value)
      // project.value = projectsStore.projects[projectId.value] // await api.project.read(projectId.value)
    } else {
      console.warn('Project id not found')
      return
    }

    if (isSharedBase.value) {
      await loadRoles(project.value.id || projectId.value, {
        isSharedBase: isSharedBase.value,
        sharedBaseId: route.value.params.projectId as string,
      })
    } else if (isSharedErd.value) {
      await loadRoles(project.value.id || projectId.value, {
        isSharedErd: isSharedErd.value,
        sharedErdId: route.value.params.erdUuid as string,
      })
    } else {
      await loadRoles(project.value.id || projectId.value)
    }

    await loadTables()

    // if (withTheme) setTheme(projectMeta.value?.theme)

    return projectLoadedHook.trigger(project.value)
  }

  async function updateProject(data: Partial<ProjectType>) {
    if (projectType.value === 'base') {
      return
    }
    if (data.meta && typeof data.meta === 'string') {
      await api.project.update(projectId.value, data)
    } else {
      await api.project.update(projectId.value, { ...data, meta: stringifyProp(data.meta) })
    }

    refreshCommandPalette()
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

    // setTheme(fullTheme)

    $e('c:themes:change')
  }

  async function hasEmptyOrNullFilters() {
    return await api.project.hasEmptyOrNullFilters(projectId.value)
  }

  const reset = () => {
    // project.value = {}
    // tables.value = []
    projectMetaInfo.value = undefined
    setTheme()
  }

  const setProject = (projectVal: ProjectType) => {
    sharedProject.value = projectVal
  }

  const projectUrl = ({ id, type: _type, isSharedBase }: { id: string; type: 'database'; isSharedBase?: boolean }) => {
    if (isSharedBase) {
      const typeOrId = route.value.params.typeOrId as string
      const projectId = route.value.params.projectId as string

      return `/${typeOrId}/${projectId}`
    }

    return `/nc/${id}`
  }

  watch(
    () => route.value.params.projectType,
    (n) => {
      if (!n) reset()
    },
    { immediate: true },
  )

  watch(
    () => openedProject.value?.id,
    () => {
      if (!openedProject.value) return

      if (openedProject.value.isExpanded) return

      openedProject.value.isExpanded = true
    },
  )

  const navigateToProjectPage = async ({ page }: { page: 'all-table' | 'collaborator' | 'data-source' }) => {
    await router.push({
      name: 'index-typeOrId-projectId-index-index',
      params: {
        typeOrId: route.value.params.typeOrId,
        projectId: route.value.params.projectId,
      },
      query: {
        page,
      },
    })
  }

  return {
    project,
    bases,
    tables,
    loadRoles,
    loadProject,
    updateProject,
    loadTables,
    isMysql,
    isMssql,
    isPg,
    isSqlite,
    sqlUis,
    isSharedBase,
    isSharedErd,
    loadProjectMetaInfo,
    projectMetaInfo,
    projectMeta,
    saveTheme,
    projectLoadedHook: projectLoadedHook.on,
    reset,
    isLoading,
    lastOpenedViewMap,
    isXcdbBase,
    hasEmptyOrNullFilters,
    setProject,
    projectUrl,
    getBaseType,
    navigateToProjectPage,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProject as any, import.meta.hot))
}
