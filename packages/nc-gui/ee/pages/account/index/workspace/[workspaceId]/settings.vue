<script lang="ts" setup>
import { PaymentState } from '#imports'

const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() => workspacesList.value.find((w) => w.id === workspaceId.value)!)

const { paymentState, loadPlans, stripe, getSessionResult } = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

const afterPayment = ref(false)

const afterPaymentState = ref<{ session_id: string } | null>(null)

/*
  {
    "id": "cs_test_a1PpsPkHwb75rYXD14et6fksvWotYbUsWeKYsmVULxcxLozL66GPltfclC",
    "object": "checkout.session",
    "adaptive_pricing": null,
    "after_expiration": null,
    "allow_promotion_codes": null,
    "amount_subtotal": 12000,
    "amount_total": 12000,
    "automatic_tax": {
        "enabled": true,
        "liability": {
            "type": "self"
        },
        "status": "complete"
    },
    "billing_address_collection": "required",
    "cancel_url": null,
    "client_reference_id": null,
    "client_secret": null,
    "collected_information": {
        "shipping_details": null
    },
    "consent": null,
    "consent_collection": null,
    "created": 1742210473,
    "currency": "usd",
    "currency_conversion": null,
    "custom_fields": [],
    "custom_text": {
        "after_submit": null,
        "shipping_address": null,
        "submit": null,
        "terms_of_service_acceptance": null
    },
    "customer": "cus_RwpRQN65Xsnahn",
    "customer_creation": null,
    "customer_details": {
        "address": {
            "city": "Nilüfer",
            "country": "TR",
            "line1": "N",
            "line2": null,
            "postal_code": "16340",
            "state": "Bursa"
        },
        "email": "test@test.test",
        "name": "Mert Ersoy",
        "phone": null,
        "tax_exempt": "none",
        "tax_ids": []
    },
    "customer_email": null,
    "discounts": [],
    "expires_at": 1742296873,
    "invoice": "in_1R3bjpHU2WPCjTxwBOt1RA23",
    "invoice_creation": null,
    "livemode": false,
    "locale": null,
    "metadata": {},
    "mode": "subscription",
    "payment_intent": null,
    "payment_link": null,
    "payment_method_collection": "always",
    "payment_method_configuration_details": {
        "id": "pmc_1QhRpQHU2WPCjTxwu8FgZcFP",
        "parent": null
    },
    "payment_method_options": {
        "card": {
            "request_three_d_secure": "automatic"
        }
    },
    "payment_method_types": [
        "card",
        "link",
        "cashapp",
        "amazon_pay"
    ],
    "payment_status": "paid",
    "phone_number_collection": {
        "enabled": false
    },
    "recovered_from": null,
    "redirect_on_completion": "always",
    "return_url": "http://localhost:3000/?afterPayment=true&workspaceId=w4fkhwo4&session_id={CHECKOUT_SESSION_ID}",
    "saved_payment_method_options": {
        "allow_redisplay_filters": [
            "always"
        ],
        "payment_method_remove": null,
        "payment_method_save": null
    },
    "setup_intent": null,
    "shipping_address_collection": null,
    "shipping_cost": null,
    "shipping_details": null,
    "shipping_options": [],
    "status": "complete",
    "submit_type": null,
    "subscription": "sub_1R3bjpHU2WPCjTxwh6AlYj1j",
    "success_url": null,
    "tax_id_collection": {
        "enabled": true,
        "required": "never"
    },
    "total_details": {
        "amount_discount": 0,
        "amount_shipping": 0,
        "amount_tax": 0
    },
    "ui_mode": "embedded",
    "url": null
}
*/

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

const onBack = () => {
  afterPayment.value = false
  afterPaymentState.value = null
  checkoutSession.value = null

  navigateTo(`/account/workspace/${activeWorkspace.value.id}/settings`)
}

onMounted(() => {
  workspaceStore.loadWorkspace(workspaceId.value).then(() => {
    loadPlans().then(() => {
      paymentState.value = PaymentState.SELECT_PLAN
    })
  })

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
</script>

<template>
  <div class="h-full">
    <div class="flex flex-col">
      <NcPageHeader>
        <template #icon>
          <GeneralIcon icon="ncDollarSign" class="flex-none text-gray-700 text-[20px] h-5 w-5" />
        </template>
        <template #title>
          <span data-rec="true"> Billing </span>
        </template>
      </NcPageHeader>
      <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
        <div v-if="afterPayment">
          <div class="flex flex-col gap-6 mx-auto items-center justify-center">
            <template v-if="checkoutSession && checkoutSession.payment_status === 'paid'">
              <div class="border-1 border-nc-border-gray-medium rounded-lg p-6 flex gap-2 bg-green-50">
                <GeneralIcon icon="checkFill" class="text-white h-8 w-8" />
                <div class="flex flex-col gap-2">
                  <div class="text-xl font-bold">Payment Successful</div>
                  <div class="text-nc-content-gray-subtle2">
                    Your payment has been successfully processed. You can now start using the new plan.
                  </div>
                </div>
              </div>

              <div class="border-1 border-nc-border-gray-medium rounded-lg p-6 flex w-full">
                <div class="flex flex-col gap-2 w-full">
                  <div class="text-lg font-bold">Invoice</div>

                  <div class="flex flex-col gap-2">
                    <div class="text-sm">
                      {{ checkoutSession?.customer_details?.address?.line1 }},
                      {{ checkoutSession?.customer_details?.address?.city }},
                      {{ checkoutSession?.customer_details?.address?.state }},
                      {{ checkoutSession?.customer_details?.address?.postal_code }},
                      {{ checkoutSession?.customer_details?.address?.country }}
                    </div>
                  </div>

                  <div class="flex flex-col my-4">
                    <div class="flex justify-between">
                      <div class="flex flex-col">
                        <div class="text-sm">{{ activeWorkspace?.payment?.plan?.title ?? 'Plan' }}</div>
                        <div v-if="activeWorkspace?.payment?.subscription?.period" class="text-sm text-nc-content-gray-subtle2">
                          Paid {{ activeWorkspace?.payment?.subscription?.period === 'year' ? 'Yearly' : 'Monthly' }}
                        </div>
                      </div>
                      <div class="text-sm">${{ (checkoutSession?.amount_total ?? 0) / 100 }}</div>
                    </div>
                  </div>

                  <NcDivider class="!py-1" />

                  <div class="flex justify-between">
                    <div class="text-sm">Total</div>
                    <div class="text-sm">${{ (checkoutSession?.amount_total ?? 0) / 100 }}</div>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <NcButton type="primary" class="w-full" @click="navigateTo(`/${activeWorkspace?.id}`)">
                <div class="flex items-center justify-center gap-2">
                  <GeneralIcon icon="ncArrowRight" class="h-4 w-4" />
                  <span>Go to Workspace</span>
                </div>
              </NcButton>

              <NcButton type="ghost" class="w-full" @click="onBack">
                <div class="flex items-center justify-center gap-1">
                  <span>Go Back</span>
                </div>
              </NcButton>
            </template>

            <template v-else-if="checkoutSession && checkoutSession.payment_status === 'failed'">
              <div class="border-1 border-red-500 rounded-lg p-6 flex gap-2 bg-red-50">
                <GeneralIcon icon="close" class="text-red-500 h-8 w-8" />
                <div class="flex flex-col gap-2">
                  <div class="text-xl font-bold text-red-600">Payment Failed</div>
                  <div class="text-nc-content-gray-subtle2">
                    Something went wrong while processing your payment. Please try again or contact support.
                  </div>
                </div>
              </div>

              <NcButton type="ghost" class="w-full" @click="onBack">
                <div class="flex items-center justify-center gap-1">
                  <span>Go Back & Retry</span>
                </div>
              </NcButton>
            </template>

            <!-- Loader while fetching session -->
            <GeneralLoader v-else size="large" />
          </div>
        </div>
        <div v-else class="flex flex-col gap-6 w-full max-w-300 mx-auto">
          <div v-if="!paymentInitiated" class="text-base font-bold">Current Plan</div>
          <PaymentPlanUsage v-if="!paymentInitiated" />
          <Payment v-if="paymentState" />
          <GeneralLoader v-else />
        </div>
      </div>
    </div>
  </div>
</template>
