import type Stripe from 'stripe'
import type { PaginatedType, PlanAddonTypes } from 'nocodb-sdk'
import { OnPremPlanPriceLookupKeys, OnPremPlanTitles } from 'nocodb-sdk'

export type OnPremInvoice = Stripe.Invoice & { license_key_masked?: string | null }

// Minimal add-on catalog shape (from /api/public/payment/addon) needed to label
// add-on invoice lines by their catalog name instead of the base plan.
interface OnPremAddonCatalogItem {
  addon_key: PlanAddonTypes
  stripe_product_id: string
}

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
  meta: {
    instance_id?: string
    instance_url?: string
    [key: string]: any
  }
  config: Record<string, any>
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
  const { token } = useGlobal()

  const baseURL = $api.instance.defaults.baseURL

  const licenses = ref<OnPremLicense[]>([])

  const plans = ref<OnPremPlan[]>([])

  const isLoading = ref(false)

  const paymentMode = ref<'year' | 'month'>('year')

  const defaultInvoicePaginationData = {
    page: 1,
    pageSize: 10,
    totalRows: 0,
    isLoading: true,
    hasMore: false,
    pageCursors: [undefined] as (string | undefined)[],
  }

  const invoices = ref<OnPremInvoice[]>([])

  const addonsCatalog = ref<OnPremAddonCatalogItem[]>([])

  const invoicePaginationData = ref<
    PaginatedType & { isLoading?: boolean; hasMore?: boolean; pageCursors: (string | undefined)[] }
  >({ ...defaultInvoicePaginationData, pageCursors: [undefined] })

  const hasAnySubscription = computed(() => licenses.value.some((l) => !!l.subscription))

  const fetchHeaders = computed(() => ({
    'xc-auth': token.value as string,
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
      message.toast(await extractSdkResponseErrorMsg(e))
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
      message.toast(await extractSdkResponseErrorMsg(e))
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
      message.toast(await extractSdkResponseErrorMsg(e))
      return null
    }
  }

  const createCheckoutSession = async (payload: {
    plan_id: string
    price_id: string
    quantity?: number
    instance_url?: string
    instance_id?: string
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
      message.toast(await extractSdkResponseErrorMsg(e))
    }
  }

  const TITLE_TO_LOOKUP_KEYS: Record<string, { monthly: string; yearly: string }> = {
    [OnPremPlanTitles.SELF_HOSTED_BUSINESS]: {
      monthly: OnPremPlanPriceLookupKeys.BUSINESS_MONTHLY,
      yearly: OnPremPlanPriceLookupKeys.BUSINESS_YEARLY,
    },
    [OnPremPlanTitles.SELF_HOSTED_SCALE]: {
      monthly: OnPremPlanPriceLookupKeys.SCALE_MONTHLY,
      yearly: OnPremPlanPriceLookupKeys.SCALE_YEARLY,
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

  const loadInvoices = async () => {
    if (!hasAnySubscription.value) {
      invoicePaginationData.value.isLoading = false
      return
    }

    const page = invoicePaginationData.value.page!
    const starting_after = invoicePaginationData.value.pageCursors[page - 1]
    const nextPage_starting_after = invoicePaginationData.value.pageCursors[page]

    if (nextPage_starting_after) {
      if (!invoicePaginationData.value.hasMore) {
        invoicePaginationData.value.hasMore = true
      }
      return
    }

    try {
      const res = await $fetch<Stripe.ApiList<OnPremInvoice>>('/api/payment/on-premise/invoices', {
        baseURL,
        method: 'GET',
        headers: fetchHeaders.value,
        query: { starting_after },
      })

      const resData = res?.data || []
      invoices.value = [...invoices.value, ...resData]

      invoicePaginationData.value.pageCursors[page] = res?.data[res?.data.length - 1]?.id
      invoicePaginationData.value.hasMore = res?.has_more ?? false
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      invoicePaginationData.value.isLoading = false
    }
  }

  const loadAddons = async () => {
    try {
      const addons = await $fetch<OnPremAddonCatalogItem[]>('/api/public/payment/addon', {
        baseURL,
        method: 'GET',
        headers: fetchHeaders.value,
      })

      addonsCatalog.value = addons ?? []
    } catch {
      // Non-fatal — invoice labels just fall back to the base-plan label.
      addonsCatalog.value = []
    }
  }

  const getCustomerPortal = async (): Promise<{ url: string } | null> => {
    try {
      return await $fetch('/api/payment/on-premise/customer-portal', {
        baseURL,
        method: 'GET',
        headers: fetchHeaders.value,
      })
    } catch (e: any) {
      message.toast(await extractSdkResponseErrorMsg(e))
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
    invoices,
    invoicePaginationData,
    defaultInvoicePaginationData,
    hasAnySubscription,
    loadInvoices,
    addonsCatalog,
    loadAddons,
  }
})
