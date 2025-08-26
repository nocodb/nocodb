<script lang="ts" setup>
import { PaymentState } from '#imports'
import { ReturnToBillingPage } from 'nocodb-sdk'

interface Props {
  workspaceId?: string
}

const props = withDefaults(defineProps<Props>(), {})

const { workspaceId } = toRefs(props)

const isOrgBilling = inject(IsOrgBillingInj, ref(false))

const route = useRoute()

const router = useRouter()

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const {
  paymentState,
  loadWorkspaceOrOrgSeatCount,
  getSessionResult,
  returnToPage,
  paymentMode,
  plansAvailable,
  onSelectPlan,
  invoices,
} = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

const afterUpgrade = ref(!!route.query.afterUpgrade)

const afterPayment = ref(!!route.query.afterPayment)

const afterPaymentState = ref<{ session_id: string } | null>(null)

const checkoutSession = ref<any>(null)

const getPaymentIntent = async () => {
  if (!afterPayment.value || !afterPaymentState.value) {
    return
  }

  const { session_id } = afterPaymentState.value

  const session = await getSessionResult(session_id)

  checkoutSession.value = session
}

const onClosePaymentBanner = () => {
  afterUpgrade.value = false
  afterPayment.value = false
  afterPaymentState.value = null
  checkoutSession.value = null

  if (workspaceId.value) {
    router.replace({ query: {} })
  } else {
    router.replace({ query: { tab: route?.query?.tab || 'billing' } })
  }
}

onMounted(async () => {
  if (!isOrgBilling.value && (workspaceId.value || activeWorkspaceId.value)) {
    await workspaceStore.loadWorkspace(workspaceId.value || activeWorkspaceId.value!)
  }

  paymentState.value = PaymentState.SELECT_PLAN

  if (isOrgBilling.value) {
    returnToPage.value = ReturnToBillingPage.ORG
  } else if (!!workspaceId.value) {
    returnToPage.value = ReturnToBillingPage.ACCOUNT
  } else {
    returnToPage.value = ReturnToBillingPage.WS
  }

  if (route.query.pay === 'true') {
    const planTitle = route.query.plan as string
    const plan = plansAvailable.value.find((p) => p.title === planTitle)

    paymentMode.value = route.query.paymentMode === 'month' ? 'month' : 'year'

    if (plan) {
      onSelectPlan(plan)
    }

    paymentState.value = PaymentState.PAYMENT
  }

  if (route.query.afterPayment) {
    afterPayment.value = true
  }

  if (afterPayment.value) {
    afterPaymentState.value = {
      session_id: route.query.session_id as string,
    }

    getPaymentIntent()
  }

  if (route.query.afterUpgrade) {
    afterUpgrade.value = true
  }
})

const isScrolledToTop = ref(true)

const handleScroll = (e) => {
  if (e.target?.scrollTop <= 0) {
    isScrolledToTop.value = true
  } else {
    isScrolledToTop.value = false
  }
}

watch(
  () => route?.query?.tab,
  async (tab) => {
    if (tab !== 'billing' || isOrgBilling.value) return

    await workspaceStore.loadWorkspace(workspaceId.value || activeWorkspaceId.value!)

    await loadWorkspaceOrOrgSeatCount()
  },
)
</script>

<template>
  <div
    class="nc-payment-billing-page h-full overflow-auto nc-scrollbar-thin text-nc-content-gray max-h-[calc(100vh_-_92px)]"
    :class="{
      'nc-scrolled-to-bottom': !isScrolledToTop,
    }"
    @scroll.passive="handleScroll"
  >
    <PaymentBanner v-if="!isOrgBilling" />
    <div>
      <div
        class="p-6 pb-16 flex flex-col gap-8 min-w-[740px] w-full"
        :class="{
          'max-w-[1200px] mx-auto': paymentState !== PaymentState.PAYMENT,
        }"
      >
        <template v-if="!paymentInitiated">
          <PaymentPlanUsage v-if="!afterPayment || !!checkoutSession">
            <template #header>
              <template v-if="afterPayment && checkoutSession">
                <NcAlert
                  v-if="checkoutSession.payment_status === 'paid'"
                  :visible="afterPayment"
                  closable
                  type="success"
                  show-icon
                  class="!rounded-xl bg-nc-bg-green-light"
                  :message="$t('msg.success.paymentSuccessful')"
                  :description="$t('msg.success.paymentSuccessfulSubtitle')"
                  @close="onClosePaymentBanner"
                >
                  <template v-if="checkoutSession?.invoice?.invoice_pdf" #action>
                    <a
                      :href="checkoutSession?.invoice?.invoice_pdf"
                      target="_blank"
                      rel="noopener noreferer"
                      class="!no-underline !hover:underline text-sm font-700"
                    >
                      {{ $t('labels.downloadInvoice') }}
                    </a>
                  </template>
                </NcAlert>
                <NcAlert
                  v-else-if="checkoutSession.payment_status === 'failed'"
                  :visible="afterPayment"
                  closable
                  type="error"
                  show-icon
                  class="!rounded-xl bg-nc-bg-red-light"
                  :message="$t('msg.error.paymentFailed')"
                  :description="$t('msg.error.paymentFailedSubtitle')"
                  @close="onClosePaymentBanner"
                >
                </NcAlert>
              </template>
              <NcAlert
                v-else-if="afterUpgrade"
                closable
                type="success"
                show-icon
                class="!rounded-xl bg-nc-bg-green-light"
                :message="$t('msg.success.upgradeSuccessful')"
                :description="$t('msg.success.upgradeSuccessfulSubtitle')"
                @close="onClosePaymentBanner"
              >
                <template v-if="invoices?.[0]?.invoice_pdf" #action>
                  <a
                    :href="invoices?.[0]?.invoice_pdf"
                    target="_blank"
                    rel="noopener noreferer"
                    class="!no-underline !hover:underline text-sm font-700"
                  >
                    {{ $t('labels.downloadInvoice') }}
                  </a>
                </template>
              </NcAlert>
            </template>
          </PaymentPlanUsage>
        </template>

        <Payment v-if="paymentState && (!afterPayment || !!checkoutSession)" />
        <div v-else class="min-h-[80dvh] grid place-items-center">
          <GeneralLoader size="xlarge" />
        </div>
      </div>
    </div>
  </div>
</template>
