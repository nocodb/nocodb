import { PlanTitles, type PlanFeatureTypes, type PlanLimitTypes } from 'nocodb-sdk'
import NcModalConfirm, { type NcConfirmModalProps } from '../../components/nc/ModalConfirm.vue'

export const useEeConfig = createSharedComposable(() => {
  const { t } = useI18n()

  const workspaceStore = useWorkspace()

  const { activeWorkspace, activeWorkspaceId } = storeToRefs(workspaceStore)

  const isPaidPlan = computed(() => !!activeWorkspace.value?.payment?.subscription)

  const activePlan = computed(() => activeWorkspace.value?.payment?.plan)

  const activeSubscription = computed(() => activeWorkspace.value?.payment?.subscription)

  const getLimit = (type: PlanLimitTypes, workspace?: NcWorkspace | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    return workspace?.payment?.plan?.limit ? workspace?.payment?.plan?.limit?.[type] : workspace?.payment?.plan?.meta?.[type]
  }

  const getFeature = (type: PlanFeatureTypes, workspace?: NcWorkspace | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    return workspace?.payment?.plan?.features
      ? workspace?.payment?.plan?.features?.[type]
      : workspace?.payment?.plan?.meta?.[type]
  }

  const getHigherPlan = (plan: string | PlanTitles) => {
    const planTitleValues = Object.values(PlanTitles)

    const activePlanIndex = planTitleValues.findIndex((p) => p === plan)

    // Return if plan does not exist or current plan is higher plan
    if (activePlanIndex === -1 || activePlanIndex === planTitleValues.length - 1) {
      return
    }

    return planTitleValues[activePlanIndex + 1]
  }

  const getPlanTitle = (plan: string | PlanTitles) => {
    return t(`objects.paymentPlan.${plan}`, plan)
  }

  const handleUpgradePlan = ({
    planTitle = PlanTitles.TEAM,
    title = t('title.upgradeToPlan', {
      plan: planTitle,
    }),
    content,
    okText,
    cancelText,
  }: Pick<NcConfirmModalProps, 'content' | 'okText' | 'cancelText'> & {
    title?: string
    planTitle: PlanTitles
  }) => {
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
      'onOk': async () => {
        closeDialog()
        navigateTo(`/${activeWorkspaceId.value}/settings?tab=billing`)
      },
      'update:visible': closeDialog,
      'showIcon': false,
    })

    function closeDialog() {
      isOpen.value = false
      close(1000)
    }
  }

  return {
    getLimit,
    getFeature,
    isPaidPlan,
    activePlan,
    activeSubscription,
    getHigherPlan,
    getPlanTitle,
    handleUpgradePlan,
  }
})
