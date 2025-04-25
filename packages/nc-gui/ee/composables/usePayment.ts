import { type StripeCheckoutSession } from '@stripe/stripe-js'
import type Stripe from 'stripe'
import { LoyaltyPriceLookupKeyMap, type PaginatedType, PlanPriceLookupKeys, PlanTitles } from 'nocodb-sdk'

const defaultPaginationData = { page: 1, pageSize: 25, totalRows: 0, isLoading: true }

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
  const annualDiscount = 20

  const { $state, $api } = useNuxtApp()

  const { navigateToCheckout, isLoyaltyDiscountAvailable } = useEeConfig()

  const workspaceStore = useWorkspace()

  const { activeWorkspace, activeWorkspaceId } = storeToRefs(workspaceStore)

  const baseURL = $api.instance.defaults.baseURL

  const paymentState = ref<PaymentState>()

  const subscriptionId = ref<string>()

  const paymentMode = ref<'year' | 'month'>('year')

  const selectedPlan = ref<PaymentPlan | null>(null)

  const workspaceSeatCount = ref<number>(1)

  const plansAvailable = ref<PaymentPlan[]>([])

  const isAccountPage = ref<boolean>(false)

  const invoices = ref<Stripe.Invoice[]>([])

  const invoicePaginationData = ref<PaginatedType & { isLoading?: boolean }>(defaultPaginationData)

  const isPaidPlan = computed(() => !!activeWorkspace.value?.payment?.subscription)

  const activePlan = computed(() => activeWorkspace.value?.payment?.plan)

  const activeSubscription = computed(() => activeWorkspace.value?.payment?.subscription)

  const loadWorkspaceSeatCount = async () => {
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
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const loadPlan = async (planId: string) => {
    try {
      const plan = await $fetch(`/api/public/payment/plan/${planId}`, {
        baseURL,
        method: 'GET',
        headers: { 'xc-auth': $state.token.value as string },
      })

      if (!plan) throw new Error('No plan found')

      return plan as PaymentPlan
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const getLookupKey = (planTitle: PlanTitles, mode: 'year' | 'month') => {
    let lookupKey = null

    if (planTitle === PlanTitles.TEAM) {
      lookupKey = mode === 'month' ? PlanPriceLookupKeys.TEAM_MONTHLY : PlanPriceLookupKeys.TEAM_YEARLY
    }

    if (planTitle === PlanTitles.BUSINESS) {
      lookupKey = mode === 'month' ? PlanPriceLookupKeys.BUSINESS_MONTHLY : PlanPriceLookupKeys.BUSINESS_YEARLY
    }

    if (lookupKey && isLoyaltyDiscountAvailable.value) {
      lookupKey = LoyaltyPriceLookupKeyMap[lookupKey]
    }

    return lookupKey
  }

  const getPrice = (plan: PaymentPlan, mode?: 'year' | 'month') => {
    if (!plan?.prices) return null

    if (!mode) mode = paymentMode.value

    const lookupKey = getLookupKey(plan.title, mode)

    if (!lookupKey) return null

    const price = plan.prices.find((price: any) => price.lookup_key === lookupKey)

    if (!price) return null

    return price
  }

  const getPlanPrice = (plan?: PaymentPlan, mode?: 'year' | 'month') => {
    if (!plan?.prices) return 0

    if (!mode) mode = paymentMode.value

    const price = getPrice(plan, mode) || plan.prices[0]

    if (price.billing_scheme === 'tiered' && price.tiers_mode === 'volume') {
      const tier = price.tiers.find((tier: any) => workspaceSeatCount.value <= (tier.up_to ?? Infinity))

      if (!tier) return 0

      return (tier.unit_amount + tier.flat_amount) / 100 / (mode === 'year' ? 12 : 1)
    } else if (price.billing_scheme === 'tiered' && price.tiers_mode === 'graduated') {
      let remainingSeats = workspaceSeatCount.value
      let total = 0
      let previousUpTo = 0

      for (const tier of price.tiers) {
        const tierLimit = tier.up_to ?? Infinity
        const tierSeats = Math.min(remainingSeats, tierLimit)
        const seatsInTier = tierSeats - (previousUpTo ?? 0)

        if (seatsInTier > 0) {
          total += tier.unit_amount + (tier.flat_amount || 0)
          remainingSeats -= seatsInTier
        }

        if (tier.up_to === null || tier.up_to === 'inf' || workspaceSeatCount.value <= tierLimit) break

        previousUpTo = tierLimit
      }

      return total / 100 / (mode === 'year' ? 12 : 1)
    }

    return price.unit_amount / 100 / (mode === 'year' ? 12 : 1)
  }

  const createPaymentForm = async () => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')
    if (!selectedPlan.value) throw new Error('No plan selected')
    if (!selectedPlan.value.prices) throw new Error('No prices found')

    const price = getPrice(selectedPlan.value, paymentMode.value)

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

  const updateSubscription = async (planId: string, priceId?: string, afterUpgrade = false) => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')

    const plan = plansAvailable.value.find((plan) => plan.id === planId)

    if (!plan) throw new Error('No plan found')

    priceId = priceId || getPrice(plan, paymentMode.value)?.id

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

    window.location.href = `/#/${activeWorkspaceId.value}/settings?tab=billing${afterUpgrade ? '&afterUpgrade=true' : ''}`
  }

  const cancelSubscription = async () => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')

    await $fetch(`/api/payment/${activeWorkspaceId.value}/cancel-subscription`, {
      baseURL,
      method: 'DELETE',
      headers: { 'xc-auth': $state.token.value as string },
    })

    window.location.href = `/#/${activeWorkspaceId.value}/settings?tab=billing`
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

  const loadInvoices = async () => {
    if (!activeWorkspaceId.value) throw new Error('No active workspace')

    if (!activeWorkspace.value?.stripe_customer_id) {
      invoicePaginationData.value.isLoading = false

      return
    }

    try {
      const res = (await $fetch(`/api/payment/${activeWorkspaceId.value}/invoice`, {
        baseURL,
        method: 'GET',
        headers: { 'xc-auth': $state.token.value as string },
      })) as Stripe.ApiList<Stripe.Invoice>

      invoices.value = res?.data || []
      invoicePaginationData.value = { ...defaultPaginationData, totalRows: invoices.value.length }
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      invoicePaginationData.value.isLoading = false
    }
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

  const onSelectPlan = (plan: PaymentPlan) => {
    navigateToCheckout(plan.id, paymentMode.value)
  }

  watch(
    activeWorkspaceId,
    async () => {
      if (activeWorkspaceId.value) {
        await loadWorkspaceSeatCount()
      }
    },
    { immediate: true },
  )

  return {
    annualDiscount,
    plansAvailable,
    loadPlans,
    loadPlan,
    loadWorkspaceSeatCount,
    getPlanPrice,
    onPaymentModeChange,
    onSelectPlan,
    selectedPlan,
    workspaceSeatCount,
    paymentMode,
    paymentState,
    subscriptionId,
    createPaymentForm,
    updateSubscription,
    cancelSubscription,
    isPaidPlan,
    activePlan,
    activeSubscription,
    activeWorkspaceId,
    activeWorkspace,
    getSessionResult,
    getCustomerPortalSession,
    isAccountPage,
    onManageSubscription,
    isLoyaltyDiscountAvailable,
    loadInvoices,
    invoices,
    invoicePaginationData,
  }
}, 'injected-payment-store')

export { useProvidePaymentStore }

export function usePaymentStoreOrThrow() {
  const injectedPaymentStore = usePaymentStore()

  if (injectedPaymentStore == null) throw new Error('usePaymentStore is not provided')

  return injectedPaymentStore
}
