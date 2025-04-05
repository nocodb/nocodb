import { HigherPlan, NON_SEAT_ROLES, PlanTitles } from 'nocodb-sdk'
import type { PlanFeatureTypes, PlanLimitExceededDetailsType, PlanLimitTypes, ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk'
import NcModalConfirm, { type NcConfirmModalProps } from '../../components/nc/ModalConfirm.vue'

export const useEeConfig = createSharedComposable(() => {
  const { t } = useI18n()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const workspaceStore = useWorkspace()

  const { activeWorkspace, activeWorkspaceId } = storeToRefs(workspaceStore)

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

    const limit = workspace?.payment?.plan?.meta?.[type] ?? 0

    return limit === -1 ? 0 : limit
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

        console.log('workspaceId', workspaceId, redirectToWorkspace)

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

  return {
    getLimit,
    getStatLimit,
    getFeature,
    isPaidPlan,
    activePlan,
    activeSubscription,
    getHigherPlan,
    getPlanTitle,
    handleUpgradePlan,
    isPaymentEnabled,
    showUserPlanLimitExceededModal,
  }
})
