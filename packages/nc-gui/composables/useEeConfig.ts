export const useEeConfig = createSharedComposable(() => {
  const isPaidPlan = computed(() => undefined)

  const activePlan = computed(() => undefined)

  const activePlanTitle = computed(() => undefined)

  const activeSubscription = computed(() => undefined)

  const isPaymentEnabled = computed(() => undefined)

  const blockAddNewRecord = computed(() => false)

  const isRecordLimitReached = computed(() => false)

  const gracePeriodDaysLeft = computed(() => Infinity)

  const isWsAuditEnabled = computed(() => false)

  const isAllowToAddExtension = computed(() => true)

  const blockAddNewAttachment = computed(() => false)

  const blockAddNewExternalSource = computed(() => false)

  const getLimit = (..._args: any[]) => {}

  const getStatLimit = (..._args: any[]) => {}

  const updateStatLimit = (..._args: any[]) => {}

  const getFeature = (..._args: any[]) => {
    return true
  }

  const getHigherPlan = (..._args: any[]) => {}

  const getPlanTitle = (..._args: any[]) => {}

  const navigateToBilling = (..._args: any[]) => {}

  const handleUpgradePlan = (..._args: any[]) => {}

  const showUserPlanLimitExceededModal = (..._args: any[]) => {}

  const showRecordPlanLimitExceededModal = (..._args: any[]) => {}

  const showStoragePlanLimitExceededModal = (..._args: any[]) => {}

  const showExternalSourcePlanLimitExceededModal = (..._args: any[]) => {}

  return {
    getLimit,
    getStatLimit,
    updateStatLimit,
    getFeature,
    isPaidPlan,
    activePlan,
    activePlanTitle,
    activeSubscription,
    getHigherPlan,
    getPlanTitle,
    handleUpgradePlan,
    isPaymentEnabled,
    showUserPlanLimitExceededModal,
    isRecordLimitReached,
    gracePeriodDaysLeft,
    blockAddNewRecord,
    showRecordPlanLimitExceededModal,
    navigateToBilling,
    isWsAuditEnabled,
    isAllowToAddExtension,
    blockAddNewAttachment,
    showStoragePlanLimitExceededModal,
    blockAddNewExternalSource,
    showExternalSourcePlanLimitExceededModal,
  }
})
