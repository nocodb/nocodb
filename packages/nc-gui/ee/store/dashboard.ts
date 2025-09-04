import { type DashboardType, PlanLimitTypes } from 'nocodb-sdk'
import { DlgDashboardCreate } from '#components'

export const useDashboardStore = defineStore('dashboard', () => {
  const { $api, $e, $poller } = useNuxtApp()

  const { ncNavigateTo } = useGlobal()

  const { showDashboardPlanLimitExceededModal, updateStatLimit } = useEeConfig()

  const { refreshCommandPalette } = useCommandPalette()

  const route = useRoute()

  const baseStore = useBases()

  const { loadProject } = baseStore

  const { activeProjectId, bases } = storeToRefs(baseStore)

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const isDashboardEnabled = computed(() => true)

  // State
  const dashboards = ref<Map<string, DashboardType[]>>(new Map())

  const sharedDashboardState = reactive({
    password: '',
    activeProjectId: null,
  })

  const isEditingDashboard = ref(false)

  const activeBaseDashboards = computed(() => {
    const id = activeProjectId.value || sharedDashboardState.activeProjectId
    if (!id) return []
    return dashboards.value.get(id) || []
  })

  const activeDashboardId = computed(() => route.params.dashboardId as string)

  const activeDashboard = computed(() => {
    const id = activeProjectId.value || sharedDashboardState.activeProjectId
    if (!id) return null
    return dashboards.value.get(id)?.find((a) => a.id === activeDashboardId.value || a.uuid === activeDashboardId.value) || null
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
      if (!dashboard) {
        dashboard = (await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
          operation: 'dashboardGet',
          id: dashboardId,
        })) as unknown as DashboardType

        const baseDashboards = dashboards.value.get(activeProjectId.value) || []
        const filtered = baseDashboards.filter((a) => a.id !== dashboardId)
        filtered.push(dashboard)
        filtered.sort((a, b) => a.order - b.order)
        dashboards.value.set(activeProjectId.value, filtered)

        return dashboard
      }
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

  const loadSharedDashboard = async (dashboardId: string, password: string) => {
    let dashboard: null | any = null
    sharedDashboardState.password = password
    dashboard = await $api.public.sharedDashboardMetaGet(dashboardId, {
      headers: {
        'xc-password': password ?? sharedDashboardState.password,
      },
    })

    const base_id = dashboard.base_id
    sharedDashboardState.activeProjectId = base_id
    const baseDashboards = dashboards.value.get(base_id) || []
    const filtered = baseDashboards.filter((a) => a.id !== dashboardId)
    filtered.push(dashboard)
    filtered.sort((a, b) => a.order - b.order)
    dashboards.value.set(base_id, filtered)

    return dashboard
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
      updateStatLimit(PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE, 1)

      const baseDashboards = dashboards.value.get(baseId) || []
      baseDashboards.push({
        ...created,
        ___is_new: true,
      } as any)
      dashboards.value.set(baseId, baseDashboards)

      await refreshCommandPalette()

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
        dashboardId: created.id,
      })
      isEditingDashboard.value = true

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
        baseDashboards[index] = updated as any
        dashboards.value.set(baseId, baseDashboards)
      }

      await refreshCommandPalette()

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

      updateStatLimit(PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE, -1)

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

      await refreshCommandPalette()

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

  const duplicateDashboard = async (baseId: string, dashboardId: string, extra: any, onProgress?: (status: string) => void) => {
    if (!activeWorkspaceId.value) return null

    try {
      const jobData = await $api.dbDashboard.duplicateDashboard(baseId, dashboardId, {
        extra,
      })

      return new Promise((resolve, reject) => {
        $poller.subscribe(
          { id: jobData.id! },
          async (data: {
            id: string
            status?: string
            data?: {
              error?: {
                message: string
              }
              message?: string
              result?: any
            }
          }) => {
            if (data.status !== 'close') {
              onProgress?.(data.status || 'processing')

              if (data.status === JobStatus.COMPLETED) {
                updateStatLimit(PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE, 1)

                // Refresh dashboards list to include the new duplicate
                await loadDashboards({ baseId, force: true })

                const duplicatedDashboard = data.data?.result
                if (duplicatedDashboard && duplicatedDashboard.id) {
                  ncNavigateTo({
                    workspaceId: activeWorkspaceId.value,
                    baseId,
                    dashboardId: duplicatedDashboard.id,
                  })
                }
                await refreshCommandPalette()

                $e('a:dashboard:duplicate')
                resolve(data.data?.result)
              } else if (data.status === JobStatus.FAILED) {
                const errorMsg = data.data?.error?.message || 'There was an error duplicating the dashboard.'
                message.error(errorMsg)
                await refreshCommandPalette()
                reject(new Error(errorMsg))
              }
            }
          },
        )
      })
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      throw e
    }
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
    if (!baseId || showDashboardPlanLimitExceededModal()) return
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

  const dashboardShare = async (
    baseId: string,
    dashboardId: string,
    shareData: {
      password?: string | null
      custom_url_path?: string | null
      uuid?: null
    } = {},
  ) => {
    if (!activeWorkspaceId.value) return

    try {
      const response = await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        {
          operation: 'dashboardShare',
        },
        {
          id: dashboardId,
          ...shareData,
        },
      )

      const baseDashboards = dashboards.value.get(baseId)
      if (baseDashboards) {
        const dashboardIndex = baseDashboards.findIndex((d) => d.id === dashboardId)
        if (dashboardIndex !== -1) {
          baseDashboards[dashboardIndex] = { ...baseDashboards[dashboardIndex], ...response }
          dashboards.value.set(baseId, [...baseDashboards])
        }
      }

      return response
    } catch (error) {
      console.error('Error with dashboard sharing:', error)
      throw error
    }
  }

  // Watch for active dashboard changes
  watch(activeDashboardId, async (dashboardId) => {
    if (!activeProjectId.value || !isDashboardEnabled.value) return
    if (dashboardId) {
      await loadDashboard(dashboardId)
    }
  })

  onMounted(async () => {
    if (!activeDashboardId.value || !activeProjectId.value || !isDashboardEnabled.value) {
      return
    }
    loadDashboard(activeDashboardId.value)
  })

  return {
    // State
    dashboards,
    activeDashboard,
    isEditingDashboard,
    sharedDashboardState,
    loadSharedDashboard,

    // Getters
    activeBaseDashboards,
    activeDashboardId,
    isDashboardEnabled,

    // Actions
    loadDashboards,
    loadDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    openDashboard,
    openNewDashboardModal,
    duplicateDashboard,
    dashboardShare,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDashboardStore, import.meta.hot))
}
