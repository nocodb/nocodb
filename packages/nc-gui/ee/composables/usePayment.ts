import { type Stripe, type StripeCheckoutSession, loadStripe } from '@stripe/stripe-js'
import { PlanOrder, PlanTitles } from 'nocodb-sdk'
import NcModalConfirm from '../../components/nc/ModalConfirm.vue'

export interface PaymentPlan {
  id: string
  title: PlanTitles
  descriptions?: string[]
  stripe_product_id?: string
  prices?: any[]
  is_active?: boolean
}

export enum PaymentState {
  SELECT_PLAN = 'SELECT_PLAN',
  PAYMENT = 'PAYMENT',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

const [useProvidePaymentStore, usePaymentStore] = useInjectionState(() => {
  const annualDiscount = 16

  const stripe = ref<Stripe>()

  const { $state, $api } = useNuxtApp()

  const { t } = useI18n()

  const workspaceStore = useWorkspace()

  const { activeWorkspace, activeWorkspaceId } = storeToRefs(workspaceStore)

  const { user } = useGlobal()

  const { isUIAllowed } = useRoles()

  const baseURL = $api.instance.defaults.baseURL

  const paymentState = ref<PaymentState>()

  const subscriptionId = ref<string>()

  const paymentMode = ref<'year' | 'month'>('year')

  const selectedPlan = ref<PaymentPlan | null>(null)

  const upgradePlan = ref<PaymentPlan | null>(null)

  const workspaceSeatCount = ref<number>(1)

  const plansAvailable = ref<PaymentPlan[]>([])

  const isAccountPage = ref<boolean>(false)

  const isOpenUpgradePlanModal = ref<boolean>(false)

  const isPaidPlan = computed(() => !!activeWorkspace.value?.payment?.subscription)

  const activePlan = computed(() => activeWorkspace.value?.payment?.plan)

  const activeSubscription = computed(() => activeWorkspace.value?.payment?.subscription)

  const loadWorkspaceSeatCount = async () => {
    if (
      !isUIAllowed('workspaceBilling', {
        roles: user.value?.workspace_roles,
      })
    )
      return

    try {
      const { count } = (await $fetch(`/api/payment/${activeWorkspaceId.value}/seat-count`, {
        baseURL,
        method: 'GET',
        headers: { 'xc-auth': $state.token.value as string },
      })) as {
        count: number
      }

      workspaceSeatCount.value = count
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const loadPlans = async () => {
    try {
      const plans = await $fetch(`/api/public/payment/plan`, {
        baseURL,
        method: 'GET',
        headers: { 'xc-auth': $state.token.value as string },
      })

      plansAvailable.value = plans as any

      plansAvailable.value.unshift({
        id: 'free',
        title: PlanTitles.FREE,
        descriptions: [
          'Unlimited bases',
          'Upto 3 editors',
          '1,000 rows per workspace',
          '1 GB of attachments per workspace',
          '100 automation runs per month',
          '1,000 API calls per month',
        ],
      })

      paymentMode.value = activeSubscription.value?.period || 'year'
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const getPlanPrice = (plan?: PaymentPlan, mode?: 'year' | 'month') => {
    if (!plan?.prices) return 0

    if (!mode) mode = paymentMode.value

    const price = plan.prices.find((price: any) => price.recurring.interval === mode)

    if (!price) return plan.prices[0].unit_amount / 100 / (mode === 'year' ? 12 : 1)

    return price.unit_amount / 100 / (mode === 'year' ? 12 : 1)
  }

  const createPaymentForm = async () => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')
    if (!stripe.value) throw new Error('Stripe not loaded')
    if (!selectedPlan.value) throw new Error('No plan selected')
    if (!selectedPlan.value.prices) throw new Error('No prices found')

    const price = selectedPlan.value.prices.find((price: any) => price.recurring.interval === paymentMode.value)

    if (!price) throw new Error('No price found')

    const res = await $fetch(`/api/payment/${activeWorkspaceId.value}/create-subscription-form`, {
      baseURL,
      method: 'POST',
      headers: { 'xc-auth': $state.token.value as string },
      body: {
        seat: workspaceSeatCount.value,
        plan_id: selectedPlan.value.id,
        price_id: price.id,
        isAccountPage: isAccountPage.value,
      },
    })

    return res
  }

  const updateSubscription = async (planId: string, priceId?: string) => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')
    if (!stripe.value) throw new Error('Stripe not loaded')

    const plan = plansAvailable.value.find((plan) => plan.id === planId)

    if (!plan) throw new Error('No plan found')

    priceId = priceId || plan.prices?.find((price: any) => price.recurring.interval === paymentMode.value)?.id

    if (!priceId) throw new Error('No price found')

    await $fetch(`/api/payment/${activeWorkspaceId.value}/update-subscription`, {
      baseURL,
      method: 'POST',
      headers: { 'xc-auth': $state.token.value as string },
      body: {
        seat: workspaceSeatCount.value,
        plan_id: plan.id,
        price_id: priceId,
      },
    })

    window.location.reload()
  }

  const cancelSubscription = async () => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')

    await $fetch(`/api/payment/${activeWorkspaceId.value}/cancel-subscription`, {
      baseURL,
      method: 'DELETE',
      headers: { 'xc-auth': $state.token.value as string },
    })

    window.location.reload()
  }

  const getCustomerPortalSession = async () => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')

    const res = await $fetch(`/api/payment/${activeWorkspaceId.value}/customer-portal?isAccountPage=${isAccountPage.value}`, {
      baseURL,
      method: 'GET',
      headers: { 'xc-auth': $state.token.value as string },
    })

    return res.url
  }

  const getSessionResult = async (sessionId: string): Promise<StripeCheckoutSession> => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')

    return $fetch(`/api/payment/${activeWorkspaceId.value}/get-session-result/${sessionId}`, {
      baseURL,
      method: 'GET',
      headers: { 'xc-auth': $state.token.value as string },
    })
  }

  const onManageSubscription = async () => {
    if (!activeSubscription.value) return

    try {
      const url = await getCustomerPortalSession()
      if (url) window.open(url, '_blank')
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const onPaymentModeChange = (val: 'year' | 'month') => {
    paymentMode.value = val
  }

  const calculateChange = (plan: PaymentPlan) => {
    if (!activeSubscription.value) return {}

    const changes: {
      plan?: string
      price?: string
      period?: string
      change?: 'upgrade' | 'downgrade'
    } = {}

    if (activeSubscription.value.fk_plan_id !== plan.id) {
      changes.plan = plan.title
    }

    const activePrice = activePlan.value?.prices?.find(
      (price: any) => price.recurring.interval === activeSubscription.value.period,
    )

    const newPrice = plan.prices?.find((price: any) => price.recurring.interval === paymentMode.value)

    if (activePrice?.id !== newPrice?.id) {
      changes.price = newPrice?.unit_amount > activePrice?.unit_amount ? 'charges' : 'no-charges'
    }

    if (activeSubscription.value.period !== paymentMode.value) {
      changes.period = paymentMode.value
    }

    changes.change = PlanOrder[activePlan.value?.title as PlanTitles] < PlanOrder[plan.title] ? 'upgrade' : 'downgrade'

    return changes
  }

  const onSelectPlan = (plan: PaymentPlan) => {
    if (!activeSubscription.value) {
      selectedPlan.value = plan
      paymentState.value = PaymentState.PAYMENT
    } else {
      const changes = calculateChange(plan)

      let title = ''
      let content = ''
      let okText = ''

      if (changes.change === 'upgrade') {
        title = `${t('title.upgradeToPlan', { plan: changes.plan })}?`
        content = t('title.upgradeToPlanSubtitle', { plan: changes.plan })
        okText = t('general.upgrade')

        upgradePlan.value = plan

        isOpenUpgradePlanModal.value = true

        return
      } else if (changes.change === 'downgrade') {
        if (changes.plan) {
          title = t('title.downgradeToPlan', { plan: changes.plan })
          content = t('title.downgradeToPlanSubtitle', { activePlan: activePlan.value?.title, plan: changes.plan })
          okText = t('general.downgrade')
        } else {
          title = 'Update Subscription'
          content = `${changes.price === 'charges' ? 'Charges' : 'No charges'} will be applied for the change. ${
            changes.period ? `The billing period will be changed to ${changes.period === 'month' ? 'monthly' : 'annually'}` : ''
          }`
          okText = t('general.update')
        }
      }

      const isOpen = ref(true)
      const { close } = useDialog(NcModalConfirm, {
        'visible': isOpen,
        'title': title,
        'content': content,
        'okText': okText,
        'onCancel': closeDialog,
        'onOk': async () => {
          closeDialog()

          if (changes.plan === PlanTitles.FREE) {
            await cancelSubscription()
          } else {
            await updateSubscription(plan.id)
          }
        },
        'update:visible': closeDialog,
        'showIcon': false,
        'focusBtn': 'ok',
      })

      function closeDialog() {
        isOpen.value = false
        close(1000)
      }
    }
  }

  const reset = () => {
    paymentState.value = PaymentState.SELECT_PLAN
    selectedPlan.value = null
    subscriptionId.value = undefined
  }

  watch(
    activeWorkspaceId,
    async () => {
      reset()

      if (activeWorkspaceId.value) {
        await loadWorkspaceSeatCount()
      }
    },
    { immediate: true },
  )

  onMounted(async () => {
    try {
      stripe.value = (await loadStripe(
        'pk_test_51QhRouHU2WPCjTxw3ranXD6shPR0VbOjLflMfidsanV0m9mM0vZKQfYk3PserPAbnZAIJJhv701DV8FrwP6zJhaf00KYKhz11c',
      ))!

      await loadPlans()
    } catch (e) {
      console.log(e)
    }
  })

  return {
    annualDiscount,
    stripe,
    plansAvailable,
    loadPlans,
    loadWorkspaceSeatCount,
    getPlanPrice,
    onPaymentModeChange,
    onSelectPlan,
    selectedPlan,
    workspaceSeatCount,
    paymentMode,
    paymentState,
    subscriptionId,
    reset,
    createPaymentForm,
    updateSubscription,
    cancelSubscription,
    isPaidPlan,
    activePlan,
    activeSubscription,
    activeWorkspaceId,
    getSessionResult,
    getCustomerPortalSession,
    isAccountPage,
    onManageSubscription,
    isOpenUpgradePlanModal,
    upgradePlan,
  }
}, 'injected-payment-store')

export { useProvidePaymentStore }

export function usePaymentStoreOrThrow() {
  const injectedPaymentStore = usePaymentStore()

  if (injectedPaymentStore == null) throw new Error('usePaymentStore is not provided')

  return injectedPaymentStore
}
