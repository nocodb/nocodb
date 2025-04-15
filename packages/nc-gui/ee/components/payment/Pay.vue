<script lang="ts" setup>
import type { StripeEmbeddedCheckout } from '@stripe/stripe-js'

const { stripe, createPaymentForm, selectedPlan, paymentState, reset } = usePaymentStoreOrThrow()

const isLoading = ref(false)

const checkout = ref<StripeEmbeddedCheckout | null>(null)

const initializeForm = async () => {
  if (!stripe.value) {
    return
  }

  isLoading.value = true

  try {
    const res: {
      client_secret?: string
      recover?: boolean
    } = await createPaymentForm()

    if (res.recover) {
      message.info(`Your subscription has been recovered.`)
      window.location.reload()
      return
    }

    // Initialize Checkout
    checkout.value = await stripe.value.initEmbeddedCheckout({
      clientSecret: res.client_secret,
    })

    // Mount Checkout
    checkout.value.mount('#checkout')
  } catch (err: any) {
    console.log(err)
    message.error(await extractSdkResponseErrorMsg(err))
  } finally {
    isLoading.value = false
  }
}

const onReset = () => {
  reset()

  if (!checkout.value) {
    return
  }

  checkout.value?.unmount()
  checkout.value?.destroy()
  checkout.value = null
}

onMounted(async () => {
  await initializeForm()
})

onUnmounted(() => {
  onReset()
})
</script>

<template>
  <div v-if="selectedPlan" class="flex flex-col w-full">
    <div class="flex flex-col w-full gap-6">
      <div class="nc-payment-pay-header sticky top-0 bg-white py-3 -mt-6 -mx-6">
        <div class="max-w-[888px] mx-auto flex items-center justify-between">
          <div v-if="paymentState && paymentState !== PaymentState.SELECT_PLAN" class="flex">
            <NcButton
              type="text"
              size="small"
              inner-class="!gap-1"
              class="!text-nc-content-brand !hover:text-brand-600"
              @click="onReset"
            >
              <template #icon>
                <GeneralIcon icon="chevronLeft" class="h-4 w-4" />
              </template>
              <div>{{ $t('labels.back') }}</div>
            </NcButton>
          </div>
          <div class="text-2xl text-nc-content-gray-emphasis font-weight-700 flex">
            {{
              $t('labels.upgradeToPlan', {
                plan: $t(`objects.paymentPlan.${selectedPlan.title}`),
              })
            }}
          </div>
          <div v-if="paymentState && paymentState !== PaymentState.SELECT_PLAN" class="flex invisible">
            <NcButton type="text" size="small" inner-class="!gap-1" class="!text-nc-content-brand !hover:text-brand-600">
              <template #icon>
                <GeneralIcon icon="chevronLeft" class="h-4 w-4" />
              </template>
              <div>{{ $t('labels.back') }}</div>
            </NcButton>
          </div>
        </div>
      </div>
      <div id="checkout" class="w-full">
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
