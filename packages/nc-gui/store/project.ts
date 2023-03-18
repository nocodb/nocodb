import type { BaseType, OracleUi, ProjectType, TableType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vueuse/core'
import { defineStore } from 'pinia'
import {
  ClientType,
  computed,
  createEventHook,
  ref,
  useApi,
  useCommandPalette,
  useNuxtApp,
  useRoles,
  useRouter,
  useTheme,
} from '#imports'
import type { ProjectMetaInfo, ThemeConfig } from '~/lib'
import {useProjects} from "~/store/projects";

export const useProject = defineStore('projectStore', () => {
  const { $e } = useNuxtApp()

  const { api, isLoading } = useApi()

  const router = useRouter()

  const route = $(router.currentRoute)


  const { setTheme, theme } = useTheme()

  const { projectRoles, loadProjectRoles } = useRoles()

  const { refreshCommandPalette } = useCommandPalette()

  const projectLoadedHook = createEventHook<ProjectType>()


  const bases = computed<BaseType[]>(() => project.value?.bases || [])


  const projectMetaInfo = ref<ProjectMetaInfo | undefined>()

  const lastOpenedViewMap = ref<Record<string, string>>({})

  const forcedProjectId = ref<string>()

  const projectId = computed(() => forcedProjectId.value || (route.params.projectId as string))

  // todo: refactor path param name and variable name
  const projectType = $computed(() => route.params.projectType as string)


  const projectsStore = useProjects()


  // const project = ref<ProjectType>({})
  // const tables = ref<TableType[]>([])
  const project = computed<ProjectType>(() => projectsStore.projects[projectId.value] || {})
  const tables = computed<TableType[]>(() => projectsStore.projectTableList[projectId.value] || [])



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
          ReturnType<typeof SqlUiFactory['create']>,
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

  function isMssql(baseId?: string) {
    return getBaseType(baseId) === 'mssql'
  }

  function isPg(baseId?: string) {
    return getBaseType(baseId) === 'pg'
  }

  function isXcdbBase(baseId?: string) {
    return bases.value.find((base) => base.id === baseId)?.is_meta
  }

  const isSharedBase = computed(() => projectType === 'base')

  const isSharedErd = computed(() => projectType === 'ERD')

  async function loadProjectMetaInfo(force?: boolean) {
    if (!projectMetaInfo.value || force) {
      projectMetaInfo.value = await api.project.metaGet(project.value.id!, {})
    }
  }

  // todo: add force parameter
  async function loadTables(){
    if (project.value.id) {
      projectsStore.loadProjectTables(project.value.id, true)
      tables.value = projectsStore.projectTableList[project.value.id]
      //   await api.dbTable.list(project.value.id, {
      //   includeM2M: includeM2M.value,
      // })

      // if (tablesResponse.list) {
      //   tables.value = tablesResponse.list
      // }
    }
  }

  async function loadBookProject(projectId?: string) {
    if (projectId) {
      forcedProjectId.value = projectId
    }
    projectId = projectId || (route.params.projectId as string)

    if (!projectId) throw new Error('Project id not found')

    const loadProj = async () => {
      project.value = await api.project.read(projectId!)
    }

    await Promise.all([loadProj(), loadProjectRoles(projectId!)])
  }

  async function loadProject(withTheme = true, forcedId?: string) {
    if (forcedId) forcedProjectId.value = forcedId
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
      await projectsStore.loadProject(projectId.value)
      project.value = projectsStore.projects[projectId.value]//await api.project.read(projectId.value)
    } else {
      console.warn('Project id not found')
      return
    }

    if (isSharedBase.value) {
      await loadProjectRoles(project.value.id || projectId.value, {
        isSharedBase: isSharedBase.value,
        sharedBaseId: projectId.value,
      })
    } else if (isSharedErd.value) {
      await loadProjectRoles(project.value.id || projectId.value, {
        isSharedErd: isSharedErd.value,
        sharedErdId: route.params.erdUuid as string,
      })
    } else {
      await loadProjectRoles(project.value.id || projectId.value)
    }

    await loadTables()

    // if (withTheme) setTheme(projectMeta.value?.theme)

    return projectLoadedHook.trigger(project.value)
  }

  async function updateProject(data: Partial<ProjectType>) {
    if (projectType === 'base') {
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
    project.value = {}
    tables.value = []
    projectMetaInfo.value = undefined
    projectRoles.value = {}
    setTheme()
  }

  const setProject = (projectVal: ProjectType) => {
    project.value = projectVal
  }

  watch(
    () => route.params.projectType,
    (n) => {
      if (!n) reset()
    },
    { immediate: true },
  )

  return {
    project,
    bases,
    tables,
    loadProjectRoles,
    loadProject,
    updateProject,
    loadTables,
    isMysql,
    isMssql,
    isPg,
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
    loadBookProject,
    setProject,
  }
})
