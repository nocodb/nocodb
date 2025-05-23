import type { DashboardType } from 'nocodb-sdk'

export const useDashboardStore = defineStore('dashboard', () => {
  const { $api } = useNuxtApp()
  const route = useRoute()
  const { ncNavigateTo } = useGlobal()
  const bases = useBases()
  const { openedProject } = storeToRefs(bases)
  const workspaceStore = useWorkspace()
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const isDashboardEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.DASHBOARD))

  // State
  const dashboards = ref<Map<string, DashboardType[]>>(new Map())
  const activeDashboard = ref<DashboardType | null>(null)
  const isLoading = ref(false)
  const isLoadingDashboard = ref(false)

  // Getters
  const isDashboardActive = computed(() => {
    return route.path.endsWith('dashboards/')
  })

  const activeBaseDashboards = computed(() => {
    if (!openedProject.value?.id) return []
    return dashboards.value.get(openedProject.value.id) || []
  })

  const activeDashboardId = computed(() => route.params.dashboardId as string)

  // Actions
  const loadDashboards = async ({ baseId, force = false }: { baseId: string; force?: boolean }) => {
    if (!isDashboardEnabled.value) return []

    if (!activeWorkspaceId.value) return []

    const exsistingDashboards = dashboards.value.get(baseId)
    if (exsistingDashboards && !force) {
      return exsistingDashboards
    }

    try {
      isLoading.value = true

      const response = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'dashboardList',
      })) as DashboardType[]

      dashboards.value.set(baseId, response)
      return response
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return []
    } finally {
      isLoading.value = false
    }
  }

  const loadDashboard = async (dashboardId: string, showLoader = true) => {
    if (!openedProject.value?.id || !activeDashboardId.value || !dashboardId || !isDashboardEnabled.value) return null

    let dashboard: null | DashboardType = null

    if (dashboards.value.get(openedProject.value.id)?.find((a) => a.id === dashboardId)) {
      dashboard = (dashboards.value.get(openedProject.value.id) ?? []).find((a) => a.id === dashboardId) || null
    }

    try {
      if (showLoader) {
        isLoadingDashboard.value = true
      }

      dashboard =
        dashboard ||
        ((await $api.internal.getOperation(activeWorkspaceId.value, openedProject.value?.id, {
          operation: 'dashboardGet',
          id: dashboardId,
        })) as unknown as DashboardType)

      if (activeDashboardId.value) {
        activeDashboard.value = dashboard
      }

      return dashboard
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return null
    } finally {
      if (showLoader) {
        isLoadingDashboard.value = false
      }
    }
  }

  const createDashboard = async (baseId: string, dashboardData: Partial<DashboardType>) => {
    if (!activeWorkspaceId.value) return null
    try {
      isLoading.value = true

      const created = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'dashboardCreate',
        },
        dashboardData,
      )

      const baseDashboards = dashboards.value.get(baseId) || []
      baseDashboards.push(created)
      dashboards.value.set(baseId, baseDashboards)

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return null
    } finally {
      isLoading.value = false
    }
  }

  const updateDashboard = async (
    baseId: string,
    dashboardId: string,
    updates: Partial<DashboardType>,
    options?: {
      skipNetworkCall?: boolean
    },
  ) => {
    if (!activeWorkspaceId.value) return null
    try {
      isLoading.value = true

      const dashboard = dashboards.value.get(baseId)?.find((a) => a.id === dashboardId)
      const updated = options?.skipNetworkCall
        ? {
            ...dashboard,
            ...updates,
          }
        : await $api.internal.postOperation(
            activeWorkspaceId.value,
            baseId,
            {
              operation: 'dashboardUpdate',
            },
            {
              ...updates,
              id: dashboardId,
            },
          )

      const baseDashboards = dashboards.value.get(baseId) || []
      const index = baseDashboards.findIndex((a) => a.id === dashboardId)
      if (index !== -1) {
        baseDashboards[index] = updated as unknown as DashboardType
        dashboards.value.set(baseId, baseDashboards)
      }

      if (activeDashboard.value?.id === dashboardId) {
        activeDashboard.value = updated as unknown as DashboardType
      }

      return updated
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return null
    } finally {
      isLoading.value = false
    }
  }

  const deleteDashboard = async (baseId: string, dashboardId: string) => {
    if (!activeWorkspaceId.value) return null
    try {
      isLoading.value = true

      await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'dashboardDelete',
        },
        {
          id: dashboardId,
        },
      )

      // Update local state
      const baseDashboards = dashboards.value.get(baseId) || []
      const filtered = baseDashboards.filter((a) => a.id !== dashboardId)
      dashboards.value.set(baseId, filtered)

      if (activeDashboard.value?.id === dashboardId) {
        activeDashboard.value = null
      }

      return true
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e))
      return false
    } finally {
      isLoading.value = false
    }
  }

  const openDashboard = async (dashboard: DashboardType) => {
    if (!dashboard.base_id || !dashboard.id) return

    const basesS = bases.bases
    const workspaceId = workspaceStore.activeWorkspaceId

    let base = basesS.get(dashboard.base_id)
    if (!base) {
      await bases.loadProject(dashboard.base_id)
      base = basesS.get(dashboard.base_id)
      if (!base) throw new Error('Base not found')
    }

    let workspaceIdOrType = workspaceId
    if (['nc', 'base'].includes(route.params.typeOrId as string)) {
      workspaceIdOrType = route.params.typeOrId as string
    }

    let baseIdOrBaseId = base.id
    if (['base'].includes(route.params.typeOrId as string)) {
      baseIdOrBaseId = route.params.baseId as string
    }

    ncNavigateTo({
      workspaceId: workspaceIdOrType,
      baseId: baseIdOrBaseId,
      dashboardId: dashboard.id,
    })
  }

  watch(isDashboardActive, async (isActive) => {
    if (!openedProject.value?.id) return
    if (isActive) {
      await loadDashboards({ baseId: openedProject.value.id })
    }
  })

  // Watch for active dashboard changes
  watch(activeDashboardId, async (dashboardId) => {
    if (!openedProject.value?.id || !isDashboardEnabled.value) return
    if (dashboardId) {
      await loadDashboard(dashboardId)
    } else {
      activeDashboard.value = null
    }
  })

  return {
    // State
    dashboards,
    activeDashboard,
    isLoading,
    isLoadingDashboard,

    // Getters
    isDashboardActive,
    activeBaseDashboards,
    activeDashboardId,

    // Actions
    loadDashboards,
    loadDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    openDashboard,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDashboardStore, import.meta.hot))
}
