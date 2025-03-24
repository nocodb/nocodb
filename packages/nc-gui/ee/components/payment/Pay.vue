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
    const res = await createPaymentForm()

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
  checkout.value?.destroy()
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
      <div v-if="paymentState && paymentState !== PaymentState.SELECT_PLAN" class="flex">
        <div
          class="inline-flex items-center gap-1 cursor-pointer text-nc-content-brand hover:text-brand-600 font-weight-700"
          @click="onReset"
        >
          <GeneralIcon icon="chevronLeft" class="h-4 w-4" />
          <div class="text-sm">{{ $t('labels.back') }}</div>
        </div>
      </div>
      <div class="text-2xl font-bold ml-1">
        {{
          $t('labels.upgradeToPlan', {
            plan: $t(`objects.paymentPlan.${selectedPlan.title}`),
          })
        }}
      </div>
      <div id="checkout" class="w-full">
        <!-- Checkout inserts the payment form here -->
      </div>
    </div>
  </div>
</template>
