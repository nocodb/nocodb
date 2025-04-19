<script lang="ts" setup>
const { paymentState, loadPlans, activeSubscription } = usePaymentStoreOrThrow()

onMounted(async () => {
  await loadPlans()
})
</script>

<template>
  <div>
    <div v-if="paymentState === PaymentState.SELECT_PLAN" class="flex flex-col gap-8">
      <PaymentInvoicePastInvoice v-if="activeSubscription" />

      <div class="w-[70%] max-w-[640px] mx-auto">
        <NcDivider class="!my-0" />
      </div>
      <PaymentMoreInfo />
    </div>
  </div>
</template>
