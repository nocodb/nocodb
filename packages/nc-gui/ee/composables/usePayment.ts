import { type Stripe, loadStripe } from '@stripe/stripe-js'

export interface PaymentPlan {
  id: string
  title: string
  description: string
  stripe_product_id: string
  prices: any[]
  meta: any
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

  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const baseURL = $api.instance.defaults.baseURL

  const paymentState = ref<PaymentState>()

  const subscriptionId = ref<string>()

  const paymentMode = ref<'year' | 'month'>('year')

  const selectedPlan = ref<PaymentPlan | null>(null)

  const workspaceSeatCount = ref<number>(1)

  const plansAvailable = ref<PaymentPlan[]>([])

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
  }

  const getPlanPrice = (plan: PaymentPlan, mode?: 'year' | 'month') => {
    if (!mode) mode = paymentMode.value

    const price = plan.prices.find((price: any) => price.recurring.interval === mode)

    if (!price) return plan.prices[0].unit_amount / 100 / (mode === 'year' ? 12 : 1)

    return price.unit_amount / 100 / (mode === 'year' ? 12 : 1)
  }

  const createSubscription = async () => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')
    if (!stripe.value) throw new Error('Stripe not loaded')
    if (!selectedPlan.value) throw new Error('No plan selected')

    const price = selectedPlan.value.prices.find((price: any) => price.recurring.interval === paymentMode.value)

    if (!price) throw new Error('No price found')

    const res = (await $fetch(`/api/payment/${activeWorkspaceId.value}/create-subscription`, {
      baseURL,
      method: 'POST',
      headers: { 'xc-auth': $state.token.value as string },
      body: { seat: workspaceSeatCount.value, plan_id: selectedPlan.value.id, price_id: price.id },
    })) as {
      type: 'setup' | 'payment'
      id: string
      clientSecret: string
    }

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

  /* const updateSubscription = async () => {
    if (!stripe.value) throw new Error('Stripe not loaded')
    if (!selectedPlan.value) throw new Error('No plan selected')

    const price = selectedPlan.value.prices.find((price: any) => price.recurring.interval === paymentMode.value)

    if (!price) throw new Error('No price found')

    const res = (await $fetch(`/api/payment/:workspaceId/update-subscription`, {
      baseURL,
      method: 'POST',
      headers: { 'xc-auth': $state.token.value as string },
      body: {
        subscriptionId: subscriptionId.value,
        seat: selectedSeats.value,
        plan_id: selectedPlan.value.id,
        price_id: price.id,
      },
    })) as any

    return res.clientSecret
  } */

  const onPaymentModeChange = (val: boolean) => {
    paymentMode.value = val ? 'year' : 'month'
  }

  const onSelectPlan = (plan: PaymentPlan) => {
    selectedPlan.value = plan
    paymentState.value = PaymentState.PAYMENT
  }

  const reset = () => {
    paymentState.value = PaymentState.SELECT_PLAN
    selectedPlan.value = null
    subscriptionId.value = undefined
  }

  onMounted(async () => {
    stripe.value = (await loadStripe(
      'pk_test_51QhRouHU2WPCjTxw3ranXD6shPR0VbOjLflMfidsanV0m9mM0vZKQfYk3PserPAbnZAIJJhv701DV8FrwP6zJhaf00KYKhz11c',
    ))!

    await loadWorkspaceSeatCount()
  })

  return {
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
    createSubscription,
    cancelSubscription,
  }
}, 'injected-payment-store')

export { useProvidePaymentStore }

export function usePaymentStoreOrThrow() {
  const injectedPaymentStore = usePaymentStore()

  if (injectedPaymentStore == null) throw new Error('Please call `useProvidePaymentStore` on the appropriate parent component')

  return injectedPaymentStore
}
