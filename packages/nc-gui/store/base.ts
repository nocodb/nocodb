import type { BaseType, OracleUi, SourceType, TableType } from 'nocodb-sdk'
import { SqlUiFactory } from 'nocodb-sdk'
import { isString } from '@vue/shared'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useBase = defineStore('baseStore', () => {
  const { $e } = useNuxtApp()

  const { api, isLoading } = useApi()

  const router = useRouter()

  const route = router.currentRoute

  const { setTheme, theme } = useTheme()

  const { loadRoles } = useRoles()

  const { refreshCommandPalette } = useCommandPalette()

  const forcedProjectId = ref<string>()

  const baseId = computed(() => forcedProjectId.value || (route.value.params.baseId as string))

  const basesStore = useBases()

  const tablesStore = useTablesStore()

  const idUserMap = computed(() => {
    return (basesStore.basesUser.get(baseId.value) || []).reduce((acc, user) => {
      acc[user.id] = user
      acc[user.email] = user
      return acc
    }, {} as Record<string, any>)
  })

  // todo: refactor
  const sharedProject = ref<BaseType>()

  const openedProject = computed(() => basesStore.bases.get(baseId.value))

  // todo: new-layout
  const base = computed<NcProject>(() => basesStore.bases.get(baseId.value) || sharedProject.value || {})
  const tables = computed<TableType[]>(() => tablesStore.baseTables.get(baseId.value) || [])

  const baseLoadedHook = createEventHook<BaseType>()

  const sources = computed<SourceType[]>(() => base.value?.sources || [])

  const baseMetaInfo = ref<ProjectMetaInfo | undefined>()

  const lastOpenedViewMap = ref<Record<string, string>>({})

  // todo: refactor path param name and variable name
  const baseType = computed(() => route.value.params.typeOrId as string)

  const baseMeta = computed<Record<string, any>>(() => {
    const defaultMeta = {
      showNullAndEmptyInFilter: false,
    }
    try {
      return (isString(base.value.meta) ? JSON.parse(base.value.meta) : base.value.meta) ?? defaultMeta
    } catch (e) {
      return defaultMeta
    }
  })

  const sqlUis = computed(() => {
    const temp: Record<string, any> = {}
    for (const source of sources.value) {
      if (source.id) {
        temp[source.id] = SqlUiFactory.create({ client: source.type }) as Exclude<
          ReturnType<(typeof SqlUiFactory)['create']>,
          typeof OracleUi
        >
      }
    }
    return temp
  })

  function getBaseType(sourceId?: string) {
    return sources.value.find((source) => source.id === sourceId)?.type || ClientType.MYSQL
  }

  function isMysql(sourceId?: string) {
    return ['mysql', ClientType.MYSQL].includes(getBaseType(sourceId))
  }

  function isSqlite(sourceId?: string) {
    return getBaseType(sourceId) === ClientType.SQLITE
  }

  function isMssql(sourceId?: string) {
    return getBaseType(sourceId) === 'mssql'
  }

  function isPg(sourceId?: string) {
    return getBaseType(sourceId) === 'pg'
  }

  function isSnowflake(sourceId?: string) {
    return getBaseType(sourceId) === 'snowflake'
  }

  function isDatabricks(sourceId?: string) {
    return getBaseType(sourceId) === 'databricks'
  }

  function isXcdbBase(sourceId?: string) {
    const source = sources.value.find((source) => source.id === sourceId)
    return (source?.is_meta as boolean) || (source?.is_local as boolean) || false
  }

  const isSharedBase = computed(() => baseType.value === 'base')

  const isSharedErd = computed(() => baseType.value === 'ERD')

  async function loadProjectMetaInfo(force?: boolean) {
    if (!baseMetaInfo.value || force) {
      baseMetaInfo.value = await api.base.metaGet(base.value.id!, {})
    }
  }

  // todo: add force parameter
  async function loadTables() {
    if (base.value.id) {
      await tablesStore.loadProjectTables(base.value.id, true)
      // tables.value = basesStore.baseTableList[base.value.id]
      //   await api.dbTable.list(base.value.id, {
      //   includeM2M: includeM2M.value,
      // })

      // if (tablesResponse.list) {
      //   tables.value = tablesResponse.list
      // }
    }
  }

  async function loadProject(_withTheme = true, forcedId?: string) {
    if (forcedId) forcedProjectId.value = forcedId
    if (baseType.value === 'base') {
      try {
        const baseData = await api.public.sharedBaseGet(route.value.params.baseId as string)

        forcedProjectId.value = baseData.base_id
        sharedProject.value = await api.base.read(baseData.base_id!)
      } catch (e: any) {
        if (e?.response?.status === 404) {
          return router.push('/error/404')
        }
        throw e
      }
    } else if (baseId.value) {
      await basesStore.loadProject(baseId.value)
      // base.value = basesStore.bases[baseId.value] // await api.base.read(baseId.value)
    } else {
      console.warn('Base id not found')
      return
    }

    if (isSharedBase.value) {
      await loadRoles(base.value.id || baseId.value, {
        isSharedBase: isSharedBase.value,
        sharedBaseId: route.value.params.baseId as string,
      })
    } else if (isSharedErd.value) {
      await loadRoles(base.value.id || baseId.value, {
        isSharedErd: isSharedErd.value,
        sharedErdId: route.value.params.erdUuid as string,
      })
    } else {
      await loadRoles(base.value.id || baseId.value)
    }

    await loadTables()

    await basesStore.getBaseUsers({
      baseId: base.value.id || baseId.value,
    })

    // if (withTheme) setTheme(baseMeta.value?.theme)

    return baseLoadedHook.trigger(base.value)
  }

  async function updateProject(data: Partial<BaseType>) {
    if (baseType.value === 'base') {
      return
    }
    if (data.meta && typeof data.meta === 'string') {
      await api.base.update(baseId.value, data)
    } else {
      await api.base.update(baseId.value, { ...data, meta: stringifyProp(data.meta) })
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
        ...baseMeta.value,
        theme: fullTheme,
      },
    })

    // setTheme(fullTheme)

    $e('c:themes:change')
  }

  async function hasEmptyOrNullFilters() {
    return await api.base.hasEmptyOrNullFilters(baseId.value)
  }

  const reset = () => {
    // base.value = {}
    // tables.value = []
    baseMetaInfo.value = undefined
    setTheme()
  }

  const setProject = (baseVal: BaseType) => {
    sharedProject.value = baseVal
  }

  const baseUrl = ({ id, type: _type, isSharedBase }: { id: string; type: 'database'; isSharedBase?: boolean }) => {
    if (isSharedBase) {
      const typeOrId = route.value.params.typeOrId as string
      const baseId = route.value.params.baseId as string

      return `/${typeOrId}/${baseId}`
    }

    return `/nc/${id}`
  }

  watch(
    () => route.value.params.baseType,
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
      name: 'index-typeOrId-baseId-index-index',
      params: {
        typeOrId: route.value.params.typeOrId,
        baseId: route.value.params.baseId,
      },
      query: {
        page,
      },
    })
  }

  return {
    base,
    sources,
    tables,
    loadRoles,
    loadProject,
    updateProject,
    loadTables,
    isMysql,
    isMssql,
    isPg,
    isSqlite,
    isSnowflake,
    isDatabricks,
    sqlUis,
    isSharedBase,
    isSharedErd,
    loadProjectMetaInfo,
    baseMetaInfo,
    baseMeta,
    saveTheme,
    baseLoadedHook: baseLoadedHook.on,
    reset,
    isLoading,
    lastOpenedViewMap,
    isXcdbBase,
    hasEmptyOrNullFilters,
    setProject,
    baseUrl,
    getBaseType,
    navigateToProjectPage,
    idUserMap,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBase as any, import.meta.hot))
}
