<script lang="ts" setup>
const { plansAvailable, activePlan, paymentMode, getPlanPrice, loadPlans, onPaymentModeChange, isPaidPlan } =
  usePaymentStoreOrThrow()

const filteredPlansAvailable = computed(() => {
  // Show all plans for now
  return plansAvailable.value

  // if (!activePlan.value) return plansAvailable.value
  // // hide cheaper plans
  // return plansAvailable.value.filter((plan) => getPlanPrice(plan) >= getPlanPrice(activePlan.value, paymentMode.value))
})

onMounted(async () => {
  await loadPlans()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="text-base font-bold text-nc-content-gray">{{ $t('general.all') }} {{ $t('general.plans') }}</div>
    <PaymentPlansSelectMode :value="paymentMode" :discount="10" @change="onPaymentModeChange" />
    <div class="flex gap-4 flex-wrap">
      <PaymentPlansCard v-for="plan in filteredPlansAvailable" :key="plan.title" :plan="plan" :active-plan="activePlan?.title" />
    </div>

    <a href="https://nocodb.com/pricing" target="_blank" class="h-[48px] inline-block mx-auto">
      <NcButton type="text" icon-position="right" inner-class="!gap-2" size="medium" class="!h-full !text-base">
        <template #icon>
          <GeneralIcon icon="ncExternalLink" />
        </template>
        {{ $t('labels.compareAllFeatures') }}
      </NcButton>
    </a>
  </div>
</template>
