import { OnPremPlanPriceLookupKeys, OnPremPlanTitles } from 'nocodb-sdk'

interface OnPremPlanPriceTier {
  unit_amount: number
  flat_amount: number
  up_to: number | null
}

interface OnPremPlanPrice {
  id: string
  lookup_key: string
  unit_amount: number | null
  billing_scheme: 'per_unit' | 'tiered'
  tiers_mode?: 'volume' | 'graduated'
  tiers?: OnPremPlanPriceTier[]
  recurring: {
    interval: 'month' | 'year'
  }
}

interface OnPremPlan {
  id: string
  title: OnPremPlanTitles
  descriptions?: string[]
  prices: OnPremPlanPrice[]
}

interface OnPremLicense {
  id: string
  license_key: string
  licensed_to: string
  license_type: string
  status: string
  seat_count: number
  min_seats: number
  expires_at: string | null
  created_at: string
  meta: Record<string, any>
  plan: {
    id: string
    title: OnPremPlanTitles
  } | null
  subscription: {
    id: string
    status: string
    period: string
  } | null
}

export const useOnPremLicense = createSharedComposable(() => {
  const { $api } = useNuxtApp()
  const { $state } = useNuxtApp()

  const baseURL = $api.instance.defaults.baseURL

  const licenses = ref<OnPremLicense[]>([])

  const plans = ref<OnPremPlan[]>([])

  const isLoading = ref(false)

  const paymentMode = ref<'year' | 'month'>('year')

  const fetchHeaders = computed(() => ({
    'xc-auth': $state.token.value as string,
  }))

  const listLicenses = async () => {
    isLoading.value = true
    try {
      licenses.value = await $fetch('/api/payment/on-premise/licenses', {
        baseURL,
        method: 'GET',
        headers: fetchHeaders.value,
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  const syncLicenses = async () => {
    try {
      const result = await $fetch<{ synced: number }>('/api/payment/on-premise/sync', {
        baseURL,
        method: 'POST',
        headers: fetchHeaders.value,
      })
      if (result.synced > 0) {
        await listLicenses()
      }
      return result.synced
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return 0
    }
  }

  const getLicense = async (licenseId: string): Promise<OnPremLicense | null> => {
    try {
      return await $fetch(`/api/payment/on-premise/licenses/${licenseId}`, {
        baseURL,
        method: 'GET',
        headers: fetchHeaders.value,
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return null
    }
  }

  const createCheckoutSession = async (payload: {
    plan_id: string
    price_id: string
    quantity?: number
    instance_url?: string
  }) => {
    return await $fetch('/api/payment/on-premise/create-checkout', {
      baseURL,
      method: 'POST',
      headers: fetchHeaders.value,
      body: payload,
    })
  }

  const getCheckoutSession = async (sessionId: string) => {
    return await $fetch(`/api/payment/on-premise/get-session-result/${sessionId}`, {
      baseURL,
      method: 'GET',
      headers: fetchHeaders.value,
    })
  }

  const loadPlans = async () => {
    try {
      const allPlans: OnPremPlan[] = await $fetch('/api/public/payment/plan', {
        baseURL,
        method: 'GET',
        headers: fetchHeaders.value,
      })

      // Filter to on-prem plans (those with on_prem price lookup keys)
      const onPremLookupKeys = new Set(Object.values(OnPremPlanPriceLookupKeys))
      plans.value = allPlans.filter((p) => p.prices?.some((price) => onPremLookupKeys.has(price.lookup_key as any)))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const TITLE_TO_LOOKUP_KEYS: Record<string, { monthly: string; yearly: string }> = {
    // Legacy
    [OnPremPlanTitles.ENTERPRISE_STARTER]: {
      monthly: OnPremPlanPriceLookupKeys.STARTER_MONTHLY,
      yearly: OnPremPlanPriceLookupKeys.STARTER_YEARLY,
    },
    // New 3-tier
    [OnPremPlanTitles.SELF_HOSTED_PLUS]: {
      monthly: OnPremPlanPriceLookupKeys.PLUS_MONTHLY,
      yearly: OnPremPlanPriceLookupKeys.PLUS_YEARLY,
    },
    [OnPremPlanTitles.SELF_HOSTED_BUSINESS]: {
      monthly: OnPremPlanPriceLookupKeys.BUSINESS_MONTHLY,
      yearly: OnPremPlanPriceLookupKeys.BUSINESS_YEARLY,
    },
    [OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]: {
      monthly: OnPremPlanPriceLookupKeys.ENTERPRISE_MONTHLY,
      yearly: OnPremPlanPriceLookupKeys.ENTERPRISE_YEARLY,
    },
  }

  const getPlanPrice = (plan: OnPremPlan, mode: 'year' | 'month'): OnPremPlanPrice | null => {
    if (!plan?.prices) return null

    const lookupKeys = TITLE_TO_LOOKUP_KEYS[plan.title]
    if (!lookupKeys) return null

    const lookupKey = mode === 'year' ? lookupKeys.yearly : lookupKeys.monthly

    return plan.prices.find((p) => p.lookup_key === lookupKey) || null
  }

  const getPlanPriceAmount = (plan: OnPremPlan, mode?: 'year' | 'month'): number => {
    const effectiveMode = mode || paymentMode.value
    const price = getPlanPrice(plan, effectiveMode)
    if (!price) return 0

    let amount: number

    // Tiered pricing (volume) — show the first-tier per-seat price
    if (price.billing_scheme === 'tiered' && price.tiers?.length) {
      const firstTier = price.tiers[0]
      amount = ((firstTier.unit_amount || 0) + (firstTier.flat_amount || 0)) / 100
    } else {
      amount = (price.unit_amount || 0) / 100
    }

    return effectiveMode === 'year' ? Math.round(amount / 12) : amount
  }

  const getCustomerPortal = async (): Promise<{ url: string } | null> => {
    try {
      return await $fetch('/api/payment/on-premise/customer-portal', {
        baseURL,
        method: 'GET',
        headers: fetchHeaders.value,
      })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return null
    }
  }

  return {
    licenses,
    plans,
    isLoading,
    paymentMode,
    listLicenses,
    syncLicenses,
    getLicense,
    loadPlans,
    getPlanPrice,
    getPlanPriceAmount,
    createCheckoutSession,
    getCheckoutSession,
    getCustomerPortal,
  }
})
