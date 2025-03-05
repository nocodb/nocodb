<script lang="ts" setup>
const { stripe, createSubscription, selectedPlan, getPlanPrice, onPaymentModeChange, paymentMode, onSeatsChange, selectedSeats } =
  usePaymentStoreOrThrow()

const { appInfo } = useGlobal()

const seatOptions = Array.from({ length: 50 }, (_, i) => i + 1).map((i) => ({
  label: `${i} ${i === 1 ? 'seat' : 'seats'}`,
  value: `${i}`,
}))

const totalAmount = computed(() =>
  selectedPlan.value ? getPlanPrice(selectedPlan.value, paymentMode.value) * selectedSeats.value * 100 : 0,
)

const localState = computed(() => ({
  mode: 'subscription',
  amount: totalAmount.value,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
}))

const selectedSeatsComputed = computed({
  get: () => `${selectedSeats.value}`,
  set: (value) => {
    selectedSeats.value = +value
  },
})

const isLoading = ref(false)

const elements = ref()

const submitPayment = async (e) => {
  if (!stripe.value || !elements.value) {
    return
  }

  e.preventDefault()
  isLoading.value = true

  await elements.value.submit()

  const { type, clientSecret } = await createSubscription()

  const confirmIntent = type === 'setup' ? stripe.value.confirmSetup : stripe.value.confirmPayment

  const { error } = await confirmIntent({
    elements: elements.value,
    clientSecret,
    confirmParams: {
      return_url: `${appInfo.value.ncSiteUrl}?payment=success`,
    },
  })

  if (error.type === 'card_error' || error.type === 'validation_error') {
    message.error(error.message)
  } else {
    message.error('An unexpected error occurred.')
  }

  isLoading.value = false
}

onMounted(() => {
  if (!stripe.value) {
    return
  }

  elements.value = stripe.value.elements(localState.value)

  const paymentElementOptions = {
    layout: 'accordion',
  }

  const paymentElement = elements.value.create('payment', paymentElementOptions)
  paymentElement.mount('#payment-element')
})
</script>

<template>
  <div v-if="selectedPlan" class="flex">
    <div class="flex flex-col flex-1 p-4">
      <div class="text-2xl font-bold mb-4">Payment</div>
      <div class="flex gap-4 justify-center">
        <div
          class="flex items-center gap-2 nc-border-gray-medium p-4 shadow-default rounded-lg w-1/2 cursor-pointer"
          @click="onPaymentModeChange(false)"
        >
          <a-radio :checked="paymentMode === 'month'" />
          <div class="flex flex-col">
            <div class="text-sm font-bold">Paid Monthly</div>
            <div class="flex items-center text-gray-500">${{ getPlanPrice(selectedPlan, 'month') }} / seat / month</div>
          </div>
        </div>
        <div
          class="flex items-center gap-2 nc-border-gray-medium p-4 shadow-default rounded-lg w-1/2 cursor-pointer"
          @click="onPaymentModeChange(true)"
        >
          <a-radio :checked="paymentMode === 'year'" />
          <div class="flex flex-col">
            <div class="text-sm font-bold">Paid Yearly</div>
            <div class="flex items-center text-gray-500">${{ getPlanPrice(selectedPlan, 'year') }} / seat / month</div>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-center gap-2 nc-border-gray-medium my-4 rounded-lg w-full cursor-pointer">
        <NcSelect v-model:value="selectedSeatsComputed" class="w-full" :options="seatOptions" @change="onSeatsChange" />
      </div>
      <form id="payment-form">
        <div id="payment-element">
          <!-- Stripe.js injects the Payment Element -->
        </div>
        <div id="payment-message" class="hidden"></div>
      </form>
    </div>
    <div class="flex flex-col min-w-[400px] shadow-default rounded-lg p-4">
      <div class="text-xl font-bold">Invoice Preview</div>
      <a-divider class="!my-4" />
      <div class="flex flex-col items-center gap-2">
        <div class="text-lg">{{ selectedPlan.title }}</div>
        <div class="flex gap-2">
          <div class="text-gray-500">${{ getPlanPrice(selectedPlan, paymentMode) }} / seat / month</div>
          <div class="text-gray-500">x {{ selectedSeats }}</div>
        </div>
      </div>
      <div class="flex-1"></div>
      <a-divider class="!my-4" />
      <div class="flex items-center gap-2 justify-between px-6 pb-4">
        <div class="text-lg">Total</div>
        <div v-if="paymentMode === 'month'" class="text-gray-500">
          ${{ getPlanPrice(selectedPlan, paymentMode) * selectedSeats }} / month
        </div>
        <div v-else class="text-gray-500">${{ getPlanPrice(selectedPlan, paymentMode) * selectedSeats * 12 }} / year</div>
      </div>
      <div class="flex justify-center">
        <NcButton type="primary" class="w-full" :loading="isLoading" @click="submitPayment">
          <div class="flex items-center justify-center gap-1">
            <GeneralIcon icon="ncLock" class="h-4 w-4" />
            <span>Confirm & Pay</span>
          </div>
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
