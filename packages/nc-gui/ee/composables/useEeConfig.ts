import type { PlanFeatureTypes, PlanLimitTypes, WorkspaceType } from 'nocodb-sdk'

export const useEeConfig = createSharedComposable(() => {
  const workspaceStore = useWorkspace()

  const { activeWorkspace } = storeToRefs(workspaceStore)

  const isPaidPlan = computed(() => !!activeWorkspace.value?.payment?.subscription)

  const activePlan = computed(() => activeWorkspace.value?.payment?.plan)

  const activeSubscription = computed(() => activeWorkspace.value?.payment?.subscription)

  const getLimit = (type: PlanLimitTypes, workspace?: NcWorkspace | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    return workspace?.payment?.plan?.meta?.[type]
  }

  const getFeature = (type: PlanFeatureTypes, workspace?: NcWorkspace | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    return workspace?.payment?.plan?.meta?.[type]
  }

  return {
    getLimit,
    getFeature,
    isPaidPlan,
    activePlan,
    activeSubscription,
  }
})
