<script lang="ts" setup>
import type { Stripe, StripeEmbeddedCheckout } from '@stripe/stripe-js'

const route = useRoute()

const stripe = ref<Stripe | null>(null)

const redirectRef = ref<'billing' | 'pricing' | null>(null)

const showPaymentMode = ref<boolean>(false)

const { navigateToPricing, navigateToBilling } = useEeConfig()

const {
  createPaymentForm,
  selectedPlan,
  paymentState,
  paymentMode,
  loadPlan,
  activeWorkspace,
  loadWorkspaceOrOrgSeatCount,
  annualDiscount,
  onPaymentModeChange,
  getPlanPrice,
} = useProvidePaymentStore()

const { loadStripe } = useStripe()

const isLoading = ref(false)

const checkout = ref<StripeEmbeddedCheckout | null>(null)

const onBack = () => {
  if (redirectRef.value === 'billing') {
    navigateToBilling({ isBackToBilling: true })
  } else {
    navigateToPricing({ isBackToPricing: true })
  }
}

const initializeForm = async () => {
  isLoading.value = true

  try {
    const res = (await createPaymentForm()) as {
      client_secret?: string
      recover?: boolean
    }

    if (res.recover) {
      message.info(`Your subscription has been recovered.`)
      window.location.href = `/#/${activeWorkspace.value?.id}/settings?tab=billing`
      return
    }

    // Initialize Checkout
    checkout.value = await stripe.value!.initEmbeddedCheckout({
      clientSecret: res.client_secret,
    })

    // Mount Checkout
    checkout.value.mount('#checkout')
  } catch (err: any) {
    console.log(err)
    onBack()
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  try {
    redirectRef.value = route.query?.ref === 'billing' ? 'billing' : null

    paymentMode.value = route.query?.paymentMode === 'month' ? 'month' : 'year'

    showPaymentMode.value = route.query?.showPaymentMode === 'true'

    loadStripe().then((s) => {
      stripe.value = s

      loadWorkspaceOrOrgSeatCount().then(() => {
        loadPlan(route.params.planId as string).then((plan) => {
          if (!plan) {
            navigateToPricing({ isBackToPricing: true })
            message.error('Plan not found')
            return
          }

          selectedPlan.value = plan
          paymentState.value = PaymentState.PAYMENT

          initializeForm()
        })
      })
    })
  } catch (err) {
    onBack()
  }
})

const onChangePaymentMode = (mode: 'month' | 'year') => {
  onPaymentModeChange(mode)
  initializeForm()
}

async function removeCheckoutPage() {
  if (!checkout.value) return

  try {
    checkout.value.unmount()
    await checkout.value.destroy()
    checkout.value = null

    // Give Stripe a moment to fully clean up
    await new Promise((resolve) => setTimeout(resolve, 100))
  } catch (error) {
    console.warn('Error cleaning up checkout:', error)
    checkout.value = null
  }
}

onBeforeUnmount(async () => {
  await removeCheckoutPage()
})
</script>

<template>
  <div class="flex flex-col w-full justify-center md:mt-4">
    <div class="flex flex-col w-full gap-6">
      <div v-if="selectedPlan" class="nc-payment-pay-header sticky top-0 bg-white py-3 md:-mx-6 z-10">
        <div class="max-w-[920px] mx-auto flex flex-col gap-2 px-4">
          <PaymentCheckoutHeader
            :title="
              $t('labels.upgradeToPlan', {
                plan: $t(`objects.paymentPlan.${selectedPlan.title}`),
              })
            "
            @back="onBack()"
          >
            <div class="flex-1 text-2xl text-nc-content-gray-emphasis font-700 text-center">
              {{
                $t('labels.upgradeToPlan', {
                  plan: $t(`objects.paymentPlan.${selectedPlan.title}`),
                })
              }}
            </div>
          </PaymentCheckoutHeader>

          <div class="text-sm text-nc-content-gray-emphasis text-center">
            You are upgrading <b v-if="activeWorkspace?.title?.trim()"> {{ activeWorkspace?.title }}</b> workspace to the
            {{ selectedPlan.title }} plan.
          </div>
        </div>
      </div>
      <div
        v-if="selectedPlan && showPaymentMode"
        class="max-w-[444px] md:max-w-[920px] mx-auto w-full flex items-center justify-center px-4"
      >
        <a-form-item class="!w-full">
          <a-radio-group :value="paymentMode" class="nc-time-form-layout" @update:value="onChangePaymentMode">
            <a-radio value="year">
              <div class="w-full flex items-center gap-2">
                <div class="flex-1 flex flex-col md:(flex-row gap-3 items-center)">
                  Paid Annually

                  <div class="text-small leading-[18px] text-nc-content-gray-subtle2 font-normal">
                    ${{ getPlanPrice(selectedPlan, 'year') }} / user / month
                  </div>
                </div>
                <div class="bg-nc-bg-green-light px-1 rounded-md text-nc-content-green-dark font-500 text-sm">
                  Save {{ annualDiscount }}%
                </div>
              </div>
            </a-radio>

            <a-radio value="month">
              <div class="flex flex-col md:(flex-row gap-3 items-center)">
                Paid Monthly
                <div class="text-small leading-[18px] text-nc-content-gray-subtle2 font-normal">
                  ${{ getPlanPrice(selectedPlan, 'month') }} / user / month
                </div>
              </div>
            </a-radio>
          </a-radio-group>
        </a-form-item>
      </div>

      <div v-if="isLoading" class="relative min-h-[60vh]">
        <PaymentSkeleton class="w-full" />
      </div>

      <div v-show="!isLoading" id="checkout" class="w-full pb-10">
        <!-- Checkout inserts the payment form here -->
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.nc-payment-billing-page {
  &.nc-scrolled-to-bottom {
    .nc-payment-pay-header {
      @apply border-b border-nc-border-gray-medium;
    }
  }
}
</style>

<style lang="scss" scoped>
:deep(.nc-time-form-layout) {
  @apply flex-1 flex flex-col md:flex-row justify-between gap-3 children:(flex-1 m-0 p-4 border-1 border-nc-border-gray-medium rounded-lg);

  .ant-radio-wrapper {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);

    @apply transition-all text-base font-700 text-nc-content-gray;
    &:not(.ant-radio-wrapper-disabled).ant-radio-wrapper-checked {
      @apply border-brand-500 shadow-selected;
    }

    & span.ant-radio + span {
      @apply pr-0 w-full;
    }
  }
}
</style>
