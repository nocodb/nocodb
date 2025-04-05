import { GRACE_PERIOD_DURATION, HigherPlan, NON_SEAT_ROLES, PlanTitles } from 'nocodb-sdk'
import {
  type PlanFeatureTypes,
  type PlanLimitExceededDetailsType,
  PlanLimitTypes,
  type ProjectRoles,
  type WorkspaceUserRoles,
} from 'nocodb-sdk'
import dayjs from 'dayjs'
import NcModalConfirm, { type NcConfirmModalProps } from '../../components/nc/ModalConfirm.vue'

export const useEeConfig = createSharedComposable(() => {
  const { t } = useI18n()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const workspaceStore = useWorkspace()

  const { activeWorkspace, activeWorkspaceId, workspaces } = storeToRefs(workspaceStore)

  const isPaidPlan = computed(() => !!activeWorkspace.value?.payment?.subscription)

  const activePlan = computed(() => activeWorkspace.value?.payment?.plan)

  const activeSubscription = computed(() => activeWorkspace.value?.payment?.subscription)

  const isPaymentEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.PAYMENT))

  const getLimit = (type: PlanLimitTypes, workspace?: NcWorkspace | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    const limit = workspace?.payment?.plan?.meta?.[type] ?? Infinity

    return limit === -1 ? Infinity : limit
  }

  const getStatLimit = (type: PlanLimitTypes, workspace?: NcWorkspace | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    const limit = workspace?.stats?.[type] ?? 0

    return limit === -1 ? 0 : limit
  }

  /**
   * @param type - PlanLimitTypes to update
   * @param count - Can be positive or negative
   */
  const updateStatLimit = (type: PlanLimitTypes, count: number) => {
    if (!activeWorkspace.value) return

    const newCount = (activeWorkspace.value?.stats?.[type] ?? 0) + count

    workspaces.value.set(activeWorkspace.value.id!, {
      ...activeWorkspace.value,
      stats: {
        ...(activeWorkspace.value?.stats || {}),
        [type]: newCount,
      },
    })
  }

  const getFeature = (type: PlanFeatureTypes, workspace?: NcWorkspace | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    return workspace?.payment?.plan?.meta?.[type]
  }

  const getHigherPlan = (plan: string | PlanTitles | undefined = activePlan.value?.title) => {
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

  const handleUpgradePlan = ({
    activePlanTitle,
    newPlanTitle,
    workspaceId,
    callback,
    redirectToWorkspace = true,
    stopEventPropogation = true,
    title,
    content,
    okText,
    cancelText,
  }: Pick<NcConfirmModalProps, 'content' | 'okText' | 'cancelText'> & {
    title?: string
    activePlanTitle?: PlanTitles
    newPlanTitle?: PlanTitles
    workspaceId?: string
    callback?: (type: 'ok' | 'cancel') => void
    redirectToWorkspace?: boolean
    stopEventPropogation?: boolean
  } = {}) => {
    const higherPlan = HigherPlan[activePlanTitle ?? activePlan.value?.title ?? PlanTitles.FREE]
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
    const isOpen = ref(true)

    const { close } = useDialog(NcModalConfirm, {
      'visible': isOpen,
      'title': title,
      'content': content,
      'okText': okText || t('general.upgrade'),
      'cancelText': cancelText || t('msg.learnMore'),
      'onCancel': closeDialog,
      'cancelProps': {
        type: 'text',
      },
      'onOk': () => {
        closeDialog()
        callback?.('ok')

        if (redirectToWorkspace) {
          navigateTo(`/${workspaceId ?? activeWorkspaceId.value}/settings?tab=billing`)
        } else {
          navigateTo(`/account/workspace/${workspaceId ?? activeWorkspaceId.value}/settings`)
        }
      },
      'onClickCancel': () => {
        callback?.('cancel')
        window.open('https://nocodb.com/pricing', '_blank', 'noopener,noreferrer')
      },
      'update:visible': closeDialog,
      'showIcon': false,
      'maskClosable': true,
      'stopEventPropogation': stopEventPropogation,
    })

    function closeDialog() {
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
      activePlanTitle: details.plan,
      newPlanTitle: details.higherPlan,
      content: `The ${details.plan} plan allows up to ${details.limit} ${userType}. Upgrade to the ${details.higherPlan} plan for unlimited ${userType}.`,
      workspaceId,
      redirectToWorkspace: !isAdminPanel,
      callback,
    })
  }

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

  const blockAddNewRecord = computed(() => {
    return gracePeriodDaysLeft.value === 0
  })

  const showRecordPlanLimitExceededModal = ({ callback }: { callback?: (type: 'ok' | 'cancel') => void } = {}) => {
    if (!blockAddNewRecord.value) return

    handleUpgradePlan({
      title: 'Upgrade to create more records',
      content: `The ${activePlan.value?.title} plan allows up to ${getLimit(
        PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
      )} records. Upgrade to the ${HigherPlan[activePlan.value?.title]} plan to increase your record limit.`,
      callback,
    })

    return true
  }

  return {
    getLimit,
    getStatLimit,
    updateStatLimit,
    getFeature,
    isPaidPlan,
    activePlan,
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
  }
})
