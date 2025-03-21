import { type Stripe, type StripeCheckoutSession, loadStripe } from '@stripe/stripe-js'

export interface PaymentPlan {
  id: string
  title: string
  descriptions?: string[]
  stripe_product_id?: string
  prices?: any[]
}

export enum PaymentState {
  SELECT_PLAN = 'SELECT_PLAN',
  PAYMENT = 'PAYMENT',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

const [useProvidePaymentStore, usePaymentStore] = useInjectionState(() => {
  const stripe = ref<Stripe>()

  const { $state, $api } = useNuxtApp()

  const workspaceStore = useWorkspace()

  const { activeWorkspace, activeWorkspaceId } = storeToRefs(workspaceStore)

  const baseURL = $api.instance.defaults.baseURL

  const paymentState = ref<PaymentState>()

  const subscriptionId = ref<string>()

  const paymentMode = ref<'year' | 'month'>('year')

  const selectedPlan = ref<PaymentPlan | null>(null)

  const workspaceSeatCount = ref<number>(1)

  const plansAvailable = ref<PaymentPlan[]>([])

  const isPaidPlan = computed(() => !!activeWorkspace.value?.payment?.subscription)

  const activePlan = computed(() => activeWorkspace.value?.payment?.plan)

  const activeSubscription = computed(() => activeWorkspace.value?.payment?.subscription)

  const loadWorkspaceSeatCount = async () => {
    const { count } = (await $fetch(`/api/payment/${activeWorkspaceId.value}/seat-count`, {
      baseURL,
      method: 'GET',
      headers: { 'xc-auth': $state.token.value as string },
    })) as {
      count: number
    }

    workspaceSeatCount.value = count
  }

  const loadPlans = async () => {
    const plans = await $fetch(`/api/public/payment/plan`, {
      baseURL,
      method: 'GET',
      headers: { 'xc-auth': $state.token.value as string },
    })

    plansAvailable.value = plans as any

    plansAvailable.value.unshift({
      id: 'free',
      title: 'Free',
      descriptions: ['10k rows / workspace', '1GB storage', '5 API request / second', 'All user roles'],
    })
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

    const res = await $fetch(`/api/payment/${activeWorkspaceId.value}/create-subscription`, {
      baseURL,
      method: 'POST',
      headers: { 'xc-auth': $state.token.value as string },
      body: { seat: workspaceSeatCount.value, plan_id: selectedPlan.value.id, price_id: price.id },
    })

    return res
  }

  const cancelSubscription = async () => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')

    await $fetch(`/api/payment/${activeWorkspaceId.value}/cancel-subscription`, {
      baseURL,
      method: 'DELETE',
      headers: { 'xc-auth': $state.token.value as string },
    })

    await workspaceStore.loadWorkspace(activeWorkspaceId.value)
  }

  const getCustomerPortalSession = async () => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')

    const res = await $fetch(`/api/payment/${activeWorkspaceId.value}/customer-portal`, {
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

  const onPaymentModeChange = (val: 'year' | 'month') => {
    paymentMode.value = val
  }

  const onSelectPlan = (plan: PaymentPlan) => {
    selectedPlan.value = plan
    paymentState.value = PaymentState.PAYMENT
  }

  const onContactSales = (plan: PaymentPlan) => {
    // Todo: Handle redirect
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
    stripe.value = (await loadStripe(
      'pk_test_51QhRouHU2WPCjTxw3ranXD6shPR0VbOjLflMfidsanV0m9mM0vZKQfYk3PserPAbnZAIJJhv701DV8FrwP6zJhaf00KYKhz11c',
    ))!

    await loadPlans()
  })

  return {
    stripe,
    plansAvailable,
    loadPlans,
    loadWorkspaceSeatCount,
    getPlanPrice,
    onPaymentModeChange,
    onSelectPlan,
    onContactSales,
    selectedPlan,
    workspaceSeatCount,
    paymentMode,
    paymentState,
    subscriptionId,
    reset,
    createPaymentForm,
    cancelSubscription,
    isPaidPlan,
    activePlan,
    activeSubscription,
    activeWorkspaceId,
    getSessionResult,
    getCustomerPortalSession,
  }
}, 'injected-payment-store')

export { useProvidePaymentStore }

export function usePaymentStoreOrThrow() {
  const injectedPaymentStore = usePaymentStore()

  if (injectedPaymentStore == null) throw new Error('usePaymentStore is not provided')

  return injectedPaymentStore
}
