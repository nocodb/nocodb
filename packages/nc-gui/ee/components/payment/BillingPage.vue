<script lang="ts" setup>
import { PaymentState } from '#imports'

interface Props {
  workspaceId?: string
}

const props = withDefaults(defineProps<Props>(), {})

const { workspaceId } = toRefs(props)

const route = useRoute()

const router = useRouter()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspace: _activeWorkspace } = storeToRefs(workspaceStore)

const activeWorkspace = computed(() =>
  workspaceId.value ? workspacesList.value.find((w) => w.id === workspaceId.value)! : _activeWorkspace.value!,
)

const { paymentState, loadPlans, stripe, getSessionResult, isAccountPage } = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

const afterPayment = ref(!!route.query.afterPayment)

const afterPaymentState = ref<{ session_id: string } | null>(null)

const checkoutSession = ref<any>(null)

const getPaymentIntent = async () => {
  if (!afterPayment.value || !afterPaymentState.value) {
    return
  }

  await until(() => !!stripe.value).toBeTruthy()

  const { session_id } = afterPaymentState.value

  const session = await getSessionResult(session_id)

  checkoutSession.value = session
}

const onClosePaymentBanner = () => {
  afterPayment.value = false
  afterPaymentState.value = null
  checkoutSession.value = null

  if (workspaceId.value) {
    router.replace({ query: {} })
  } else {
    router.replace({ query: { tab: route?.query?.tab || 'billing' } })
  }
}

const downloadInvoice = () => {
  if (!checkoutSession.value) {
    return
  }

  const { invoice } = checkoutSession.value

  if (invoice) {
    window.open(invoice.invoice_pdf, '_blank')
  }
}

onMounted(async () => {
  if (workspaceId.value) {
    await workspaceStore.loadWorkspace(workspaceId.value)
  }

  await loadPlans()

  paymentState.value = PaymentState.SELECT_PLAN
  isAccountPage.value = !!workspaceId.value

  if (route.query.afterPayment) {
    afterPayment.value = true
  }

  if (afterPayment.value) {
    afterPaymentState.value = {
      session_id: route.query.session_id as string,
    }

    getPaymentIntent()
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
</script>

<template>
  <div
    class="nc-payment-billing-page h-full overflow-auto nc-scrollbar-thin text-nc-content-gray"
    :class="{
      'nc-scrolled-to-bottom': !isScrolledToTop,
    }"
    @scroll.passive="handleScroll"
  >
    <div
      class="p-6 pb-16 flex flex-col gap-8 min-w-[740px] w-full"
      :class="{
        'max-w-250 mx-auto': paymentState !== PaymentState.PAYMENT,
      }"
    >
      <template v-if="!paymentInitiated">
        <template v-if="afterPayment">
          <NcAlert
            v-if="checkoutSession && checkoutSession.payment_status === 'paid'"
            :visible="afterPayment"
            closable
            type="success"
            show-icon
            class="!rounded-xl bg-nc-bg-green-light"
            :message="$t('Payment Successful')"
            :description="$t('Your payment has been processed. You can now use your new plan.')"
            @close="onClosePaymentBanner"
          >
            <template #action>
              <NcButton size="xsmall" class="!px-2" inner-class="!gap-2" @click="downloadInvoice">
                {{ $t('labels.downloadInvoice') }}
              </NcButton>
            </template>
          </NcAlert>
          <NcAlert
            v-else-if="checkoutSession && checkoutSession.payment_status === 'failed'"
            :visible="afterPayment"
            closable
            type="error"
            show-icon
            class="!rounded-xl bg-nc-bg-red-light"
            :message="$t('Payment Failed')"
            :description="$t('Something went wrong while processing your payment. Please try again or contact support.')"
            @close="onClosePaymentBanner"
          >
          </NcAlert>
          <div v-else class="min-h-[82px] grid place-items-center">
            <GeneralLoader size="xlarge" />
          </div>
        </template>

        <PaymentPlanUsage />
      </template>

      <Payment v-if="paymentState" />
      <GeneralLoader v-else size="xlarge" />
    </div>
  </div>
</template>
