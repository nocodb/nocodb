import { type StripeCheckoutSession } from '@stripe/stripe-js'
import type Stripe from 'stripe'
import { LoyaltyPriceLookupKeyMap, type PaginatedType, PlanPriceLookupKeys, PlanTitles } from 'nocodb-sdk'

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

  const defaultInvoicePaginationData = {
    page: 1,
    pageSize: 10,
    totalRows: 0,
    isLoading: true,
    hasMore: false,
    pageCursors: [undefined],
  }

  const { $state, $api } = useNuxtApp()

  const router = useRouter()
  const route = router.currentRoute

  const { navigateToCheckout, isLoyaltyDiscountAvailable, calculatePrice } = useEeConfig()

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

  const invoicePaginationData = ref<
    PaginatedType & { isLoading?: boolean; hasMore?: boolean; pageCursors: (string | undefined)[] }
  >(defaultInvoicePaginationData)

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

    if (planTitle === PlanTitles.PLUS) {
      lookupKey = mode === 'month' ? PlanPriceLookupKeys.PLUS_MONTHLY : PlanPriceLookupKeys.PLUS_YEARLY
    }

    if (planTitle === PlanTitles.BUSINESS) {
      lookupKey = mode === 'month' ? PlanPriceLookupKeys.BUSINESS_MONTHLY : PlanPriceLookupKeys.BUSINESS_YEARLY
    }

    if (lookupKey && isLoyaltyDiscountAvailable.value && activeWorkspace.value?.segment_code !== 7) {
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
      return calculatePrice(price, workspaceSeatCount.value, mode)
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

    // if (!activeWorkspace.value?.stripe_customer_id) {
    //   return
    // }

    const page = invoicePaginationData.value.page!

    const starting_after = invoicePaginationData.value.pageCursors[page - 1]
    const nextPage_starting_after = invoicePaginationData.value.pageCursors[page]

    console.log('starting_after', starting_after, page)

    // If starting_after is not undefined, it means we have already loaded that page, so we don't need to load it again
    if (nextPage_starting_after) {
      if (!invoicePaginationData.value.hasMore) {
        invoicePaginationData.value.hasMore = true
      }

      return
    }

    const sampleInvoices = ncArrayFrom(35).map((_item, index) => {
      let inv = (defaultInvoices as any[])[0]
      return {
        ...inv,
        id: `${inv.id}-${index}`,
      }
    })

    const indexOfStartingAfter = !starting_after ? 0 : sampleInvoices.findIndex((invoice) => invoice.id === starting_after) + 1

    const resData = sampleInvoices.slice(indexOfStartingAfter, indexOfStartingAfter + invoicePaginationData.value.pageSize!)

    invoices.value = [...invoices.value, ...resData]

    if (sampleInvoices.length > indexOfStartingAfter + invoicePaginationData.value.pageSize!) {
      console.log('res', resData[resData.length - 1]?.id)
      invoicePaginationData.value.pageCursors[page] = resData[resData.length - 1]?.id
      invoicePaginationData.value.hasMore = true
    } else {
      invoicePaginationData.value.hasMore = false
      invoicePaginationData.value.pageCursors[page] = resData[resData.length - 1]?.id
    }

    invoicePaginationData.value.isLoading = false

    return

    try {
      const res = (await $fetch(`/api/payment/${activeWorkspaceId.value}/invoice`, {
        baseURL,
        method: 'GET',
        headers: { 'xc-auth': $state.token.value as string },
        query: {
          starting_after,
        },
      })) as Stripe.ApiList<Stripe.Invoice>

      const resData = res?.data || []

      invoices.value = [...invoices.value, ...resData]

      invoicePaginationData.value.pageCursors[page] = res?.data[res?.data.length - 1]?.id
      invoicePaginationData.value.hasMore = res?.has_more ?? false
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

  const onSelectPlan = (plan: PaymentPlan, showPaymentMode: boolean = false) => {
    navigateToCheckout(plan.id, paymentMode.value, undefined, undefined, showPaymentMode)
  }

  watch(
    activeWorkspaceId,
    async () => {
      if (route.value.name === 'upgrade' || !activeWorkspaceId.value) return

      await loadWorkspaceSeatCount()
    },
    { immediate: true },
  )

  return {
    annualDiscount,
    defaultInvoicePaginationData,
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

var defaultInvoices = [
  {
    id: 'in_1Rl7hWHD4gpGs9K6Vn3AOwGl',
    object: 'invoice',
    account_country: 'US',
    account_name: 'Staging',
    account_tax_ids: null,
    amount_due: 28800,
    amount_overpaid: 0,
    amount_paid: 28800,
    amount_remaining: 0,
    amount_shipping: 0,
    application: null,
    attempt_count: 0,
    attempted: true,
    auto_advance: false,
    automatic_tax: {
      disabled_reason: null,
      enabled: true,
      liability: {
        type: 'self',
      },
      provider: 'stripe',
      status: 'complete',
    },
    automatically_finalizes_at: null,
    billing_reason: 'subscription_create',
    collection_method: 'charge_automatically',
    created: 1752581472,
    currency: 'usd',
    custom_fields: [
      {
        name: 'NocoDB Workspace ID',
        value: 'wgk627qm',
      },
      {
        name: 'NocoDB Workspace Title',
        value: 'Ramesh',
      },
    ],
    customer: 'cus_SgUgrbbTal7NVD',
    customer_address: {
      city: 'PUNE',
      country: 'IN',
      line1: 'HQG4+C8G, Mahalunge, Pune, Maharashtra 411045, India',
      line2: null,
      postal_code: '411045',
      state: 'MH',
    },
    customer_email: 'ramesh@nocodb.com',
    customer_name: 'Ramesh Vithoba Mane',
    customer_phone: null,
    customer_shipping: null,
    customer_tax_exempt: 'none',
    customer_tax_ids: [],
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discounts: [],
    due_date: null,
    effective_at: 1752581472,
    ending_balance: 0,
    footer: null,
    from_invoice: null,
    hosted_invoice_url:
      'https://invoice.stripe.com/i/acct_1RebOfHD4gpGs9K6/test_YWNjdF8xUmViT2ZIRDRncEdzOUs2LF9TZ1VnZDRuTUYzRWF1VU9QRndHSFhRN1E1eTB0Q1NmLDE0NjY2NTc3OQ0200oDAZ6ZrZ?s=ap',
    invoice_pdf:
      'https://pay.stripe.com/invoice/acct_1RebOfHD4gpGs9K6/test_YWNjdF8xUmViT2ZIRDRncEdzOUs2LF9TZ1VnZDRuTUYzRWF1VU9QRndHSFhRN1E1eTB0Q1NmLDE0NjY2NTc3OQ0200oDAZ6ZrZ/pdf?s=ap',
    issuer: {
      type: 'self',
    },
    last_finalization_error: null,
    latest_revision: null,
    lines: {
      object: 'list',
      data: [
        {
          id: 'il_1Rl7hUHD4gpGs9K6R6pJNmHZ',
          object: 'line_item',
          amount: 28800,
          currency: 'usd',
          description: '2 × Plus (Tier 1 at $144.00 / year)',
          discount_amounts: [],
          discountable: true,
          discounts: [],
          invoice: 'in_1Rl7hWHD4gpGs9K6Vn3AOwGl',
          livemode: false,
          metadata: {
            fk_plan_id: 'pltyww2ds5n3sbdm',
            fk_user_id: 'uspck40ftp1krcsk',
            fk_workspace_id: 'wgk627qm',
            period: 'year',
            plan_title: 'Plus',
          },
          parent: {
            invoice_item_details: null,
            subscription_item_details: {
              invoice_item: null,
              proration: false,
              proration_details: {
                credited_items: null,
              },
              subscription: 'sub_1Rl7hWHD4gpGs9K6GA8XjXXj',
              subscription_item: 'si_SgUg7zdlS5CEgE',
            },
            type: 'subscription_item_details',
          },
          period: {
            end: 1784117472,
            start: 1752581472,
          },
          pretax_credit_amounts: [],
          pricing: {
            price_details: {
              price: 'price_1ReyiEHD4gpGs9K6OMOa3LcV',
              product: 'prod_Sa90mMRlbNFYWj',
            },
            type: 'price_details',
            unit_amount_decimal: '14400',
          },
          quantity: 2,
          taxes: [
            {
              amount: 0,
              tax_behavior: 'exclusive',
              tax_rate_details: {
                tax_rate: 'txr_1RfKauHD4gpGs9K6jlcH5huo',
              },
              taxability_reason: 'not_collecting',
              taxable_amount: 0,
              type: 'tax_rate_details',
            },
          ],
        },
      ],
      has_more: true,
      url: '/v1/invoices/in_1Rl7hWHD4gpGs9K6Vn3AOwGl/lines',
    },
    livemode: false,
    metadata: {},
    next_payment_attempt: null,
    number: 'HD5X5ER8-0001',
    on_behalf_of: null,
    parent: {
      quote_details: null,
      subscription_details: {
        metadata: {
          fk_plan_id: 'pltyww2ds5n3sbdm',
          fk_user_id: 'uspck40ftp1krcsk',
          fk_workspace_id: 'wgk627qm',
          period: 'year',
          plan_title: 'Plus',
        },
        subscription: 'sub_1Rl7hWHD4gpGs9K6GA8XjXXj',
      },
      type: 'subscription_details',
    },
    payment_settings: {
      default_mandate: null,
      payment_method_options: {
        acss_debit: null,
        bancontact: null,
        card: {
          request_three_d_secure: 'automatic',
        },
        customer_balance: null,
        konbini: null,
        sepa_debit: null,
        us_bank_account: null,
      },
      payment_method_types: null,
    },
    period_end: 1752581472,
    period_start: 1752581472,
    post_payment_credit_notes_amount: 0,
    pre_payment_credit_notes_amount: 0,
    receipt_number: null,
    rendering: {
      amount_tax_display: null,
      pdf: null,
      template: null,
      template_version: null,
    },
    shipping_cost: null,
    shipping_details: null,
    starting_balance: 0,
    statement_descriptor: null,
    status: 'paid',
    status_transitions: {
      finalized_at: 1752581472,
      marked_uncollectible_at: null,
      paid_at: 1752581473,
      voided_at: null,
    },
    subtotal: 28800,
    subtotal_excluding_tax: 28800,
    test_clock: null,
    total: 28800,
    total_discount_amounts: [],
    total_excluding_tax: 28800,
    total_pretax_credit_amounts: [],
    total_taxes: [
      {
        amount: 0,
        tax_behavior: 'exclusive',
        tax_rate_details: {
          tax_rate: 'txr_1RfKauHD4gpGs9K6jlcH5huo',
        },
        taxability_reason: 'not_collecting',
        taxable_amount: 0,
        type: 'tax_rate_details',
      },
    ],
    webhooks_delivered_at: 1752581472,
  },
]
