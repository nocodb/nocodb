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
  <div v-if="selectedPlan" class="flex flex-col">
    <div v-if="paymentState && paymentState !== PaymentState.SELECT_PLAN" class="pb-4">
      <div class="flex items-center gap-2 cursor-pointer" @click="onReset">
        <GeneralIcon icon="ncArrowLeft" class="h-4 w-4" />
        <div class="text-sm">Back</div>
      </div>
    </div>
    <div class="flex w-full">
      <div id="checkout" class="w-full">
        <!-- Checkout inserts the payment form here -->
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
