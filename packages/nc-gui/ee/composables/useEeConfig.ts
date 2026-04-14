import type { OnPremPlanTitles, PlanLimitExceededDetailsType, ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk'
import {
  GRACE_PERIOD_DURATION,
  HigherPlan,
  LOYALTY_GRACE_PERIOD_END_DATE,
  NON_SEAT_ROLES,
  OnPremHigherPlan,
  PlanFeatureTypes,
  PlanLimitTypes,
  PlanTitles,
  getUpgradeMessage,
} from 'nocodb-sdk'
import dayjs from 'dayjs'
import NcModalConfirm, { type NcConfirmModalProps } from '../../components/nc/ModalConfirm.vue'
import { getI18n } from '~/plugins/a.i18n'

const eeConfigState = createGlobalState(() => {
  const isSideBannerExpanded = ref<boolean>(true)

  return { isSideBannerExpanded }
})

export const useEeConfig = createSharedComposable(() => {
  const { t } = getI18n().global

  // it's not possible to use inject in a shared composable we manually we have to set this value
  const isOrgBilling = ref(false)

  const { $state, $api, $e } = useNuxtApp()

  const baseURL = $api.instance.defaults.baseURL

  const { user, appInfo, isMobileMode } = useGlobal()

  const { isUIAllowed } = useRoles()

  const { org } = storeToRefs(useOrg())

  const workspaceStore = useWorkspace()

  const { activeWorkspace, activeWorkspaceId, workspaces } = storeToRefs(workspaceStore)

  const { isSideBannerExpanded } = eeConfigState()

  const { aiIntegrationAvailable } = useNocoAi()

  const cloudFeatures = ref([])

  /** Ref or Computed value */

  const isPaymentEnabled = computed(() => appInfo.value?.isCloud && !appInfo.value?.isOnPrem)

  const isOnPrem = computed(() => appInfo.value?.isOnPrem)

  /** True when running on-prem without a valid enterprise license (CE mode) */
  const isEEFeatureBlocked = computed(() => isOnPrem.value && !appInfo.value?.ee)

  /** Always true in EE build — features are visible with upgrade badges when blocked */
  const showEEFeatures = computed(() => true)

  // Will only consider ws owner not super admin
  const isWsOwner = computed(() =>
    isUIAllowed('workspaceBilling', {
      roles: user.value?.workspace_roles,
    }),
  )
  const isPaidPlan = computed(
    () =>
      (isOrgBilling.value ? !!org.value?.payment?.subscription : !!activeWorkspace.value?.payment?.subscription) ||
      appInfo.value?.isOnPrem,
  )

  const activePlan = computed(() => (isOrgBilling.value ? org.value?.payment?.plan : activeWorkspace.value?.payment?.plan))

  const activePlanTitle = computed(() => (activePlan.value?.title as PlanTitles) ?? PlanTitles.FREE)

  const isHigherActivePlan = computed(() => {
    return activePlanTitle.value === PlanTitles.ENTERPRISE
  })

  const activeSubscription = computed(() =>
    isOrgBilling.value ? org.value?.payment?.subscription : activeWorkspace.value?.payment?.subscription,
  )

  const isLoyaltyDiscountAvailable = computed(() => {
    return false

    if (!activeWorkspace.value) return false

    return activeWorkspace.value?.loyal && !activeWorkspace.value?.loyalty_discount_used
  })

  const isUnderLoyaltyCutoffDate = computed(() => {
    return dayjs().isSameOrBefore(dayjs(LOYALTY_GRACE_PERIOD_END_DATE))
  })

  const isWsAuditEnabled = computed(() => {
    if (isEEFeatureBlocked.value) return false

    return (isPaymentEnabled.value || isOnPrem.value) && getFeature(PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE)
  })

  const isRecordLimitReached = computed(() => {
    return (
      isPaymentEnabled.value &&
      getStatLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE)
    )
  })

  const isStorageLimitReached = computed(() => {
    return (
      isPaymentEnabled.value &&
      getStatLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE)
    )
  })

  const gracePeriodActive = computed(() => {
    if (!activeWorkspace.value?.grace_period_start_at || activePlan.value?.title !== PlanTitles.FREE) return false

    const start = dayjs(activeWorkspace.value.grace_period_start_at)
    // midday UK time (intentionally kept 1 hour less than backend)
    const graceEnd = start.utc().add(GRACE_PERIOD_DURATION, 'day').startOf('day').add(11, 'hour')

    return graceEnd.isAfter(dayjs())
  })

  const gracePeriodEndDate = computed(() => {
    if (!gracePeriodActive.value) return ''

    // midday UK time (intentionally kept 1 hour less than backend)
    return dayjs(activeWorkspace.value?.grace_period_start_at)
      .utc()
      .add(GRACE_PERIOD_DURATION, 'day')
      .startOf('day')
      .add(11, 'hour')
      .toISOString()
  })

  /**
   * User has to upgrade plan in order to add new records
   */
  const blockAddNewRecord = computed(() => {
    return isRecordLimitReached.value && !gracePeriodActive.value
  })

  const blockAddNewAttachment = computed(() => {
    return isStorageLimitReached.value && !gracePeriodActive.value
  })

  const isAllowToAddExtension = computed(
    () =>
      (getFeature(PlanFeatureTypes.FEATURE_EXTENSIONS) || getLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE) > 0) &&
      getStatLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE) < getLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE),
  )
  const blockAddNewExtension = computed(() => {
    return (
      isPaymentEnabled.value &&
      (getFeature(PlanFeatureTypes.FEATURE_EXTENSIONS) || getLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE) > 0) &&
      getStatLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE)
    )
  })

  const blockAddNewExternalSource = computed(() => {
    return (
      isPaymentEnabled.value &&
      getStatLimit(PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE) >=
        getLimit(PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE)
    )
  })

  const blockAddNewDashboard = computed(() => {
    return (
      isPaymentEnabled.value &&
      getStatLimit(PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE)
    )
  })

  const blockDocsInlineComments = computed(() => {
    return isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_DOCS_INLINE_COMMENTS)
  })

  const blockDocsResolveComments = computed(() => {
    return isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_COMMENT_RESOLVE)
  })

  const blockDocsExportPdf = computed(() => {
    return isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_DOCS_EXPORT_PDF)
  })

  const blockAddNewScript = computed(() => {
    return (
      isPaymentEnabled.value &&
      getStatLimit(PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE)
    )
  })

  const blockAddNewWebhook = computed(() => {
    return (
      isPaymentEnabled.value &&
      getStatLimit(PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE)
    )
  })

  const isTopBannerVisible = computed(() => {
    return isPaymentEnabled.value && !isPaidPlan.value && !isMobileMode.value
  })

  const blockWsImageLogoUpload = computed(() => {
    return isPaymentEnabled.value && !isPaidPlan.value
  })

  const blockCurrentUserFilter = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_CURRENT_USER_FILTER)
  })

  const blockRowColoring = computed(() => {
    if (isEEFeatureBlocked.value) return true
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_ROW_COLOUR)
  })

  const blockToggleFilter = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_TOGGLE_FILTER)
  })

  const blockPinnedFilter = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_PINNED_FILTER)
  })

  const blockCellColoring = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_CELL_COLOUR)
  })

  const blockCalendarRange = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_CALENDAR_RANGE)
  })

  const blockTimelineView = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_TIMELINE_VIEW)
  })

  const blockTableAndFieldPermissions = computed(() => {
    return (
      isEEFeatureBlocked.value ||
      ((isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS))
    )
  })

  const blockDocumentPermissions = computed(() => {
    return isEEFeatureBlocked.value || (isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS))
  })

  const blockPrivateBases = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_PRIVATE_BASES)
  })

  const showUserMayChargeAlert = computed(() => {
    if (!activeSubscription.value?.stripe_price_id || !activePlan.value?.prices) return false

    const pricingObject = activePlan.value.prices.find((price: any) => price.id === activeSubscription.value.stripe_price_id)

    if (!pricingObject) return false

    return (
      calculatePrice(pricingObject, getStatLimit(PlanLimitTypes.LIMIT_EDITOR) + 1, activeSubscription.value?.period) >
      calculatePrice(pricingObject, getStatLimit(PlanLimitTypes.LIMIT_EDITOR), activeSubscription.value?.period)
    )
  })

  const maxAttachmentsAllowedInCell = computed(() => {
    // Keeping 50 to keep backward fallback compatibility
    const defaultLimit = Math.max(1, +appInfo.value.ncMaxAttachmentsAllowed || 50) || 50

    if (!isPaymentEnabled.value) return defaultLimit

    return getLimit(PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL) || defaultLimit
  })

  const blockAiPromptField = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_AI_PROMPT_FIELD)
  })

  const blockAiButtonField = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_AI_BUTTON_FIELD)
  })

  const blockAiChat = computed(() => {
    if (isEEFeatureBlocked.value) return true

    // On-prem: hide AI chat entirely when no AI integrations are configured
    if (isOnPrem.value && !aiIntegrationAvailable.value) return true

    return isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_AI_CHAT)
  })

  const blockAiIntegrations = computed(() => {
    if (isEEFeatureBlocked.value) return true

    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_AI_INTEGRATIONS)
  })

  const blockDocAi = computed(() => {
    if (isEEFeatureBlocked.value) return true

    return isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_DOC_AI)
  })

  const blockButtonVisibility = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_BUTTON_VISIBILITY)
  })

  const blockColourField = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_COLOUR_FIELD)
  })

  const blockTeamHierarchy = computed(() => {
    if (isEEFeatureBlocked.value) return true

    return isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_TEAM_HIERARCHY)
  })

  const blockTeamsManagement = computed(() => {
    if (isEEFeatureBlocked.value) return true

    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT)
  })

  const blockAddNewTeamToWs = computed(() => {
    if (blockTeamsManagement.value) return true

    return (
      isPaymentEnabled.value &&
      getStatLimit(PlanLimitTypes.LIMIT_TEAM_MANAGEMENT) >= getLimit(PlanLimitTypes.LIMIT_TEAM_MANAGEMENT)
    )
  })

  const blockCardFieldHeaderVisibility = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_CARD_FIELD_HEADER_VISIBILITY)
  })

  const blockAddNewSandbox = computed(() => {
    return isPaymentEnabled.value && getLimit(PlanLimitTypes.LIMIT_SANDBOX_PER_BASE) === 0
  })

  const blockSync = computed(() => {
    return isEEFeatureBlocked.value || ((isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_SYNC))
  })

  const blockRls = computed(() => {
    return isEEFeatureBlocked.value || ((isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_RLS))
  })

  const blockUnique = computed(() => {
    return (
      isEEFeatureBlocked.value || ((isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_UNIQUE))
    )
  })

  // UUID is available on all cloud plans + self-hosted EE — never blocked in EE
  const blockUuidField = computed(() => false)

  // AutoNumber is available on all cloud plans + self-hosted EE — never blocked in EE
  const blockAutoNumberField = computed(() => false)

  const blockRecordTemplates = computed(() => {
    return (
      isEEFeatureBlocked.value ||
      ((isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_RECORD_TEMPLATES))
    )
  })

  const blockFormScheduling = computed(() => {
    return isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_FORM_SCHEDULING)
  })

  const blockViewSections = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_VIEW_SECTIONS)
  })

  const blockListView = computed(() => {
    if (isEEFeatureBlocked.value) return true

    return isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_LIST_VIEW)
  })

  const blockMapView = computed(() => {
    return isPaymentEnabled.value && !getFeature(PlanFeatureTypes.FEATURE_MAP_VIEW)
  })

  const blockDateDependency = computed(() => {
    return (isPaymentEnabled.value || isOnPrem.value) && !getFeature(PlanFeatureTypes.FEATURE_DATE_DEPENDENCY)
  })

  /** EE-only feature blocks — gated by license on self-hosted, plan-gated for licensed on-prem */
  const blockSSO = computed(() => isEEFeatureBlocked.value || (isOnPrem.value && !getFeature(PlanFeatureTypes.FEATURE_SSO)))
  const blockScim = computed(() => {
    // SCIM is on-prem enterprise only — always blocked on cloud
    if (isPaymentEnabled.value) return true
    return isEEFeatureBlocked.value
  })
  const blockSnapshots = computed(
    () => isEEFeatureBlocked.value || (isOnPrem.value && getLimit(PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE) === 0),
  )
  const blockCustomUrls = computed(() => isEEFeatureBlocked.value)
  const blockScripts = computed(() => isEEFeatureBlocked.value)
  const blockWorkflows = computed(() => isEEFeatureBlocked.value)
  const blockExtensions = computed(() => isEEFeatureBlocked.value)
  const blockWorkspaceCreate = computed(() => {
    if (isEEFeatureBlocked.value) return true

    // On-prem with workspace limit from plan meta
    if (isOnPrem.value) {
      const limit = getLimit(PlanLimitTypes.LIMIT_WORKSPACE)
      if (limit !== Infinity) {
        return workspaces.value.size >= limit
      }
    }

    return false
  })
  const blockWorkspaceMembers = computed(() => false)

  function calculatePrice(priceObj: any, seatCount: number, mode: 'year' | 'month') {
    // TODO: calculate price when tiers_mode is `volume`
    let remainingSeats = seatCount
    let total = 0
    let previousUpTo = 0

    for (const tier of priceObj.tiers) {
      const tierLimit = tier.up_to ?? Infinity
      const tierSeats = Math.min(remainingSeats, tierLimit)
      const seatsInTier = tierSeats - (previousUpTo ?? 0)

      if (seatsInTier > 0) {
        total += tier.unit_amount + (tier.flat_amount || 0)
        remainingSeats -= seatsInTier
      }

      if (tier.up_to === null || tier.up_to === 'inf' || seatCount <= tierLimit) break

      previousUpTo = tierLimit
    }

    return total / 100 / (mode === 'year' ? 12 : 1)
  }

  /** Helper functions */

  /**
   * Resolve plan meta for feature/limit lookups.
   * On cloud: reads from workspace.payment.plan.meta (per-workspace Stripe plan)
   * On on-prem: plan is instance-wide — always use appInfo.onPremPlan (not per-workspace)
   */
  function resolvePlanMeta(workspace?: NcWorkspace | null): Record<string, any> | null {
    // On-prem: instance-wide plan takes priority (workspaces don't have Stripe plans)
    if (isOnPrem.value && appInfo.value?.onPremPlan) {
      return appInfo.value.onPremPlan
    }

    // Cloud: per-workspace Stripe plan
    const ws = workspace ?? activeWorkspace.value

    if (ws && 'payment' in ws && ws.payment?.plan?.meta) {
      return ws.payment.plan.meta
    }

    return null
  }

  function getLimit(type: PlanLimitTypes, workspace?: NcWorkspace | null) {
    if (!isPaymentEnabled.value && !isOnPrem.value) return Infinity

    const meta = resolvePlanMeta(workspace)
    const limit = Number(meta?.[type] ?? Infinity)

    return limit === -1 ? Infinity : limit
  }

  function getStatLimit(type: PlanLimitTypes, workspace?: NcWorkspace | null) {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    if (type === PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE) {
      type = 'row_count'
    }

    const limit = workspace?.stats?.[type] ?? 0

    return limit === -1 ? 0 : limit
  }

  /**
   * @param type - PlanLimitTypes to update
   * @param count - Can be positive or negative
   */
  function updateStatLimit(type: PlanLimitTypes, count: number) {
    if (!activeWorkspace.value) return

    const newCount = Math.max(0, (activeWorkspace.value?.stats?.[type] ?? 0) + count)

    workspaces.value.set(activeWorkspace.value.id!, {
      ...activeWorkspace.value,
      stats: {
        ...(activeWorkspace.value?.stats || {}),
        [type]: newCount,
      },
    })
  }

  function getFeature(type: PlanFeatureTypes, workspace?: NcWorkspace | null) {
    // On-prem without license: check the Free plan meta from appInfo.onPremPlan.
    // The Free plan is default-deny — only explicitly enabled features return true.
    if (isEEFeatureBlocked.value) {
      const meta = resolvePlanMeta(workspace)
      if (!meta) return false
      const val = meta[type]
      return ncIsString(val) ? JSON.parse(val) : !!val
    }

    if (!isPaymentEnabled.value && !isOnPrem.value) return true

    const meta = resolvePlanMeta(workspace)

    // if plan details not loaded then return true to avoid blocking user
    if (!meta) return true

    return ncIsString(meta[type]) ? JSON.parse(meta[type]) : meta[type]
  }

  const getHigherPlan = (plan: string | PlanTitles | undefined = activePlanTitle.value) => {
    const planTitleValues = Object.values(PlanTitles)

    const activePlanIndex = planTitleValues.findIndex((p) => p === plan)

    // Return if plan does not exist or current plan is higher plan
    if (activePlanIndex === -1 || activePlanIndex === planTitleValues.length - 1) {
      return
    }

    return planTitleValues[activePlanIndex + 1]
  }

  const getPlanTitle = (plan: string | PlanTitles = PlanTitles.FREE) => {
    return t(`objects.paymentPlan.${plan}`, plan)
  }

  const handleRequestUpgrade = async ({
    workspaceId,
    limitOrFeature,
    showMessage = true,
  }: {
    workspaceId?: string
    limitOrFeature?: PlanLimitTypes | PlanFeatureTypes | string
    showMessage?: boolean
  }) => {
    try {
      const res = await $fetch(`/api/payment/${workspaceId ?? activeWorkspace.value?.id}/request-upgrade`, {
        baseURL,
        method: 'POST',
        headers: { 'xc-auth': $state.token.value as string },
        body: {
          limitOrFeature,
        },
      })

      if (showMessage && res === 'true') {
        message.success({
          title: t('upgrade.WorkspaceOwnerNotified'),
          content: t('upgrade.WorkspaceOwnerNotifiedSubtitle'),
        })
      } else if (res !== 'true') {
        message.error(t('upgrade.failedToSendUpgradeRequest'))
      }

      return res === 'true'
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))

      return false
    }
  }

  const navigateToBilling = ({
    workspaceId,
    redirectToWorkspace = true,
    limitOrFeature,
    isBackToBilling = false,
    triggerEvent = true,
  }: {
    workspaceId?: string
    redirectToWorkspace?: boolean
    limitOrFeature?: PlanLimitTypes | PlanFeatureTypes | string
    isBackToBilling?: boolean
    triggerEvent?: boolean
  } = {}) => {
    if (isBackToBilling) {
      triggerEvent = false
    }

    if (!isWsOwner.value) {
      // If user is not workspace owner and isBackToBilling is true, then we don't need to request upgrade
      if (isBackToBilling) return

      if (triggerEvent) {
        $e('c:payment:request-upgrade', {
          activePlan: activePlanTitle.value,
          limitOrFeature,
        })
      }

      return handleRequestUpgrade({ workspaceId, limitOrFeature })
    }

    if (triggerEvent) {
      $e('c:payment:upgrade', {
        activePlan: activePlanTitle.value,
        limitOrFeature,
      })
    }

    if (isHigherActivePlan.value) {
      // Contact sales to upgrade limit
      openContactSalesEmail()
      return
    }

    const planCtaBtnQuery = limitOrFeature === PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE ? `&activeBtn=${PlanTitles.BUSINESS}` : ''

    if (redirectToWorkspace) {
      navigateTo(`/${workspaceId ?? activeWorkspaceId.value}/billing?autoScroll=plan${planCtaBtnQuery}`)
    } else {
      navigateTo(`/account/workspace/${workspaceId ?? activeWorkspaceId.value}/settings?autoScroll=plan${planCtaBtnQuery}`)
    }
  }

  const navigateToCheckout = (
    planId: string,
    paymentMode: 'year' | 'month',
    ref?: 'pricing' | 'billing',
    workspaceId?: string,
    showPaymentMode?: boolean,
  ) => {
    const paramsObj = {
      ...(paymentMode === 'month' ? { paymentMode: 'month' } : {}),
      ...(ref === 'billing' ? { ref: 'billing' } : {}),
      ...(showPaymentMode ? { showPaymentMode: 'true' } : {}),
    }

    const params = new URLSearchParams(paramsObj)

    navigateTo(`/${workspaceId || activeWorkspaceId.value}/checkout/${planId}?${params.toString()}`)
  }

  const navigateToPricing = ({
    workspaceId,
    limitOrFeature,
    autoScroll,
    newTab = false,
    ctaPlan,
    isBackToPricing = false,
    triggerEvent = true,
    triggerContactSales = false,
  }: {
    workspaceId?: string
    autoScroll?: 'compare' | 'faq'
    limitOrFeature?: PlanLimitTypes | PlanFeatureTypes | string
    newTab?: boolean
    ctaPlan?: PlanTitles
    isBackToPricing?: boolean
    triggerEvent?: boolean
    triggerContactSales?: boolean
  } = {}) => {
    if (isBackToPricing) {
      triggerEvent = false
    }

    if (!isWsOwner.value) {
      // If user is not workspace owner and isBackToPricing is true, then we don't need to request upgrade
      if (isBackToPricing) return

      if (triggerEvent) {
        $e('c:payment:upgrade', {
          activePlan: activePlanTitle.value,
          limitOrFeature,
        })
      }

      return handleRequestUpgrade({ workspaceId, limitOrFeature })
    }

    if (triggerEvent) {
      $e('c:payment:upgrade', {
        activePlan: activePlanTitle.value,
        limitOrFeature,
      })
    }

    if (triggerContactSales && isHigherActivePlan.value) {
      // Contact sales to upgrade limit
      openContactSalesEmail()
      return
    }

    const paramsObj = {
      ...(autoScroll ? { go: autoScroll } : {}),
      ...(ctaPlan ? { activeBtn: ctaPlan } : {}),
      ...(limitOrFeature === PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE ? { activeBtn: PlanTitles.ENTERPRISE } : {}),
    }

    const searchQuery = new URLSearchParams(paramsObj).toString()

    const wsId = workspaceId || activeWorkspaceId.value
    if (!wsId) return

    const pricingPath = `/${wsId}/pricing${searchQuery ? `?${searchQuery}` : ''}`

    if (newTab) {
      window.open(pricingPath, '_blank')
      return
    }

    navigateTo(pricingPath)
  }

  const handleOnPremUpgrade = ({
    title,
    content,
    limitOrFeature,
  }: {
    title?: string
    content?: string
    limitOrFeature?: PlanLimitTypes | PlanFeatureTypes | string
  } = {}) => {
    const isOpen = ref(true)

    const upgradeMessage = limitOrFeature ? getUpgradeMessage(limitOrFeature) : ''

    const modalTitle = ref(title || t('upgrade.enterpriseFeatureTitle'))

    const modalContent = ref(
      content ||
        (upgradeMessage
          ? t('upgrade.enterpriseFeatureEnterLicense', { detail: upgradeMessage })
          : t('upgrade.enterpriseFeatureSubtitle', { feature: t('general.thisFeature') })),
    )

    const { close } = useDialog(NcModalConfirm, {
      'visible': isOpen,
      'title': modalTitle,
      'content': modalContent,
      'okText': t('upgrade.enterLicense'),
      'onOk': () => {
        toggleDialog()
        navigateTo(appInfo.value.isCloud ? '/account/license' : '/admin?tab=license')
      },
      'cancelText': t('general.close'),
      'onCancel': toggleDialog,
      'update:visible': toggleDialog,
      'showIcon': false,
      'maskClosable': true,
    })

    function toggleDialog(show = false) {
      isOpen.value = show
      close(1000)
    }

    return true
  }

  const handleOnPremLicensedUpgrade = ({
    title,
    content,
    limitOrFeature,
  }: {
    title?: string
    content?: string
    limitOrFeature?: PlanLimitTypes | PlanFeatureTypes | string
  } = {}) => {
    const isOpen = ref(true)

    const upgradeMessage = limitOrFeature ? getUpgradeMessage(limitOrFeature) : ''

    // Use OnPremHigherPlan to determine the correct next tier
    const currentTitle = activePlanTitle.value
    const higherPlan = OnPremHigherPlan[currentTitle as string]
    const higherPlanName = higherPlan ? getPlanTitle(higherPlan) : t('objects.paymentPlan.Self-hosted Enterprise')

    const modalTitle = ref(title || t('upgrade.upgradeToOnPremPlanTitle', { plan: higherPlanName }))

    const modalContent = ref(
      content ||
        (upgradeMessage
          ? t('upgrade.upgradeToOnPremPlan', { detail: upgradeMessage })
          : t('upgrade.upgradeToEnterpriseSubtitle')),
    )

    const { close } = useDialog(NcModalConfirm, {
      'visible': isOpen,
      'title': modalTitle,
      'content': modalContent,
      'okText': t('upgrade.upgradeLicense'),
      'onOk': () => {
        const instanceUrl = window.location.origin
        window.open(`${NC_CLOUD_URL}/#/account/self-hosted?instance_url=${encodeURIComponent(instanceUrl)}`, '_blank')
        toggleDialog()
      },
      'cancelText': t('general.close'),
      'onCancel': toggleDialog,
      'update:visible': toggleDialog,
      'showIcon': false,
      'maskClosable': true,
    })

    function toggleDialog(show = false) {
      isOpen.value = show
      close(1000)
    }

    return true
  }

  const handleUpgradePlan = ({
    currentPlanTitle,
    newPlanTitle,
    workspaceId,
    callback,
    redirectToWorkspace: _redirectToWorkspace = true,
    stopEventPropogation = true,
    title,
    content,
    okText,
    focusBtn: _focusBtn,
    maskClosable = true,
    keyboard = true,
    disableClose,
    requestUpgrade,
    limitOrFeature,
    isSharedFormView,
    requiredPlan,
  }: Pick<NcConfirmModalProps, 'content' | 'okText' | 'focusBtn' | 'maskClosable' | 'keyboard'> & {
    title?: string
    currentPlanTitle?: PlanTitles | OnPremPlanTitles
    newPlanTitle?: PlanTitles | OnPremPlanTitles
    workspaceId?: string
    callback?: (type: 'ok' | 'cancel') => void
    redirectToWorkspace?: boolean
    stopEventPropogation?: boolean
    disableClose?: boolean
    requestUpgrade?: boolean
    limitOrFeature?: PlanLimitTypes | PlanFeatureTypes
    isSharedFormView?: boolean
    requiredPlan?: PlanTitles
  } = {}) => {
    // On-prem without license: show license upgrade modal instead of cloud pricing
    // Don't pass content — it contains cloud-specific plan names (e.g. "Business");
    // pass limitOrFeature so handleOnPremUpgrade can generate enterprise-appropriate content
    if (isEEFeatureBlocked.value) {
      return handleOnPremUpgrade({ limitOrFeature })
    }

    // Licensed on-prem with plan-blocked feature: show upgrade license modal
    // Don't pass content — it contains cloud-specific plan names; the handler generates its own
    if (isOnPrem.value) {
      return handleOnPremLicensedUpgrade({ title, limitOrFeature })
    }

    // if already on required plan it means we hit the limit so show higher plan
    if (requiredPlan && requiredPlan === (currentPlanTitle ?? activePlanTitle.value)) {
      requiredPlan = undefined
    }

    const higherPlan = requiredPlan ?? HigherPlan[currentPlanTitle ?? activePlanTitle.value]
    if (!higherPlan) {
      return
    }

    if (!newPlanTitle) {
      newPlanTitle = higherPlan
    }

    if (!title) {
      title = t('title.upgradeToPlan', {
        plan: getPlanTitle(newPlanTitle),
      })
    }

    if (!okText) {
      okText = isWsOwner.value && !requestUpgrade ? t('general.upgrade') : t('general.requestUpgrade')
    }

    if (isSharedFormView) {
      limitOrFeature = 'as form submissions are currently blocked due to exceeding the record limit.' as PlanLimitTypes
    }

    const okBtnText = ref(okText)
    const isOpen = ref(true)

    const okProps = ref({ loading: false })

    const oldCancelClass = requestUpgrade ? '!hidden' : ''

    const okClass = ref('')

    const cancelProps = ref({ class: oldCancelClass })

    const isRequested = ref(false)

    const modalTitle = ref(title)

    const modalContent = ref(content)

    const oldSlots = {
      headerAction: () => [
        h(
          'a',
          {
            href: 'https://nocodb.com/pricing',
            target: '_blank',
            rel: 'noopener noreferrer',
            class: 'text-sm leading-6',
            onClick: (e) => {
              /**
               * If it is owner and not request upgrade, then we need to navigate to pricing page product
               * else navigate to pricing page of nocodb website
               */
              if (isWsOwner.value && !requestUpgrade) {
                e.preventDefault()
                navigateToPricing({ autoScroll: 'compare', newTab: true, ctaPlan: newPlanTitle, triggerEvent: false })
              }

              $e('c:payment:upgrade:modal:learn-more', {
                activePlan: activePlanTitle.value,
                limitOrFeature,
              })
            },
          },
          t('msg.learnMore'),
        ),
      ],
    }

    const slots = ref<Record<string, () => VNode[]>>(oldSlots)

    const { close } = useDialog(
      NcModalConfirm,
      {
        'visible': isOpen,
        'title': modalTitle,
        'content': modalContent,
        'okText': okBtnText,
        'onCancel': closeDialog,
        'cancelProps': cancelProps,
        'onOk': async () => {
          if (requestUpgrade || !isWsOwner.value) {
            if (isRequested.value) {
              modalTitle.value = title
              modalContent.value = content
              okBtnText.value = okText
              cancelProps.value.class = oldCancelClass
              slots.value = oldSlots
              isRequested.value = false

              closeDialog(!disableClose)
              callback?.('ok')
            } else {
              okProps.value.loading = true
              const res = await handleRequestUpgrade({ workspaceId, limitOrFeature, showMessage: false })
              if (!res) return

              isRequested.value = true
              okProps.value.loading = false
              modalTitle.value = isSharedFormView ? t('upgrade.formOwnerNotified') : t('upgrade.WorkspaceOwnerNotified')
              modalContent.value = isSharedFormView
                ? t('upgrade.formOwnerNotifiedSubtitle')
                : t('upgrade.WorkspaceOwnerNotifiedSubtitle')
              okBtnText.value = t('general.close')
              okClass.value = '!hidden'
              cancelProps.value.class = '!hidden'
              slots.value = {}
            }
          } else {
            navigateToPricing({ limitOrFeature, ctaPlan: newPlanTitle })
            closeDialog()
            callback?.('ok')
          }
        },
        'okClass': okClass,
        'okProps': okProps,
        'onClickCancel': () => {
          callback?.('cancel')
        },
        'update:visible': closeDialog,
        'showIcon': false,
        'maskClosable': disableClose ? false : maskClosable,
        'keyboard': disableClose ? false : keyboard,
        'stopEventPropogation': stopEventPropogation,
        'focusBtn': null,
      },
      {
        slots,
      },
    )

    function closeDialog(forceClose = false) {
      if (!forceClose && (disableClose || requestUpgrade)) return

      isOpen.value = false
      close(1000)
    }

    return true
  }

  const showUserPlanLimitExceededModal = ({
    details,
    role,
    workspaceId,
    isAdminPanel,
    callback,
  }: {
    details: PlanLimitExceededDetailsType
    role: WorkspaceUserRoles | ProjectRoles
    workspaceId?: string
    isAdminPanel?: boolean
    callback?: (type: 'ok' | 'cancel') => void
  }) => {
    if (!isPaymentEnabled.value) return

    const limitOrFeature = NON_SEAT_ROLES.includes(role) ? PlanLimitTypes.LIMIT_COMMENTER : PlanLimitTypes.LIMIT_EDITOR

    handleUpgradePlan({
      title: t('upgrade.UpgradeToInviteMore'),
      currentPlanTitle: details.plan,
      newPlanTitle: details.higherPlan,
      content: t('upgrade.UpgradeToInviteMoreSubtitle', {
        activePlan: details.plan,
        editors: getLimit(PlanLimitTypes.LIMIT_EDITOR),
        commenters: getLimit(PlanLimitTypes.LIMIT_COMMENTER),
        plan: details.higherPlan,
      }),
      workspaceId,
      redirectToWorkspace: !isAdminPanel,
      limitOrFeature,
      callback,
    })
  }

  const showRecordPlanLimitExceededModal = ({
    callback,
    focusBtn,
    isSharedFormView,
  }: Pick<NcConfirmModalProps, 'focusBtn'> & { isSharedFormView?: boolean; callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAddNewRecord.value) return

    handleUpgradePlan({
      title: isSharedFormView ? t('upgrade.upgradeToCreateMoreRecordsForm') : t('upgrade.upgradeToCreateMoreRecords'),
      content: isSharedFormView
        ? t('upgrade.upgradeToCreateMoreRecordsFormSubtitle')
        : t('upgrade.upgradeToCreateMoreRecordsSubtitle', {
            activePlan: activePlanTitle.value,
            limit: getLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE),
            plan: HigherPlan[activePlanTitle.value],
          }),
      callback,
      focusBtn,
      disableClose: isSharedFormView,
      requestUpgrade: isSharedFormView,
      isSharedFormView,
      limitOrFeature: PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
    })

    return true
  }

  const showStoragePlanLimitExceededModal = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAddNewAttachment.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToAddMoreAttachments'),
      content: t('upgrade.upgradeToAddMoreAttachmentsSubtitle', {
        activePlan: activePlanTitle.value,
        limit: `${getLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) / 1000} GB`,
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
      limitOrFeature: PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE,
    })

    return true
  }

  const showExternalSourcePlanLimitExceededModal = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAddNewExternalSource.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToAddExternalSource'),
      content: t('upgrade.upgradeToAddExternalSourceSubtitle', {
        activePlan: activePlanTitle.value,
        limit: getLimit(PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE),
        plan: activePlanTitle.value === PlanTitles.BUSINESS ? HigherPlan[activePlanTitle.value] : PlanTitles.BUSINESS,
      }),
      callback,
      limitOrFeature: PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE,
      requiredPlan: PlanTitles.BUSINESS,
    })

    return true
  }

  const showDashboardPlanLimitExceededModal = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAddNewDashboard.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToAddMoreDashboards'),
      content: t('upgrade.upgradeToAddMoreDashboardsSubtitle', {
        activePlan: activePlanTitle.value,
        limit: getLimit(PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE),
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
      limitOrFeature: PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE,
    })

    return true
  }

  const showDocumentPagePlanLimitExceededModal = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    handleUpgradePlan({
      title: t('upgrade.upgradeToAddMoreDocumentPages'),
      content: t('upgrade.upgradeToAddMoreDocumentPagesSubtitle', {
        activePlan: activePlanTitle.value,
        limit: getLimit(PlanLimitTypes.LIMIT_DOCUMENT_PAGE_PER_BASE),
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
      limitOrFeature: PlanLimitTypes.LIMIT_DOCUMENT_PAGE_PER_BASE,
    })

    return true
  }

  const showUpgradeToUseDocsInlineComments = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockDocsInlineComments.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseDocsInlineComments'),
      content: t('upgrade.upgradeToUseDocsInlineCommentsSubtitle', {
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_DOCS_INLINE_COMMENTS,
    })

    return true
  }

  const showUpgradeToUseDocsResolveComments = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockDocsResolveComments.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseDocsResolveComments'),
      content: t('upgrade.upgradeToUseDocsResolveCommentsSubtitle', {
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_COMMENT_RESOLVE,
    })

    return true
  }

  const showUpgradeToUseDocsExportPdf = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockDocsExportPdf.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseDocsExportPdf'),
      content: t('upgrade.upgradeToUseDocsExportPdfSubtitle', {
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_DOCS_EXPORT_PDF,
    })

    return true
  }

  const showScriptPlanLimitExceededModal = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAddNewScript.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToAddMoreScripts'),
      content: t('upgrade.upgradeToAddMoreScriptsSubtitle', {
        activePlan: activePlanTitle.value,
        limit: getLimit(PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE),
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
      limitOrFeature: PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE,
    })

    return true
  }

  const showWebhookPlanLimitExceededModal = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAddNewWebhook.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToAddWebhook'),
      content: t('upgrade.upgradeToAddWebhookSubtitle', {
        activePlan: activePlanTitle.value,
        limit: getLimit(PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE),
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
      limitOrFeature: PlanLimitTypes.LIMIT_WEBHOOK_PER_TABLE,
    })

    return true
  }

  const showWebhookLogsFeatureAccessModal = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!isPaymentEnabled.value || activePlanTitle.value !== PlanTitles.FREE) return

    handleUpgradePlan({
      content: t('upgrade.upgradeToAccessWebhookLogsSubtitle', {
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
      limitOrFeature: 'to access webhook logs' as PlanLimitTypes,
    })

    return true
  }

  const blockExternalSourceRecordVisibility = (isExternalSource: boolean = false) => {
    const loyaltyUserValidation = isLoyaltyDiscountAvailable.value ? !isUnderLoyaltyCutoffDate.value : true
    return (
      isPaymentEnabled.value &&
      isExternalSource &&
      [PlanTitles.FREE, PlanTitles.PLUS].includes(activePlanTitle.value) &&
      loyaltyUserValidation
    )
  }

  const showAsBluredRecord = (isExternalSource: boolean = false, rowIndex?: number) => {
    if (!rowIndex) return false

    return blockExternalSourceRecordVisibility(isExternalSource) && rowIndex > EXTERNAL_SOURCE_VISIBLE_ROWS
  }

  const showUpgradeToSeeMoreRecordsModal = ({
    isExternalSource,
    callback,
  }: { isExternalSource?: boolean; callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockExternalSourceRecordVisibility(isExternalSource)) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToSeeMoreRecord'),
      content: t('upgrade.upgradeToSeeMoreRecordSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      maskClosable: false,
      keyboard: false,
      limitOrFeature: PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE,
      requiredPlan: PlanTitles.BUSINESS,
    })

    return true
  }

  const showUpgradeToUploadWsImage = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockWsImageLogoUpload.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUploadWsImage'),
      content: t('upgrade.upgradeToUploadWsImageSubtitle', {
        activePlan: activePlanTitle.value,
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO,
    })

    return true
  }

  const showUpgradeToUseCurrentUserFilter = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockCurrentUserFilter.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseCurrentUserFilter'),
      content: t('upgrade.upgradeToUseCurrentUserFilterSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      requiredPlan: PlanTitles.BUSINESS,
      limitOrFeature: PlanFeatureTypes.FEATURE_CURRENT_USER_FILTER,
    })

    return true
  }

  const showUpgradeToUseCalendarRange = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockCalendarRange.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseCalendarRange'),
      content: t('upgrade.upgradeToUseCalendarRangeSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      requiredPlan: PlanTitles.PLUS,
      limitOrFeature: PlanFeatureTypes.FEATURE_CALENDAR_RANGE,
    })

    return true
  }

  const showUpgradeToUseTimelineView = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockTimelineView.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseTimelineView'),
      content: t('upgrade.upgradeToUseTimelineViewSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      requiredPlan: PlanTitles.BUSINESS,
      limitOrFeature: PlanFeatureTypes.FEATURE_TIMELINE_VIEW,
    })

    return true
  }

  const showUpgradeToUseRowColoring = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockRowColoring.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseRowColoring'),
      content: t('upgrade.upgradeToUseRowColoringSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_ROW_COLOUR,
    })

    return true
  }

  const showUpgradeToUseToggleFilter = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockToggleFilter.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseToggleFilter'),
      content: t('upgrade.upgradeToUseToggleFilterSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      requiredPlan: PlanTitles.PLUS,
      limitOrFeature: PlanFeatureTypes.FEATURE_TOGGLE_FILTER,
    })

    return true
  }

  const showUpgradeToUsePinnedFilter = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockPinnedFilter.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUsePinnedFilter'),
      content: t('upgrade.upgradeToUsePinnedFilterSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      requiredPlan: PlanTitles.PLUS,
      limitOrFeature: PlanFeatureTypes.FEATURE_PINNED_FILTER,
    })

    return true
  }

  const showUpgradeToUseCellColoring = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockCellColoring.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseCellColoring'),
      content: t('upgrade.upgradeToUseCellColoringSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      newPlanTitle: PlanTitles.BUSINESS,
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_CELL_COLOUR,
    })

    return true
  }

  const showUpgradeToUseTableAndFieldPermissions = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockTableAndFieldPermissions.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseTableAndFieldPermissions'),
      content: t('upgrade.upgradeToUseTableAndFieldPermissionsSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS,
    })

    return true
  }

  const showUpgradeToUseDocumentPermissions = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockDocumentPermissions.value) return

    if (isEEFeatureBlocked.value) {
      handleOnPremUpgrade({
        limitOrFeature: PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS,
      })
    } else {
      handleUpgradePlan({
        title: t('upgrade.upgradeToUseDocumentPermissions'),
        content: t('upgrade.upgradeToUseDocumentPermissionsSubtitle', {
          plan: PlanTitles.BUSINESS,
        }),
        newPlanTitle: PlanTitles.BUSINESS,
        callback,
        limitOrFeature: PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS,
      })
    }

    return true
  }

  const showUpgradeToDuplicateTableToOtherWs = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    handleUpgradePlan({
      title: t('upgrade.upgradeToDuplicateTableToOtherWs'),
      content: t('upgrade.upgradeToDuplicateTableToOtherWs', {
        plan: PlanTitles.ENTERPRISE,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_WS,
    })

    return true
  }

  const showUpgradeToDuplicateTableToOtherBase = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    handleUpgradePlan({
      title: t('upgrade.upgradeToDuplicateTableToOtherBase'),
      content: t('upgrade.upgradeToDuplicateTableToOtherBase', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE,
    })

    return true
  }

  const showUpgradeToUsePrivateBases = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockPrivateBases.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUsePrivateBases'),
      content: t('upgrade.upgradeToUsePrivateBasesSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      requiredPlan: PlanTitles.BUSINESS,
      limitOrFeature: PlanFeatureTypes.FEATURE_PRIVATE_BASES,
    })

    return true
  }

  const getIsAttachmentsInCellLimitReached = (totalAttachments: number) => {
    return totalAttachments > maxAttachmentsAllowedInCell.value
  }

  const showUpgradeToAddMoreAttachmentsInCell = ({
    callback,
    totalAttachments,
    forceShowToastMessage = false,
    avoidShowError = false,
  }: {
    callback?: (type: 'ok' | 'cancel') => void
    totalAttachments: number
    /**
     * This is useful when we copy pasting in multiple cells
     */
    forceShowToastMessage?: boolean
    /**
     * avoidShowError is used to avoid multiple error messages for same column cell
     */
    avoidShowError?: boolean
  }) => {
    if (!getIsAttachmentsInCellLimitReached(totalAttachments)) return

    // If avoidShowError is true, then we just need to return true
    if (avoidShowError) return true

    // All paid plan has same limit so just show toast message
    // Or if payment is not enabled then show toast message
    if (activePlanTitle.value !== PlanTitles.FREE || !isPaymentEnabled.value || forceShowToastMessage) {
      message.error({
        ...(activePlanTitle.value === PlanTitles.FREE
          ? {
              title: t('title.upgradeToPlan', {
                plan: PlanTitles.PLUS,
              }),
            }
          : {}),

        content: `You can only upload at most ${maxAttachmentsAllowedInCell.value} file${
          maxAttachmentsAllowedInCell.value > 1 ? 's' : ''
        } to this cell.`,
      })

      return true
    }

    // If active plan is free then show upgrade to higher plan modal
    handleUpgradePlan({
      content: t('upgrade.upgradeToAddMoreAttachmentsInCellSubtitle', {
        plan: PlanTitles.PLUS,
        limit: maxAttachmentsAllowedInCell.value,
        filePlural: maxAttachmentsAllowedInCell.value === 1 ? t('objects.file') : t('objects.files'),
      }),
      callback,
      limitOrFeature: PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL,
    })

    return true
  }

  const showUpgradeToUseAiPromptField = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAiPromptField.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseAiTextField'),
      content: t('upgrade.upgradeToUseAiTextFieldSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_AI_PROMPT_FIELD,
    })

    return true
  }

  const showUpgradeToUseAiButtonField = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAiButtonField.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseAiButtonField'),
      content: t('upgrade.upgradeToUseAiButtonFieldSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_AI_PROMPT_FIELD,
    })

    return true
  }

  const showUpgradeToUseAiChat = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAiChat.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseAiChat'),
      content: t('upgrade.upgradeToUseAiChatSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_AI_CHAT,
    })

    return true
  }

  const showUpgradeToUseAiIntegrations = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAiIntegrations.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseAiIntegrations'),
      content: t('upgrade.upgradeToUseAiIntegrationsSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_AI_INTEGRATIONS,
    })

    return true
  }

  const showUpgradeToUseDocAi = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockDocAi.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseDocAi'),
      content: t('upgrade.upgradeToUseDocAiSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_DOC_AI,
    })

    return true
  }

  const showUpgradeToUseButtonVisibility = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockButtonVisibility.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseButtonVisibility'),
      content: t('upgrade.upgradeToUseButtonVisibilitySubtitle', {
        plan: PlanTitles.PLUS,
      }),
      limitOrFeature: PlanFeatureTypes.FEATURE_BUTTON_VISIBILITY,
      callback,
    })

    return true
  }

  const showUpgradeToUseColourField = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockColourField.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseColourField'),
      content: t('upgrade.upgradeToUseColourFieldSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_COLOUR_FIELD,
    })

    return true
  }

  const showUpgradeToUseTeamHierarchy = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockTeamHierarchy.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseTeamHierarchy'),
      content: t('upgrade.upgradeToUseTeamHierarchySubtitle', {
        plan: PlanTitles.ENTERPRISE,
      }),
      callback,
      requiredPlan: PlanTitles.ENTERPRISE,
      limitOrFeature: PlanFeatureTypes.FEATURE_TEAM_HIERARCHY,
    })

    return true
  }

  const showUpgradeToUseTeams = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockTeamsManagement.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseTeams'),
      content: t('upgrade.upgradeToUseTeamsSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
      requiredPlan: PlanTitles.BUSINESS,
    })

    return true
  }

  const showUpgradeToAddMoreTeams = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockAddNewTeamToWs.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToAddMoreTeams'),
      content: t('upgrade.upgradeToAddMoreTeamsSubtitle', {
        plan: getHigherPlan(),
      }),
      callback,
      limitOrFeature: PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
    })

    return true
  }
  const showUpgradeToUseUnique = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockUnique.value) {
      successCallback?.()
      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToEnableUnique'),
      content: t('upgrade.upgradeToEnableUniqueSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_UNIQUE,
      requiredPlan: PlanTitles.BUSINESS,
    })

    return true
  }

  const showUpgradeToUseUuidField = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockUuidField.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseUuidField'),
      content: t('upgrade.upgradeToUseUuidFieldSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_UUID_FIELD,
    })

    return true
  }

  const showUpgradeToUseAutoNumberField = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAutoNumberField.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseAutoNumberField'),
      content: t('upgrade.upgradeToUseAutoNumberFieldSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_AUTONUMBER_FIELD,
    })

    return true
  }

  const showUpgradeToUseSync = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockSync.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseSync'),
      content: t('upgrade.upgradeToUseSyncSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_SYNC,
      requiredPlan: PlanTitles.BUSINESS,
    })

    return true
  }

  const showUpgradeToUseRecordTemplates = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockRecordTemplates.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseRecordTemplates'),
      content: t('upgrade.upgradeToUseRecordTemplatesSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_RECORD_TEMPLATES,
      requiredPlan: PlanTitles.PLUS,
    })

    return true
  }

  const showSandboxPlanLimitExceededModal = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAddNewSandbox.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseSandbox'),
      content: t('upgrade.upgradeToUseSandboxSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      limitOrFeature: PlanLimitTypes.LIMIT_SANDBOX_PER_BASE,
      requiredPlan: PlanTitles.BUSINESS,
    })

    return true
  }

  const showUpgradeToUseRls = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockRls.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseRls'),
      content: t('upgrade.upgradeToUseRlsSubtitle', {
        plan: PlanTitles.ENTERPRISE,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_RLS,
      requiredPlan: PlanTitles.ENTERPRISE,
    })

    return true
  }

  const showUpgradeToUseFormScheduling = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockFormScheduling.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseFormScheduling'),
      content: t('upgrade.upgradeToUseFormSchedulingSubtitle', {
        plan: PlanTitles.PLUS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_FORM_SCHEDULING,
      requiredPlan: PlanTitles.PLUS,
    })

    return true
  }

  const showUpgradeToUseViewSections = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockViewSections.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseViewSections'),
      content: t('upgrade.upgradeToUseViewSectionsSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_VIEW_SECTIONS,
      requiredPlan: PlanTitles.BUSINESS,
    })

    return true
  }

  const showUpgradeToUseListView = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockListView.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseListView'),
      content: t('upgrade.upgradeToUseListViewSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      requiredPlan: PlanTitles.BUSINESS,
      limitOrFeature: PlanFeatureTypes.FEATURE_LIST_VIEW,
    })

    return true
  }

  const showUpgradeToUseMapView = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockMapView.value) {
      successCallback?.()

      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseMapView'),
      content: t('upgrade.upgradeToUseMapViewSubtitle', {
        plan: PlanTitles.BUSINESS,
      }),
      callback,
      requiredPlan: PlanTitles.BUSINESS,
      limitOrFeature: PlanFeatureTypes.FEATURE_MAP_VIEW,
    })

    return true
  }

  const showUpgradeToUseDateDependency = ({
    callback,
    successCallback,
  }: { callback?: (type: 'ok' | 'cancel') => void; successCallback?: () => void } = {}) => {
    if (!blockDateDependency.value) {
      successCallback?.()
      return
    }

    handleUpgradePlan({
      title: t('upgrade.upgradeToUseDateDependency'),
      content: t('upgrade.upgradeToUseDateDependencySubtitle'),
      callback,
      requiredPlan: PlanTitles.BUSINESS,
      limitOrFeature: PlanFeatureTypes.FEATURE_DATE_DEPENDENCY,
    })

    return true
  }

  /** EE-only upgrade prompts for self-hosted CE mode / licensed Starter */
  const showUpgradeForEEFeature = (featureTitle: string, limitOrFeature?: PlanLimitTypes | PlanFeatureTypes) => {
    if (isEEFeatureBlocked.value) {
      handleOnPremUpgrade({
        title: t('upgrade.enterpriseFeatureTitle'),
        content: t('upgrade.enterpriseFeatureSubtitle', { feature: featureTitle }),
      })
    } else {
      handleOnPremLicensedUpgrade({
        title: t('upgrade.upgradeToEnterpriseTitle'),
        content: t('upgrade.enterpriseFeatureSubtitle', { feature: featureTitle }),
        limitOrFeature,
      })
    }

    return true
  }

  const showUpgradeToUseSSO = () => {
    if (!blockSSO.value) return
    return showUpgradeForEEFeature(t('upgrade.features.sso'), PlanFeatureTypes.FEATURE_SSO)
  }

  const showUpgradeToUseScim = () => {
    if (!blockScim.value) return

    handleUpgradePlan({
      limitOrFeature: PlanFeatureTypes.FEATURE_SCIM,
    })

    return true
  }

  const showUpgradeToUseSnapshots = () => {
    if (!blockSnapshots.value) return
    return showUpgradeForEEFeature(t('upgrade.features.snapshots'), PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE)
  }

  const showUpgradeToUseCustomUrls = () => {
    if (!blockCustomUrls.value) return
    return showUpgradeForEEFeature(t('upgrade.features.customUrls'))
  }

  const showUpgradeToUseScripts = () => {
    if (!blockScripts.value) return
    return showUpgradeForEEFeature(t('upgrade.features.scripts'))
  }

  const showUpgradeToUseWorkflows = () => {
    if (!blockWorkflows.value) return
    return showUpgradeForEEFeature(t('upgrade.features.workflows'))
  }

  const showUpgradeToUseExtensions = () => {
    if (!blockExtensions.value) return
    return showUpgradeForEEFeature(t('upgrade.features.extensions'))
  }

  const showUpgradeToCreateWorkspace = () => {
    if (!blockWorkspaceCreate.value) return

    // Licensed on-prem hitting workspace limit: show "Upgrade to higher tier" modal
    if (isOnPrem.value && !isEEFeatureBlocked.value) {
      return handleOnPremLicensedUpgrade({
        limitOrFeature: PlanLimitTypes.LIMIT_WORKSPACE,
      })
    }

    return showUpgradeForEEFeature(t('upgrade.features.multipleWorkspaces'))
  }

  const showUpgradeToManageWorkspaceMembers = () => {
    if (!blockWorkspaceMembers.value) return
    return showUpgradeForEEFeature(t('upgrade.features.workspaceMembers'))
  }

  return {
    isWsOwner,
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
    isOnPrem,
    showUserPlanLimitExceededModal,
    isRecordLimitReached,
    isStorageLimitReached,
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
    isUnderLoyaltyCutoffDate,
    blockPrivateBases,
    showUpgradeToUsePrivateBases,
    showUserMayChargeAlert,
    maxAttachmentsAllowedInCell,
    showUpgradeToAddMoreAttachmentsInCell,
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
    showUpgradeToDuplicateTableToOtherWs,
    showUpgradeToDuplicateTableToOtherBase,
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
    showUpgradeToUseUnique,
    showUpgradeToUseSync,
    showUpgradeToUseRls,
    showUpgradeToUseUuidField,
    showUpgradeToUseAutoNumberField,
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
    isEEFeatureBlocked,
    showEEFeatures,
    blockSSO,
    blockScim,
    showUpgradeToUseScim,
    blockSnapshots,
    blockCustomUrls,
    blockScripts,
    blockWorkflows,
    blockExtensions,
    showUpgradeToUseExtensions,
    blockWorkspaceCreate,
    blockWorkspaceMembers,
    showUpgradeToUseSSO,
    showUpgradeToUseSnapshots,
    showUpgradeToUseCustomUrls,
    showUpgradeToUseScripts,
    showUpgradeToUseWorkflows,
    showUpgradeToCreateWorkspace,
    showUpgradeToManageWorkspaceMembers,
    showUpgradeForEEFeature,
  }
})
