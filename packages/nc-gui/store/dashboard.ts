import type { DashboardType } from 'nocodb-sdk'
import { DlgDashboardCreate } from '#components'

export const useDashboardStore = defineStore('dashboard', () => {
  const { $api, $e } = useNuxtApp()

  const { ncNavigateTo } = useGlobal()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const route = useRoute()

  const baseStore = useBases()

  const { loadProject } = baseStore

  const { activeProjectId, bases } = storeToRefs(baseStore)

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const isDashboardEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.DASHBOARD))

  // State
  const dashboards = ref<Map<string, DashboardType[]>>(new Map())
  const isEditingDashboard = ref(false)

  const activeBaseDashboards = computed(() => {
    if (!activeProjectId.value) return []
    return dashboards.value.get(activeProjectId.value) || []
  })

  const activeDashboardId = computed(() => route.params.dashboardId as string)

  const activeDashboard = computed(() => {
    if (!activeDashboardId.value) return null
    return activeBaseDashboards.value.find((a) => a.id === activeDashboardId.value)
  })

  const loadDashboards = async ({ baseId, force = false }: { baseId: string; force?: boolean }) => {
    if (!isDashboardEnabled.value || !activeWorkspaceId.value) return []

    const existingDashboards = dashboards.value.get(baseId)
    if (existingDashboards && !force) {
      return existingDashboards
    }

    try {
      const response = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'dashboardList',
      })) as DashboardType[]

      dashboards.value.set(baseId, response)
      return response
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return []
    }
  }

  const loadDashboard = async (dashboardId: string) => {
    if (!activeProjectId.value || !dashboardId || !isDashboardEnabled.value || !activeWorkspaceId.value) return null

    let dashboard: null | DashboardType = null

    if (dashboards.value.get(activeProjectId.value)?.find((a) => a.id === dashboardId)) {
      dashboard = (dashboards.value.get(activeProjectId.value) ?? []).find((a) => a.id === dashboardId) || null
    }

    try {
      dashboard =
        dashboard ||
        ((await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
          operation: 'dashboardGet',
          id: dashboardId,
        })) as unknown as DashboardType)

      return dashboard
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
      })
      return null
    }
  }

  const createDashboard = async (baseId: string, dashboardData: Partial<DashboardType>) => {
    if (!activeWorkspaceId.value) return null
    try {
      const created = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'dashboardCreate',
        },
        dashboardData,
      )

      const baseDashboards = dashboards.value.get(baseId) || []
      baseDashboards.push(created as any)
      dashboards.value.set(baseId, baseDashboards)

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
        dashboardId: created.id,
      })

      return created
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
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
              dashboardId,
            },
          )

      const baseDashboards = dashboards.value.get(baseId) || []
      const index = baseDashboards.findIndex((a) => a.id === dashboardId)
      if (index !== -1) {
        baseDashboards[index] = updated as unknown as DashboardType
        dashboards.value.set(baseId, baseDashboards)
      }

      return updated
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const deleteDashboard = async (baseId: string, dashboardId: string) => {
    if (!activeWorkspaceId.value) return null
    try {
      await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'dashboardDelete',
        },
        {
          dashboardId,
        },
      )

      // Update local state
      const baseDashboards = dashboards.value.get(baseId) || []
      const filtered = baseDashboards.filter((a) => a.id !== dashboardId)
      dashboards.value.set(baseId, filtered)

      if (activeDashboardId.value === dashboardId) {
        const nextDashboard = filtered[0]
        if (nextDashboard) {
          ncNavigateTo({
            workspaceId: activeWorkspaceId.value,
            baseId: activeProjectId.value,
            dashboardId: nextDashboard.id,
          })
        }
      }

      if (!filtered.length) {
        ncNavigateTo({
          workspaceId: activeWorkspaceId.value,
          baseId: activeProjectId.value,
        })
      }

      return true
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return false
    }
  }

  const openDashboard = async (dashboard: DashboardType) => {
    if (!dashboard.base_id || !dashboard.id) return

    let base = bases.value.get(dashboard.base_id)
    if (!base) {
      await loadProject(dashboard.base_id)
      base = bases.value.get(dashboard.base_id)
      if (!base) throw new Error('Base not found')
    }

    let workspaceIdOrType = activeWorkspaceId.value
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

  async function openNewDashboardModal({
    baseId,
    e,
    loadBasesOnClose,
    scrollOnCreate,
    navigateToNewDashboard = true,
  }: {
    baseId?: string
    e?: string
    loadBasesOnClose?: boolean
    scrollOnCreate?: boolean
    navigateToNewDashboard?: boolean
  }) {
    if (!baseId) return
    const isDlgOpen = ref(true)

    const { close } = useDialog(DlgDashboardCreate, {
      'modelValue': isDlgOpen,
      'baseId': baseId,
      'onUpdate:modelValue': () => closeDialog(),
      'onCreated': async (dashboard: DashboardType) => {
        closeDialog()

        if (loadBasesOnClose) {
          await loadDashboards({ baseId, force: true })
        }

        $e(e ?? 'a:dashboard:create')

        if (!dashboard) return

        if (scrollOnCreate) {
          setTimeout(() => {
            const newDashboardDom = document.querySelector(`[data-dashboard-id="${dashboard.id}"]`)
            if (!newDashboardDom) return

            // Scroll to the script node
            newDashboardDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }, 1000)
        }

        if (navigateToNewDashboard) {
          ncNavigateTo({
            workspaceId: activeWorkspaceId.value,
            baseId,
            dashboardId: dashboard.id,
          })
        }
      },
    })

    function closeDialog() {
      isDlgOpen.value = false
      close(1000)
    }
  }

  // Watch for active dashboard changes
  watch(activeDashboardId, async (dashboardId) => {
    if (!activeProjectId.value || !isDashboardEnabled.value) return
    if (dashboardId) {
      await loadDashboard(dashboardId)
    }
  })

  return {
    // State
    dashboards,
    activeDashboard,
    isEditingDashboard,

    // Getters
    activeBaseDashboards,
    activeDashboardId,

    // Actions
    loadDashboards,
    loadDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    openDashboard,
    openNewDashboardModal,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDashboardStore, import.meta.hot))
}
