export const useEeConfig = createSharedComposable(() => {
  const isPaidPlan = computed(() => undefined)

  const activePlan = computed(() => undefined)

  const activeSubscription = computed(() => undefined)

  const getLimit = (..._args: any[]) => {}

  const getFeature = (..._args: any[]) => {}

  return {
    getLimit,
    getFeature,
    isPaidPlan,
    activePlan,
    activeSubscription,
  }
})
