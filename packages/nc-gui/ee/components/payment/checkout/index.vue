<script lang="ts" setup>
import type { Stripe, StripeEmbeddedCheckout } from '@stripe/stripe-js'

const route = useRoute()

const stripe = ref<Stripe | null>(null)

const redirectRef = ref<'billing' | 'pricing' | null>(null)

const { navigateToPricing, navigateToBilling } = useEeConfig()

const {
  createPaymentForm,
  selectedPlan,
  paymentState,
  paymentMode,
  loadPlan,
  activeWorkspace,
  loadWorkspaceSeatCount,
  annualDiscount,
  onPaymentModeChange,
  getPlanPrice,
} = useProvidePaymentStore()

const { loadStripe } = useStripe()

const isLoading = ref(false)

const checkout = ref<StripeEmbeddedCheckout | null>(null)

const onBack = () => {
  if (redirectRef.value === 'billing') {
    navigateToBilling()
  } else {
    navigateToPricing()
  }
}

const initializeForm = async () => {
  isLoading.value = true
  removeCheckoutPage()

  try {
    const res: {
      client_secret?: string
      recover?: boolean
    } = await createPaymentForm()

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
  removeCheckoutPage()

  try {
    redirectRef.value = route.query?.ref === 'billing' ? 'billing' : null

    paymentMode.value = route.query?.paymentMode === 'month' ? 'month' : 'year'

    loadStripe().then((s) => {
      stripe.value = s

      loadWorkspaceSeatCount().then(() => {
        loadPlan(route.params.planId as string).then((plan) => {
          if (!plan) {
            navigateToPricing()
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

const onChangePaymentMode = (mode) => {
  onPaymentModeChange(mode)
  initializeForm()
}

function removeCheckoutPage() {
  if (!checkout.value) return

  checkout.value.unmount()
  checkout.value.destroy()
  checkout.value = null
}

onBeforeUnmount(() => {
  removeCheckoutPage()
})
</script>

<template>
  <div class="flex flex-col w-full justify-center md:mt-[52px]">
    <div class="flex flex-col w-full gap-6">
      <div v-if="selectedPlan" class="nc-payment-pay-header sticky top-0 bg-white py-3 -mt-6 md:-mx-6 z-10">
        <div class="max-w-[888px] mx-auto flex items-center md:justify-between gap-3">
          <div v-if="paymentState && paymentState !== PaymentState.SELECT_PLAN" class="flex">
            <NcButton
              type="text"
              size="small"
              inner-class="!gap-1"
              class="!text-nc-content-brand !hover:text-brand-600"
              @click="onBack"
            >
              <template #icon>
                <GeneralIcon icon="chevronLeft" class="h-4 w-4" />
              </template>
              <div>{{ $t('labels.back') }}</div>
            </NcButton>
          </div>

          <div class="text-base md:text-2xl text-nc-content-gray-emphasis font-weight-700 flex">
            {{
              $t('title.upgradeWorkspaceToPlan', {
                workspace: activeWorkspace?.title ?? 'Workspace',
                plan: $t(`objects.paymentPlan.${selectedPlan.title}`),
              })
            }}
          </div>

          <div v-if="paymentState && paymentState !== PaymentState.SELECT_PLAN" class="hidden md:(flex invisible)">
            <NcButton type="text" size="small" inner-class="!gap-1" class="!text-nc-content-brand !hover:text-brand-600">
              <template #icon>
                <GeneralIcon icon="chevronLeft" class="h-4 w-4" />
              </template>
              <div>{{ $t('labels.back') }}</div>
            </NcButton>
          </div>
        </div>
      </div>
      <div v-if="selectedPlan" class="max-w-[444px] md:max-w-[920px] mx-auto w-full flex items-center justify-center px-4">
        <a-form-item class="!w-full">
          <a-radio-group :value="paymentMode" class="nc-time-form-layout" @update:value="onChangePaymentMode">
            <a-radio value="month">
              <div class="flex flex-col md:(flex-row gap-3 items-center)">
                Paid Monthly
                <div class="text-small leading-[18px] text-nc-content-gray-subtle2 font-normal">
                  $ {{ getPlanPrice(selectedPlan, 'month') }} / user / month
                </div>
              </div>
            </a-radio>
            <a-radio value="year">
              <div class="w-full flex items-center gap-2">
                <div class="flex-1 flex flex-col md:(flex-row gap-3 items-center)">
                  Paid Annually

                  <div class="text-small leading-[18px] text-nc-content-gray-subtle2 font-normal">
                    $ {{ getPlanPrice(selectedPlan, 'year') }} / user / month
                  </div>
                </div>
                <div class="bg-nc-bg-green-light px-1 rounded-md text-nc-content-green-dark font-500 text-sm">
                  Save {{ annualDiscount }}%
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
