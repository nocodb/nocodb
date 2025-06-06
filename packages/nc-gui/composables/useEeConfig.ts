import type { CloudFeaturesType } from '~/lib/types'

const eeConfigState = createGlobalState(() => {
  const cloudFeatures = ref<CloudFeaturesType[]>([])

  return { cloudFeatures }
})

export const useEeConfig = createSharedComposable(() => {
  const { cloudFeatures } = eeConfigState()

  const isSideBannerExpanded = ref(false)

  const isPaidPlan = computed(() => false)

  const activePlan = computed(() => undefined)

  const activePlanTitle = computed(() => undefined)

  const activeSubscription = computed(() => undefined)

  const isLoyaltyDiscountAvailable = computed(() => false)

  const isPaymentEnabled = computed(() => false)

  const blockAddNewRecord = computed(() => false)

  const isRecordLimitReached = computed(() => false)

  const gracePeriodDaysLeft = computed(() => Infinity)

  const gracePeriodEndDate = computed(() => '')

  const isWsAuditEnabled = computed(() => false)

  const isAllowToAddExtension = computed(() => true)

  const blockAddNewExtension = computed(() => false)

  const blockAddNewAttachment = computed(() => false)

  const blockAddNewExternalSource = computed(() => false)

  const blockAddNewWebhook = computed(() => false)

  const isTopBannerVisible = computed(() => false)

  const blockWsImageLogoUpload = computed(() => true)

  const blockCurrentUserFilter = computed(() => false)

  const blockCreateScheduleWebhook = computed(() => true)

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
    blockCreateScheduleWebhook,
  }
})
