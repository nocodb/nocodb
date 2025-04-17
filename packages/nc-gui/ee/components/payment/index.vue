<script lang="ts" setup>
const { paymentState, loadPlans } = usePaymentStoreOrThrow()

onMounted(async () => {
  await loadPlans()
})
</script>

<template>
  <div>
    <div v-if="paymentState === PaymentState.SELECT_PLAN" class="flex flex-col gap-8">
      <div class="w-[70%] max-w-[640px] mx-auto">
        <NcDivider class="!my-0" />
      </div>
      <PaymentMoreInfo />
    </div>
  </div>
</template>
