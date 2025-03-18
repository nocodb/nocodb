<script lang="ts" setup>
const { plansAvailable, activePlan, paymentMode, loadPlans, onPaymentModeChange } = usePaymentStoreOrThrow()

onMounted(async () => {
  await loadPlans()
})
</script>

<template>
  <div class="flex flex-col">
    <div class="flex">
      <div class="text-base font-bold mb-4">All Plans</div>
      <!-- toggle annual & monthly -->
      <div class="flex-1"></div>
      <div class="flex items-center gap-2">
        <div class="text-sm">Monthly</div>
        <NcSwitch :checked="paymentMode === 'year'" @change="onPaymentModeChange" />
        <div class="text-sm">Annual</div>
      </div>
    </div>
    <div class="flex gap-4">
      <PaymentPlanCard v-for="plan in plansAvailable" :key="plan.title" :plan="plan" :active-plan="activePlan?.title" />
    </div>
  </div>
</template>
