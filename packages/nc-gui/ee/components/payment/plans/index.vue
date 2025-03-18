<script lang="ts" setup>
const { plansAvailable, activePlan, paymentMode, loadPlans, onPaymentModeChange } = usePaymentStoreOrThrow()

onMounted(async () => {
  await loadPlans()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="text-base font-bold">All Plans</div>
    <PaymentPlansSelectMode :value="paymentMode" :discount="10" @change="onPaymentModeChange" />
    <div class="flex gap-4">
      <PaymentPlansCard v-for="plan in plansAvailable" :key="plan.title" :plan="plan" :active-plan="activePlan?.title" />
    </div>
  </div>
</template>
