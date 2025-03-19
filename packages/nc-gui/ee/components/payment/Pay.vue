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

  const res = await createPaymentForm()

  // Initialize Checkout
  checkout.value = await stripe.value.initEmbeddedCheckout({
    clientSecret: res.client_secret,
  })

  // Mount Checkout
  checkout.value.mount('#checkout')

  isLoading.value = false
}

const onReset = () => {
  reset()
  checkout.value?.destroy()
}

onMounted(async () => {
  await initializeForm()
})
</script>

<template>
  <div v-if="selectedPlan" class="flex flex-col w-full">
    <div class="flex flex-col w-full gap-6">
      <div v-if="paymentState && paymentState !== PaymentState.SELECT_PLAN">
        <div class="flex items-center gap-1 cursor-pointer text-brand-500 hover:text-brand-800 font-weight-700" @click="onReset">
          <GeneralIcon icon="chevronLeft" class="h-4 w-4 mt-0.3" />
          <div class="text-sm">Back</div>
        </div>
      </div>
      <div class="text-2xl font-bold ml-1">Upgrade To {{ selectedPlan.title }}</div>
      <div id="checkout" class="w-full">
        <!-- Checkout inserts the payment form here -->
      </div>
    </div>
  </div>
</template>
