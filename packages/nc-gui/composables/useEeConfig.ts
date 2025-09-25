import type { CloudFeaturesType } from '~/lib/types'

const eeConfigState = createGlobalState(() => {
  const cloudFeatures = ref<CloudFeaturesType[]>([])

  return { cloudFeatures }
})

export const useEeConfig = createSharedComposable(() => {
  const { cloudFeatures } = eeConfigState()

  const { appInfo } = useGlobal()

  // Helper to read boolean overrides from appInfo.eeFeatureFlags
  const ee = computed(() => appInfo.value?.eeFeatureFlags || {})
  const flagOr = (key: string, fallback: boolean) => computed(() => {
    const v = ee.value?.[key]
    return typeof v === 'boolean' ? v : fallback
  })

  const isOrgBilling = ref(false)

  const isSideBannerExpanded = ref(false)

  const isPaidPlan = computed(() => false)

  const activePlan = computed(() => undefined)

  const activePlanTitle = computed(() => undefined)

  const activeSubscription = computed(() => undefined)

  const isLoyaltyDiscountAvailable = computed(() => false)

  const isPaymentEnabled = computed(() => false)

  const blockAddNewRecord = computed(() => false)

  const isRecordLimitReached = computed(() => false)

  const gracePeriodActive = computed(() => true)

  const gracePeriodEndDate = computed(() => '')

  const isWsAuditEnabled = computed(() => false)

  const isAllowToAddExtension = computed(() => true)

  const blockAddNewExtension = computed(() => false)

  const blockAddNewAttachment = computed(() => false)

  const blockAddNewExternalSource = computed(() => false)

  const blockAddNewWebhook = computed(() => false)

  const isTopBannerVisible = computed(() => false)

  const blockWsImageLogoUpload = flagOr('blockWsImageLogoUpload', true)

  const blockCurrentUserFilter = flagOr('blockCurrentUserFilter', false)

  const blockRowColoring = flagOr('blockRowColoring', true)

  const blockTableAndFieldPermissions = flagOr('blockTableAndFieldPermissions', true)

  const blockPrivateBases = flagOr('blockPrivateBases', true)

  const blockAddNewDashboard = flagOr('blockAddNewDashboard', true)

  const blockCalendarRange = flagOr('blockCalendarRange', true)

  const blockAddNewScript = flagOr('blockAddNewScript', true)

  const showUserMayChargeAlert = computed(() => false)

  const maxAttachmentsAllowedInCell = computed(() => {
    // Keeping 50 to keep backward fallback compatibility
    return Math.max(1, +appInfo.value.ncMaxAttachmentsAllowed || 50)
  })

  const blockAiPromptField = flagOr('blockAiPromptField', true)

  const blockAiButtonField = flagOr('blockAiButtonField', true)

  const calculatePrice = (..._args: any[]) => {}

  const getLimit = (..._args: any[]) => {}

  const getStatLimit = (..._args: any[]) => {}

  const updateStatLimit = (..._args: any[]) => {}

  const getFeature = (..._args: any[]) => {
    return true
  }

  const getHigherPlan = (..._args: any[]) => {}

  const getPlanTitle = (..._args: any[]) => {}

  const navigateToBilling = (..._args: any[]) => {}

  const navigateToPricing = (..._args: any[]) => {}

  const navigateToCheckout = (..._args: any[]) => {}

  const handleUpgradePlan = (..._args: any[]) => {}

  const showUserPlanLimitExceededModal = (..._args: any[]) => {}

  const showRecordPlanLimitExceededModal = (..._args: any[]) => {}

  const showStoragePlanLimitExceededModal = (..._args: any[]) => {}

  const showExternalSourcePlanLimitExceededModal = (..._args: any[]) => {}

  const showWebhookPlanLimitExceededModal = (..._args: any[]) => {}

  const showWebhookLogsFeatureAccessModal = (..._args: any[]) => {}

  const blockExternalSourceRecordVisibility = (..._args: any[]) => {}

  const showAsBluredRecord = (..._args: any[]) => {}

  const showUpgradeToSeeMoreRecordsModal = (..._args: any[]) => {}

  const showUpgradeToUploadWsImage = (..._args: any[]) => {}

  const showUpgradeToUseCurrentUserFilter = (..._args: any[]) => {}

  const showUpgradeToUseRowColoring = (..._args: any[]) => {}

  const showUpgradeToUseTableAndFieldPermissions = (..._args: any[]) => {}

  const showUpgradeToUsePrivateBases = (..._args: any[]) => {}

  const showUpgradeToAddMoreAttachmentsInCell = (..._args: any[]) => {}

  const showDashboardPlanLimitExceededModal = (..._args: any[]) => {}

  const showScriptPlanLimitExceededModal = (..._args: any[]) => {}

  const showUpgradeToUseCalendarRange = (..._args: any[]) => {}

  const showUpgradeToUseAiPromptField = (..._args: any[]) => {}

  const showUpgradeToUseAiButtonField = (..._args: any[]) => {}

  return {
    calculatePrice,
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
    gracePeriodActive,
    blockAddNewRecord,
    showRecordPlanLimitExceededModal,
    navigateToBilling,
    isWsAuditEnabled,
    isAllowToAddExtension,
    blockAddNewExtension,
    blockAddNewAttachment,
    showStoragePlanLimitExceededModal,
    blockAddNewExternalSource,
    showExternalSourcePlanLimitExceededModal,
    blockAddNewWebhook,
    showWebhookPlanLimitExceededModal,
    showWebhookLogsFeatureAccessModal,
    blockExternalSourceRecordVisibility,
    showAsBluredRecord,
    showUpgradeToSeeMoreRecordsModal,
    navigateToPricing,
    navigateToCheckout,
    isLoyaltyDiscountAvailable,
    gracePeriodEndDate,
    isTopBannerVisible,
    showUpgradeToUploadWsImage,
    blockWsImageLogoUpload,
    isSideBannerExpanded,
    cloudFeatures,
    blockCurrentUserFilter,
    showUpgradeToUseCurrentUserFilter,
    blockRowColoring,
    showUpgradeToUseRowColoring,
    blockTableAndFieldPermissions,
    showUpgradeToUseTableAndFieldPermissions,
    blockPrivateBases,
    showUpgradeToUsePrivateBases,
    showUserMayChargeAlert,
    maxAttachmentsAllowedInCell,
    showUpgradeToAddMoreAttachmentsInCell,
    showDashboardPlanLimitExceededModal,
    showScriptPlanLimitExceededModal,
    blockAddNewScript,
    blockAddNewDashboard,
    blockCalendarRange,
    showUpgradeToUseCalendarRange,
    isOrgBilling,
    blockAiPromptField,
    showUpgradeToUseAiPromptField,
    blockAiButtonField,
    showUpgradeToUseAiButtonField,
  }
})
