<script lang="ts" setup>
import { PaymentState } from '#imports'

interface Props {
  workspaceId?: string
}

const props = withDefaults(defineProps<Props>(), {})

const { workspaceId } = toRefs(props)

const route = useRoute()

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

const onBack = () => {
  afterPayment.value = false
  afterPaymentState.value = null
  checkoutSession.value = null

  if (workspaceId.value) {
    navigateTo(`/account/workspace/${activeWorkspace.value.id}/settings`)
  } else {
    // Todo:
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
</script>

<template>
  <div class="h-full overflow-auto nc-scrollbar-thin">
    <div class="nc-content-max-w p-6 pb-16 flex flex-col gap-6">
      <div v-if="afterPayment">
        <div class="flex flex-col gap-6 mx-auto items-center justify-center w-[600px]">
          <template v-if="checkoutSession && checkoutSession.payment_status === 'paid'">
            <div class="border-1 border-nc-border-gray-medium rounded-xl p-4 flex gap-4 bg-nc-bg-green-light w-full">
              <GeneralIcon icon="checkFill" class="text-white h-6 w-6" />
              <div class="flex flex-col gap-1">
                <div class="text-base font-bold text-nc-content-gray">Payment Successful</div>
                <div class="text-nc-content-gray-muted">Your payment has been processed. You can now use your new plan.</div>
              </div>
            </div>

            <div class="border-1 border-nc-border-gray-medium rounded-xl p-6 flex w-full">
              <div class="flex flex-col gap-8 w-full">
                <div>
                  <div class="text-base font-bold text-nc-content-gray-emphasis">Invoice</div>

                  <div class="flex flex-col gap-2 mt-2">
                    <div class="text-sm">
                      {{ checkoutSession?.customer_details?.address?.line1 }},
                      {{ checkoutSession?.customer_details?.address?.city }},
                      {{ checkoutSession?.customer_details?.address?.state }},
                      {{ checkoutSession?.customer_details?.address?.postal_code }},
                      {{ checkoutSession?.customer_details?.address?.country }}
                    </div>
                  </div>
                </div>

                <div class="flex flex-col gap-4">
                  <div class="flex flex-col">
                    <div class="flex justify-between">
                      <div class="flex flex-col gap-1">
                        <div class="text-sm text-nc-content-gray font-semibold">
                          {{
                            activeWorkspace?.payment?.plan?.title
                              ? $t(`objects.paymentPlan.${activeWorkspace?.payment?.plan?.title}`)
                              : ''
                          }}
                          {{ $t('general.plan') }}
                        </div>
                        <div
                          v-if="activeWorkspace?.payment?.subscription?.period"
                          class="text-xs text-nc-content-gray-muted leading-[18px]"
                        >
                          {{ $t('general.paid') }}
                          {{ $t(`general.${activeWorkspace?.payment?.subscription?.period === 'year' ? 'yearly' : 'monthly'}`) }}
                        </div>
                      </div>
                      <div class="text-sm text-nc-content-gray">${{ (checkoutSession?.amount_total ?? 0) / 100 }}</div>
                    </div>
                  </div>

                  <!-- Todo: annual_saving is missing in session  -->
                  <div
                    v-if="checkoutSession?.annual_saving"
                    class="flex justify-between text-nc-content-gray text-sm font-semibold"
                  >
                    <div>{{ $t('labels.annualSavings') }}</div>
                    <div class="px-3">
                      <NcBadge :border="false" color="green" class="!text-nc-content-green-dark">
                        -${{ checkoutSession?.applicable_tax ?? 0 }}
                      </NcBadge>
                    </div>
                  </div>

                  <NcDivider class="!my-0" />

                  <!-- Todo: applicable_tax is missing in session  -->
                  <div v-if="checkoutSession?.applicable_tax" class="flex justify-between text-nc-content-gray text-sm">
                    <div>{{ $t('labels.applicableTax') }}</div>
                    <div>${{ checkoutSession?.applicable_tax ?? 0 }}</div>
                  </div>
                  <div class="flex justify-between text-nc-content-gray font-weight-700 text-base">
                    <div>{{ $t('general.total') }}</div>
                    <div>${{ (checkoutSession?.amount_total ?? 0) / 100 }}</div>
                  </div>
                </div>

                <!-- Actions -->
                <NcButton type="primary" size="medium" class="w-full" @click="onBack">
                  {{ $t('general.finish') }}
                </NcButton>
              </div>
            </div>
          </template>

          <template v-else-if="checkoutSession && checkoutSession.payment_status === 'failed'">
            <div class="border-1 border-nc-border-gray-medium rounded-xl p-4 flex gap-4 bg-nc-bg-red-light">
              <GeneralIcon icon="ncAlertCircleFilled" class="text-nc-content-red-dark h-6 w-6" />
              <div class="flex flex-col gap-1">
                <div class="text-xl font-bold text-nc-content-red-dark">Payment Failed</div>
                <div class="text-nc-content-gray-muted">
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
          <div v-else class="min-h-[256px] grid place-items-center">
            <GeneralLoader size="xlarge" />
          </div>
        </div>
      </div>
      <div v-else class="flex flex-col gap-8 w-full max-w-300 mx-auto min-w-[740px]">
        <PaymentPlanUsage v-if="!paymentInitiated" />
        <Payment v-if="paymentState" />
        <GeneralLoader v-else />
      </div>
    </div>
  </div>
</template>
