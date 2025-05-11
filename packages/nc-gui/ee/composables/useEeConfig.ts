import { GRACE_PERIOD_DURATION, HigherPlan, LOYALTY_GRACE_PERIOD_END_DATE, NON_SEAT_ROLES, PlanTitles } from 'nocodb-sdk'
import {
  PlanFeatureTypes,
  type PlanLimitExceededDetailsType,
  PlanLimitTypes,
  type ProjectRoles,
  type WorkspaceUserRoles,
} from 'nocodb-sdk'
import dayjs from 'dayjs'
import NcModalConfirm, { type NcConfirmModalProps } from '../../components/nc/ModalConfirm.vue'

const eeConfigState = createGlobalState(() => {
  const isSideBannerExpanded = ref<boolean>(true)

  return { isSideBannerExpanded }
})

export const useEeConfig = createSharedComposable(() => {
  const { t } = useI18n()

  const { $state, $api } = useNuxtApp()

  const baseURL = $api.instance.defaults.baseURL

  const { user, appInfo } = useGlobal()

  const { isUIAllowed } = useRoles()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const workspaceStore = useWorkspace()

  const { activeWorkspace, activeWorkspaceId, workspaces } = storeToRefs(workspaceStore)

  const { isSideBannerExpanded } = eeConfigState()

  const cloudFeatures = ref([])

  /** Ref or Computed value */

  const isPaymentEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.PAYMENT))

  // Will only consider ws owner not super admin
  const isWsOwner = computed(() =>
    isUIAllowed('workspaceBilling', {
      roles: user.value?.workspace_roles,
    }),
  )
  const isPaidPlan = computed(() => !!activeWorkspace.value?.payment?.subscription || appInfo.value?.isOnPrem)

  const activePlan = computed(() => activeWorkspace.value?.payment?.plan)

  const activePlanTitle = computed(() => (activePlan.value?.title as PlanTitles) ?? PlanTitles.FREE)

  const activeSubscription = computed(() => activeWorkspace.value?.payment?.subscription)

  const isLoyaltyDiscountAvailable = computed(() => {
    if (!activeWorkspace.value) return false

    return activeWorkspace.value?.loyal && !activeWorkspace.value?.loyalty_discount_used
  })

  const isUnderLoyaltyCutoffDate = computed(() => {
    return dayjs().isSameOrBefore(dayjs(LOYALTY_GRACE_PERIOD_END_DATE))
  })

  const isWsAuditEnabled = computed(() => {
    return isPaymentEnabled.value && getFeature(PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE)
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

  const gracePeriodDaysLeft = computed(() => {
    if (!activeWorkspace.value?.grace_period_start_at || activePlan.value?.title !== PlanTitles.FREE) return 0

    const start = dayjs(activeWorkspace.value.grace_period_start_at)
    const graceEnd = start.add(GRACE_PERIOD_DURATION, 'day')

    const daysLeft = graceEnd.diff(dayjs(), 'day')

    // Ensure it's never negative (e.g., if grace period is over)
    return Math.max(daysLeft, 0)
  })

  const gracePeriodEndDate = computed(() => {
    if (gracePeriodDaysLeft.value <= 0) return ''

    return dayjs(activeWorkspace.value?.grace_period_start_at).add(GRACE_PERIOD_DURATION, 'day').format('YYYY-MM-DD')
  })

  /**
   * User has to upgrade plan in order to add new records
   */
  const blockAddNewRecord = computed(() => {
    return isRecordLimitReached.value && gracePeriodDaysLeft.value === 0
  })

  const blockAddNewAttachment = computed(() => {
    return isStorageLimitReached.value && gracePeriodDaysLeft.value === 0
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

  // TODO: @DarkPhoenix2704
  const blockAddNewScript = computed(() => {
    return false
  })

  const blockAddNewExternalSource = computed(() => {
    return (
      isPaymentEnabled.value &&
      getStatLimit(PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE) >=
        getLimit(PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE)
    )
  })

  const blockAddNewWebhook = computed(() => {
    return (
      isPaymentEnabled.value &&
      getStatLimit(PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE)
    )
  })

  const isTopBannerVisible = computed(() => {
    return isPaymentEnabled.value && !isPaidPlan.value
  })

  const blockWsImageLogoUpload = computed(() => {
    return isPaymentEnabled.value && !isPaidPlan.value
  })

  /** Helper functions */
  function getLimit(type: PlanLimitTypes, workspace?: NcWorkspace | null) {
    if (!isPaymentEnabled.value) return Infinity

    if (!workspace) {
      workspace = activeWorkspace.value
    }

    const limit = Number(workspace?.payment?.plan?.meta?.[type] ?? Infinity)

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
    if (!isPaymentEnabled.value) return true

    if (!workspace) {
      workspace = activeWorkspace.value
    }

    return ncIsString(workspace?.payment?.plan?.meta?.[type])
      ? JSON.parse(workspace?.payment?.plan?.meta?.[type])
      : workspace?.payment?.plan?.meta?.[type]
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
    limitOrFeature?: PlanLimitTypes | PlanFeatureTypes
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
  }: {
    workspaceId?: string
    redirectToWorkspace?: boolean
    limitOrFeature?: PlanLimitTypes | PlanFeatureTypes
  } = {}) => {
    if (!isWsOwner.value) return handleRequestUpgrade({ workspaceId, limitOrFeature })

    const planCtaBtnQuery = limitOrFeature === PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE ? `&activeBtn=${PlanTitles.BUSINESS}` : ''

    if (redirectToWorkspace) {
      navigateTo(`/${workspaceId ?? activeWorkspaceId.value}/settings?tab=billing&autoScroll=plan${planCtaBtnQuery}`)
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
  }: {
    workspaceId?: string
    autoScroll?: 'compare' | 'faq'
    limitOrFeature?: PlanLimitTypes | PlanFeatureTypes
    newTab?: boolean
    ctaPlan?: PlanTitles
  } = {}) => {
    if (!isWsOwner.value) return handleRequestUpgrade({ workspaceId, limitOrFeature })

    const paramsObj = {
      ...(autoScroll ? { go: autoScroll } : {}),
      ...(ctaPlan ? { activeBtn: ctaPlan } : {}),
      ...(limitOrFeature === PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE ? { activeBtn: PlanTitles.ENTERPRISE } : {}),
    }

    const searchQuery = new URLSearchParams(paramsObj).toString()

    if (newTab) {
      window.open(`/?pricing=true&workspaceId=${workspaceId || activeWorkspaceId.value}`, '_blank')
      return
    }

    navigateTo(`/${workspaceId || activeWorkspaceId.value}/pricing${searchQuery ? `?${searchQuery}` : ''}`)
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
    currentPlanTitle?: PlanTitles
    newPlanTitle?: PlanTitles
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
              e.preventDefault()
              navigateToPricing({ autoScroll: 'compare', newTab: true, ctaPlan: higherPlan })
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
              cancelProps.value.class = '!hidden'
              slots.value = {}
            }
          } else {
            navigateToPricing({ limitOrFeature, ctaPlan: higherPlan })
            closeDialog()
            callback?.('ok')
          }
        },
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
      limitOrFeature: PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE,
    })

    return true
  }

  const blockExternalSourceRecordVisibility = (isExternalSource: boolean = false) => {
    const loyaltyUserValidation = isLoyaltyDiscountAvailable.value ? !isUnderLoyaltyCutoffDate.value : true
    return isPaymentEnabled.value && isExternalSource && activePlanTitle.value === PlanTitles.FREE && loyaltyUserValidation
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
      content: t('upgrade.upgradeToSeeMoreRecordSubtitle'),
      callback,
      maskClosable: false,
      keyboard: false,
      limitOrFeature: PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE,
    })

    return true
  }

  const showUpgradeToUploadWsImage = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockWsImageLogoUpload.value) return

    handleUpgradePlan({
      title: t('upgrade.upgradeToUploadWsImage'),
      content: t('upgrade.upgradeToUploadWsImageSubtitle', {
        activePlan: activePlanTitle.value,
        plan: PlanTitles.TEAM,
      }),
      callback,
      limitOrFeature: PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO,
    })

    return true
  }

  return {
    isWsOwner,
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
    isStorageLimitReached,
    gracePeriodDaysLeft,
    blockAddNewRecord,
    showRecordPlanLimitExceededModal,
    navigateToBilling,
    isWsAuditEnabled,
    isAllowToAddExtension,
    blockAddNewExtension,
    blockAddNewAttachment,
    blockAddNewScript,
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
  }
})
