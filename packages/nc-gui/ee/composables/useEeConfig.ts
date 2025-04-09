import { GRACE_PERIOD_DURATION, HigherPlan, NON_SEAT_ROLES, PlanOrder, PlanTitles } from 'nocodb-sdk'
import {
  PlanFeatureTypes,
  type PlanLimitExceededDetailsType,
  PlanLimitTypes,
  type ProjectRoles,
  type WorkspaceUserRoles,
} from 'nocodb-sdk'
import dayjs from 'dayjs'
import NcModalConfirm, { type NcConfirmModalProps } from '../../components/nc/ModalConfirm.vue'

export const useEeConfig = createSharedComposable(() => {
  const { t } = useI18n()

  const { user } = useGlobal()

  const { isUIAllowed } = useRoles()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const workspaceStore = useWorkspace()

  const { activeWorkspace, activeWorkspaceId, workspaces } = storeToRefs(workspaceStore)

  /** Ref or Computed value */

  // Will only consider ws owner not super admin
  const isWsOwner = computed(() =>
    isUIAllowed('workspaceBilling', {
      roles: user.value?.workspace_roles,
    }),
  )
  const isPaidPlan = computed(() => !!activeWorkspace.value?.payment?.subscription)

  const activePlan = computed(() => activeWorkspace.value?.payment?.plan)

  const activePlanTitle = computed(() => (activePlan.value?.title as PlanTitles) ?? PlanTitles.FREE)

  const activeSubscription = computed(() => activeWorkspace.value?.payment?.subscription)

  const isPaymentEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.PAYMENT))

  const isWsAuditEnabled = computed(() => {
    return activePlan.value?.title && PlanOrder[activePlanTitle.value] >= PlanOrder[PlanTitles.BUSINESS]
  })

  const isRecordLimitReached = computed(() => {
    return getStatLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE)
  })

  const gracePeriodDaysLeft = computed(() => {
    if (!isRecordLimitReached.value) return Infinity

    if (!activeWorkspace.value?.grace_period_start_at) return 0

    const start = dayjs(activeWorkspace.value.grace_period_start_at)
    const graceEnd = start.add(GRACE_PERIOD_DURATION, 'day')

    const daysLeft = graceEnd.diff(dayjs(), 'day')

    // Ensure it's never negative (e.g., if grace period is over)
    return Math.max(daysLeft, 0)
  })

  /**
   * User has to upgrade plan in order to add new records
   */
  const blockAddNewRecord = computed(() => {
    return gracePeriodDaysLeft.value === 0
  })

  const isAllowToAddExtension = computed(
    () =>
      (getFeature(PlanFeatureTypes.FEATURE_EXTENSIONS) || getLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE) > 0) &&
      getStatLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE) < getLimit(PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE),
  )

  const blockAddNewAttachment = computed(() => {
    return getStatLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE)
  })

  const blockAddNewExternalSource = computed(() => {
    return (
      getStatLimit(PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE) >=
      getLimit(PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE)
    )
  })

  const blockAddNewWebhook = computed(() => {
    return getStatLimit(PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE)
  })

  /** Helper functions */
  function getLimit(type: PlanLimitTypes, workspace?: NcWorkspace | null) {
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

  const handleRequestUpgrade = (..._arg: any[]) => {
    // Todo: send request to owner
  }

  const navigateToBilling = (workspaceId?: string, redirectToWorkspace: boolean = true) => {
    if (!isWsOwner.value) return handleRequestUpgrade()

    if (redirectToWorkspace) {
      navigateTo(`/${workspaceId ?? activeWorkspaceId.value}/settings?tab=billing`)
    } else {
      navigateTo(`/account/workspace/${workspaceId ?? activeWorkspaceId.value}/settings`)
    }
  }

  const handleUpgradePlan = ({
    currentPlanTitle,
    newPlanTitle,
    workspaceId,
    callback,
    redirectToWorkspace = true,
    stopEventPropogation = true,
    title,
    content,
    okText,
    cancelText,
    focusBtn,
    maskClosable = true,
    keyboard = true,
    disableClose,
    requestUpgrade,
  }: Pick<NcConfirmModalProps, 'content' | 'okText' | 'cancelText' | 'focusBtn' | 'maskClosable' | 'keyboard'> & {
    title?: string
    currentPlanTitle?: PlanTitles
    newPlanTitle?: PlanTitles
    workspaceId?: string
    callback?: (type: 'ok' | 'cancel') => void
    redirectToWorkspace?: boolean
    stopEventPropogation?: boolean
    disableClose?: boolean
    requestUpgrade?: boolean
  } = {}) => {
    const higherPlan = HigherPlan[currentPlanTitle ?? activePlanTitle.value]
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

    let okBtnText = okText

    if (!okBtnText) {
      okBtnText = isWsOwner.value ? t('general.upgrade') : t('general.requestUpgrade')
    }
    const isOpen = ref(true)

    const { close } = useDialog(
      NcModalConfirm,
      {
        'visible': isOpen,
        'title': title,
        'content': content,
        'okText': okBtnText,
        'onCancel': closeDialog,
        'cancelProps': {
          class: requestUpgrade ? '!hidden' : '',
        },
        'onOk': () => {
          closeDialog()
          callback?.('ok')

          navigateToBilling(workspaceId, redirectToWorkspace)
        },
        'onClickCancel': () => {
          callback?.('cancel')
        },
        'update:visible': closeDialog,
        'showIcon': false,
        'maskClosable': disableClose ? false : maskClosable,
        'keyboard': disableClose ? false : keyboard,
        'stopEventPropogation': stopEventPropogation,
        'focusBtn': focusBtn,
      },
      {
        slots: {
          headerAction: () => [
            h(
              'a',
              { href: 'https://nocodb.com/pricing', target: '_blank', rel: 'noopener noreferrer', class: 'text-sm leading-6' },
              t('msg.learnMore'),
            ),
          ],
        },
      },
    )

    function closeDialog(forceClose = false) {
      if (!forceClose & (disableClose || requestUpgrade)) return

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
    const userType = NON_SEAT_ROLES.includes(role) ? 'users' : 'editors'

    handleUpgradePlan({
      title: 'Invite more members',
      currentPlanTitle: details.plan,
      newPlanTitle: details.higherPlan,
      content: `The ${details.plan} plan allows up to ${details.limit} ${userType}. Upgrade to the ${details.higherPlan} plan for unlimited ${userType}.`,
      workspaceId,
      redirectToWorkspace: !isAdminPanel,
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
        : t('upgrade.upgradeToAddMoreAttachmentsSubtitle', {
            activePlan: activePlanTitle.value,
            limit: getLimit(PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE),
            plan: HigherPlan[activePlanTitle.value],
          }),
      callback,
      focusBtn,
      disableClose: isSharedFormView,
      requestUpgrade: isSharedFormView,
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
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
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
    })

    return true
  }

  const showWebhookLogsFeatureAccessModal = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (activePlanTitle.value !== PlanTitles.FREE) return

    handleUpgradePlan({
      content: t('upgrade.upgradeToAccessWebhookLogsSubtitle', {
        plan: HigherPlan[activePlanTitle.value],
      }),
      callback,
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
    blockAddNewWebhook,
    showWebhookPlanLimitExceededModal,
    showWebhookLogsFeatureAccessModal,
  }
})
