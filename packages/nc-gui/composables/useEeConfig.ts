import type { CloudFeaturesType } from '~/lib/types'

const eeConfigState = createGlobalState(() => {
  const cloudFeatures = ref<CloudFeaturesType[]>([])

  return { cloudFeatures }
})

export const useEeConfig = createSharedComposable(() => {
  const { cloudFeatures } = eeConfigState()

  const { appInfo } = useGlobal()

  const isOrgBilling = ref(false)

  const isSideBannerExpanded = ref(false)

  const isPaidPlan = computed(() => false)

  const activePlan = computed(() => undefined)

  const activePlanTitle = computed(() => undefined)

  const isHigherActivePlan = computed(() => false)

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

  const blockExtensions = computed(() => false)

  const blockAddNewAttachment = computed(() => false)

  const blockAddNewExternalSource = computed(() => false)

  const blockAddNewWebhook = computed(() => false)

  const isTopBannerVisible = computed(() => false)

  const blockWsImageLogoUpload = computed(() => true)

  const blockCurrentUserFilter = computed(() => false)

  const blockRowColoring = computed(() => true)

  const blockToggleFilter = computed(() => true)

  const blockPinnedFilter = computed(() => true)

  const blockCellColoring = computed(() => true)

  const blockTableAndFieldPermissions = computed(() => true)

  const blockPrivateBases = computed(() => true)

  const blockAddNewDashboard = computed(() => true)

  const blockCalendarRange = computed(() => true)

  const blockTimelineView = computed(() => true)

  const blockAddNewScript = computed(() => true)

  const showUserMayChargeAlert = computed(() => false)

  const maxAttachmentsAllowedInCell = computed(() => {
    // Keeping 50 to keep backward fallback compatibility
    return Math.max(1, +appInfo.value.ncMaxAttachmentsAllowed || 50)
  })

  const blockAiPromptField = computed(() => true)

  const blockAiButtonField = computed(() => true)

  const blockAiChat = computed(() => true)

  const blockAiIntegrations = computed(() => true)

  const blockDocAi = computed(() => true)

  const blockButtonVisibility = computed(() => true)

  const blockColourField = computed(() => true)

  const blockTeamHierarchy = computed(() => true)

  const blockTeamsManagement = computed(() => true)

  const blockAddNewTeamToWs = computed(() => true)

  const blockCardFieldHeaderVisibility = computed(() => true)

  const blockAddNewSandbox = computed(() => true)

  const blockSync = computed(() => true)

  const blockUnique = computed(() => true)

  // UUID field is EE-only — always blocked in CE
  const blockUuidField = computed(() => true)

  const blockListView = computed(() => true)

  const blockMapView = computed(() => true)

  // AutoNumber field is EE-only — always blocked in CE
  const blockAutoNumberField = computed(() => true)

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

  const showUpgradeToUseToggleFilter = (..._args: any[]) => {}

  const showUpgradeToUsePinnedFilter = (..._args: any[]) => {}

  const showUpgradeToUseCellColoring = (..._args: any[]) => {}

  const showUpgradeToUseTableAndFieldPermissions = (..._args: any[]) => {}

  const blockDocumentPermissions = computed(() => true)

  const showUpgradeToUseDocumentPermissions = (..._args: any[]) => {}

  const showUpgradeToUsePrivateBases = (..._args: any[]) => {}

  const showUpgradeToAddMoreAttachmentsInCell = (..._args: any[]) => {}

  const blockDocs = computed(() => true)

  const showUpgradeToUseDocs = (..._args: any[]) => {}

  const blockDocsInlineComments = computed(() => true)

  const blockDocsResolveComments = computed(() => true)

  const blockDocsExportPdf = computed(() => true)

  const showDashboardPlanLimitExceededModal = (..._args: any[]) => {}

  const showDocumentPagePlanLimitExceededModal = (..._args: any[]) => {}

  const showUpgradeToUseDocsInlineComments = (..._args: any[]) => {}

  const showUpgradeToUseDocsResolveComments = (..._args: any[]) => {}

  const showUpgradeToUseDocsExportPdf = (..._args: any[]) => {}

  const showScriptPlanLimitExceededModal = (..._args: any[]) => {}

  const showUpgradeToUseCalendarRange = (..._args: any[]) => {}

  const showUpgradeToUseTimelineView = (..._args: any[]) => {}

  const showUpgradeToUseAiPromptField = (..._args: any[]) => {}

  const showUpgradeToUseAiButtonField = (..._args: any[]) => {}

  const showUpgradeToUseAiChat = (..._args: any[]) => {}

  const showUpgradeToUseAiIntegrations = (..._args: any[]) => {}

  const showUpgradeToUseDocAi = (..._args: any[]) => {}

  const showUpgradeToUseButtonVisibility = (..._args: any[]) => {}

  const showUpgradeToUseColourField = (..._args: any[]) => {}

  const showUpgradeToUseTeamHierarchy = (..._args: any[]) => {}

  const showUpgradeToUseTeams = (..._args: any[]) => {}

  const showUpgradeToAddMoreTeams = (..._args: any[]) => {}

  const showUpgradeToUseSync = (..._args: any[]) => {}

  const showUpgradeToUseUnique = (..._args: any[]) => {}

  const showUpgradeToUseUuidField = (..._args: any[]) => {}

  const showUpgradeToUseAutoNumberField = (..._args: any[]) => {}

  const blockRecordTemplates = computed(() => false)

  const blockRls = computed(() => true)

  const showUpgradeToUseRecordTemplates = (..._args: any[]) => {}

  const showUpgradeToUseRls = (..._args: any[]) => {}

  const showUpgradeToDuplicateTableToOtherWs = (..._args: any[]) => {}

  const showUpgradeToDuplicateTableToOtherBase = (..._args: any[]) => {}

  const blockFormScheduling = computed(() => true)

  const showUpgradeToUseFormScheduling = (..._args: any[]) => {}

  const blockViewSections = computed(() => true)

  const showUpgradeToUseViewSections = (..._args: any[]) => {}

  const showSandboxPlanLimitExceededModal = (..._args: any[]) => {}
  const showUpgradeToUseListView = (..._args: any[]) => {}

  const showUpgradeToUseMapView = (..._args: any[]) => {}

  const blockDateDependency = computed(() => true)

  const showUpgradeToUseDateDependency = (..._args: any[]) => {}

  const showUpgradeToUseExtensions = (..._args: any[]) => {}
  const blockMfa = computed(() => true)
  const showUpgradeToUseMfa = (..._args: any[]) => {}

  const blockForce2fa = computed(() => true)
  const showUpgradeToUseForce2fa = (..._args: any[]) => {}

  const isEEFeatureBlocked = computed(() => true)

  const showEEFeatures = computed(() => false)

  const blockWorkspaceCreate = computed(() => true)

  const blockWorkspaceMembers = computed(() => false)

  const showUpgradeToCreateWorkspace = (..._args: any[]) => {}

  const showUpgradeToManageWorkspaceMembers = (..._args: any[]) => {}

  const showUpgradeForEEFeature = (..._args: any[]) => {}

  const blockSSO = computed(() => true)

  const showUpgradeToUseSSO = (..._args: any[]) => {}

  const blockScim = computed(() => true)

  const showUpgradeToUseScim = (..._args: any[]) => {}

  const blockTrashSettings = computed(() => true)

  const showUpgradeToUseTrashSettings = (..._args: any[]) => {}

  const blockSnapshots = computed(() => true)

  const showUpgradeToUseSnapshots = (..._args: any[]) => {}

  const blockCustomUrls = computed(() => true)

  const showUpgradeToUseCustomUrls = (..._args: any[]) => {}

  const blockScripts = computed(() => true)

  const showUpgradeToUseScripts = (..._args: any[]) => {}

  const blockWorkflows = computed(() => true)

  const showUpgradeToUseWorkflows = (..._args: any[]) => {}

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
    blockToggleFilter,
    showUpgradeToUseToggleFilter,
    blockPinnedFilter,
    showUpgradeToUsePinnedFilter,
    blockCellColoring,
    showUpgradeToUseCellColoring,
    blockTableAndFieldPermissions,
    showUpgradeToUseTableAndFieldPermissions,
    blockDocumentPermissions,
    showUpgradeToUseDocumentPermissions,
    blockPrivateBases,
    showUpgradeToUsePrivateBases,
    showUserMayChargeAlert,
    maxAttachmentsAllowedInCell,
    showUpgradeToAddMoreAttachmentsInCell,
    blockDocs,
    showUpgradeToUseDocs,
    blockDocsInlineComments,
    blockDocsResolveComments,
    blockDocsExportPdf,
    showDashboardPlanLimitExceededModal,
    showDocumentPagePlanLimitExceededModal,
    showUpgradeToUseDocsInlineComments,
    showUpgradeToUseDocsResolveComments,
    showUpgradeToUseDocsExportPdf,
    showScriptPlanLimitExceededModal,
    blockAddNewScript,
    blockAddNewDashboard,
    blockCalendarRange,
    showUpgradeToUseCalendarRange,
    blockTimelineView,
    showUpgradeToUseTimelineView,
    isOrgBilling,
    blockAiPromptField,
    showUpgradeToUseAiPromptField,
    blockAiButtonField,
    showUpgradeToUseAiButtonField,
    blockAiChat,
    showUpgradeToUseAiChat,
    blockAiIntegrations,
    showUpgradeToUseAiIntegrations,
    blockDocAi,
    showUpgradeToUseDocAi,
    blockButtonVisibility,
    showUpgradeToUseButtonVisibility,
    blockColourField,
    showUpgradeToUseColourField,
    blockTeamHierarchy,
    showUpgradeToUseTeamHierarchy,
    blockTeamsManagement,
    showUpgradeToUseTeams,
    blockAddNewTeamToWs,
    showUpgradeToAddMoreTeams,
    isHigherActivePlan,
    blockCardFieldHeaderVisibility,
    blockSync,
    blockRls,
    blockUnique,
    blockUuidField,
    blockAutoNumberField,
    showUpgradeToUseSync,
    showUpgradeToUseRls,
    showUpgradeToUseUnique,
    showUpgradeToUseUuidField,
    showUpgradeToUseAutoNumberField,
    showUpgradeToDuplicateTableToOtherWs,
    showUpgradeToDuplicateTableToOtherBase,
    blockAddNewSandbox,
    showSandboxPlanLimitExceededModal,
    blockRecordTemplates,
    showUpgradeToUseRecordTemplates,
    blockFormScheduling,
    showUpgradeToUseFormScheduling,
    blockViewSections,
    showUpgradeToUseViewSections,
    blockListView,
    showUpgradeToUseListView,
    blockMapView,
    showUpgradeToUseMapView,
    blockDateDependency,
    showUpgradeToUseDateDependency,
    blockExtensions,
    showUpgradeToUseExtensions,
    isEEFeatureBlocked,
    showEEFeatures,
    blockWorkspaceCreate,
    blockWorkspaceMembers,
    showUpgradeToCreateWorkspace,
    showUpgradeToManageWorkspaceMembers,
    showUpgradeForEEFeature,
    blockSSO,
    showUpgradeToUseSSO,
    blockScim,
    showUpgradeToUseScim,
    blockSnapshots,
    showUpgradeToUseSnapshots,
    blockCustomUrls,
    showUpgradeToUseCustomUrls,
    blockScripts,
    showUpgradeToUseScripts,
    blockWorkflows,
    showUpgradeToUseWorkflows,
    blockTrashSettings,
    showUpgradeToUseTrashSettings,
    blockMfa,
    showUpgradeToUseMfa,
    blockForce2fa,
    showUpgradeToUseForce2fa,
  }
})
