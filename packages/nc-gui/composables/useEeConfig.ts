export const useEeConfig = createSharedComposable(() => {
  const isPaidPlan = computed(() => undefined)

  const activePlan = computed(() => undefined)

  const activeSubscription = computed(() => undefined)

  const isPaymentEnabled = computed(() => undefined)

  const getLimit = (..._args: any[]) => {}

  const getFeature = (..._args: any[]) => {}

  const getHigherPlan = (..._args: any[]) => {}

  const getPlanTitle = (..._args: any[]) => {}

  const handleUpgradePlan = (..._args: any[]) => {}

  return {
    getLimit,
    getFeature,
    isPaidPlan,
    activePlan,
    activeSubscription,
    getHigherPlan,
    getPlanTitle,
    handleUpgradePlan,
    isPaymentEnabled,
  }
})
