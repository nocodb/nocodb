<script lang="ts" setup>
const { plansAvailable, activePlan, paymentMode, getPlanPrice, loadPlans, onPaymentModeChange, isPaidPlan } =
  usePaymentStoreOrThrow()

const filteredPlansAvailable = computed(() => {
  if (!activePlan.value) return plansAvailable.value
  // hide cheaper plans
  return plansAvailable.value.filter((plan) => getPlanPrice(plan) >= getPlanPrice(activePlan.value, paymentMode.value))
})

onMounted(async () => {
  await loadPlans()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="isPaidPlan" class="text-base font-bold">{{ $t('general.plans') }}</div>
    <div v-else class="text-base font-bold text-nc-content-gray">{{ $t('general.all') }} {{ $t('general.plans') }}</div>
    <PaymentPlansSelectMode v-if="!isPaidPlan" :value="paymentMode" :discount="10" @change="onPaymentModeChange" />
    <div class="flex gap-4 flex-wrap">
      <PaymentPlansCard v-for="plan in filteredPlansAvailable" :key="plan.title" :plan="plan" :active-plan="activePlan?.title" />
    </div>

    <a
      href="https://nocodb.com/pricing"
      target="_blank"
      class="h-[48px] !no-underline flex items-center gap-2 justify-center text-nc-content-gray-subtle hover:text-nc-content-gray-emphasis transition-colors text-base font-bold cursor-pointer"
    >
      {{ $t('labels.compareAllFeatures') }}
      <GeneralIcon icon="ncExternalLink" />
    </a>
  </div>
</template>
