import { PlanTitles, type PlanFeatureTypes, type PlanLimitTypes } from 'nocodb-sdk'
import NcModalConfirm, { type NcConfirmModalProps } from '../../components/nc/ModalConfirm.vue'

export const useEeConfig = createSharedComposable(() => {
  const { t } = useI18n()

  const workspaceStore = useWorkspace()

  const { activeWorkspace } = storeToRefs(workspaceStore)

  const isPaidPlan = computed(() => !!activeWorkspace.value?.payment?.subscription)

  const activePlan = computed(() => activeWorkspace.value?.payment?.plan)

  const activeSubscription = computed(() => activeWorkspace.value?.payment?.subscription)

  const getLimit = (type: PlanLimitTypes, workspace?: NcWorkspace | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    return workspace?.payment?.plan?.meta?.[type]
  }

  const getFeature = (type: PlanFeatureTypes, workspace?: NcWorkspace | null) => {
    if (!workspace) {
      workspace = activeWorkspace.value
    }

    return workspace?.payment?.plan?.meta?.[type]
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
        // Todo: Redirection
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
    handleUpgradePlan,
  }
})
