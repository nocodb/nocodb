<script lang="ts" setup>
import type { PaymentIntentResult } from '@stripe/stripe-js'
import { PaymentState } from '#imports'

const route = useRoute()

const workspaceStore = useWorkspace()

const { workspacesList } = storeToRefs(workspaceStore)

const workspaceId = computed(() => route.params.workspaceId)

const activeWorkspace = computed(() => workspacesList.value.find((w) => w.id === workspaceId.value)!)

const { paymentState, loadPlans, stripe } = useProvidePaymentStore()

const paymentInitiated = computed(() => paymentState.value === PaymentState.PAYMENT)

// http://localhost:3000/#/account/workspace/wssow78u/billing?afterPayment=true&workspaceId=wssow78u&payment_intent=pi_3R2UyTHU2WPCjTxw0UYh7aLw&payment_intent_client_secret=pi_3R2UyTHU2WPCjTxw0UYh7aLw_secret_bYWoXFKVrmHrAsxj0MkB1k262&redirect_status=succeeded

const afterPayment = ref(false)

const afterPaymentState = ref<{ payment_intent: string; payment_intent_client_secret: string } | null>(null)

const paymentIntentResult = ref<PaymentIntentResult | null>(null)

const getPaymentIntent = async () => {
  if (!afterPayment.value || !afterPaymentState.value) {
    return
  }

  await until(() => !!stripe.value).toBeTruthy()

  const { payment_intent_client_secret: paymentIntentClientSecret } = afterPaymentState.value

  const paymentIntent = await stripe.value!.retrievePaymentIntent(paymentIntentClientSecret)

  paymentIntentResult.value = paymentIntent
}

const onBack = () => {
  afterPayment.value = false
  afterPaymentState.value = null
  paymentIntentResult.value = null

  navigateTo(`/account/workspace/${activeWorkspace.value?.id}/billing`)
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
      payment_intent: route.query.payment_intent as string,
      payment_intent_client_secret: route.query.payment_intent_client_secret as string,
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
      <div class="nc-content-max-w py-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
        <div v-if="afterPayment">
          <div class="flex flex-col gap-6 w-150 mx-auto items-center justify-center">
            <template v-if="paymentIntentResult">
              <div class="border-1 border-nc-border-gray-medium rounded-lg p-6 flex gap-2">
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
                  <div class="text-sm">Address Placeholder</div>
                  <div class="flex flex-col my-4">
                    <div class="flex justify-between">
                      <div class="flex flex-col">
                        <div class="text-sm">{{ activeWorkspace?.payment?.plan.title }}</div>
                        <div v-if="activeWorkspace?.payment?.subscription?.period" class="text-sm text-nc-content-gray-subtle2">
                          Paid {{ activeWorkspace?.payment?.subscription?.period === 'year' ? 'Yearly' : 'Monthly' }}
                        </div>
                      </div>
                      <div class="text-sm">${{ (paymentIntentResult?.paymentIntent?.amount ?? 0) / 100 }}</div>
                    </div>
                  </div>
                  <NcDivider class="!py-1" />
                  <div class="flex justify-between">
                    <div class="text-sm">Total</div>
                    <div class="text-sm">${{ (paymentIntentResult?.paymentIntent?.amount ?? 0) / 100 }}</div>
                  </div>
                </div>
              </div>
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
            <GeneralLoader v-else size="large" />
          </div>
        </div>
        <div v-else class="flex flex-col gap-6 w-300 mx-auto">
          <div v-if="!paymentInitiated" class="text-base font-bold">Current Plan</div>
          <div
            v-if="!paymentInitiated"
            class="flex flex-col rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight p-6 gap-4"
          >
            <div class="text-2xl font-bold">{{ activeWorkspace?.payment?.plan.title }}</div>
            <div class="flex items-center border-1 border-nc-border-gray-medium rounded-lg w-[fit-content]">
              <div class="w-[300px] flex flex-col p-4 gap-2 border-r-1">
                <div class="flex items-center gap-2 text-nc-content-gray text-2xl font-bold">
                  {{ activeWorkspace?.stats?.row_count ?? 0 }} <span class="text-base">of</span>
                  <span class="text-base">{{ activeWorkspace?.payment?.plan.meta.limit_workspace_row }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-2 bg-nc-border-gray-medium rounded-lg">
                    <div
                      class="h-full bg-brand-500 rounded-lg"
                      :style="{
                        width: `${
                          ((activeWorkspace?.stats?.row_count ?? 0) /
                            (activeWorkspace?.payment?.plan.meta.limit_workspace_row ?? 1)) *
                          100
                        }%`,
                      }"
                    ></div>
                  </div>
                </div>
                <div class="flex items-center text-nc-content-gray-subtle2 text-sm">Number of records</div>
              </div>
              <div class="w-[300px] flex flex-col p-4 gap-2">
                <div class="flex items-center gap-2 text-nc-content-gray text-2xl font-bold">
                  {{ (activeWorkspace?.stats?.storage ?? 0) / 1024 }} <span class="text-base">of</span>
                  <span class="text-base">{{ activeWorkspace?.payment?.plan.meta.limit_storage / 1024 }}GB</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-2 bg-nc-border-gray-medium rounded-lg">
                    <div
                      class="h-full bg-brand-500 rounded-lg"
                      :style="{
                        width: `${
                          ((activeWorkspace?.stats?.storage ?? 0) /
                            1024 /
                            ((activeWorkspace?.payment?.plan.meta.limit_storage ?? 1) / 1024)) *
                          100
                        }%`,
                      }"
                    ></div>
                  </div>
                </div>
                <div class="flex items-center text-nc-content-gray-subtle2 text-sm">Storage</div>
              </div>
            </div>
          </div>
          <Payment v-if="paymentState" />
          <GeneralLoader v-else />
        </div>
      </div>
    </div>
  </div>
</template>
