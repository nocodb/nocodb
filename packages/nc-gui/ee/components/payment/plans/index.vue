<script lang="ts" setup>
const { plansAvailable, activePlan, paymentMode, loadPlans, onPaymentModeChange } = usePaymentStoreOrThrow()

onMounted(async () => {
  await loadPlans()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="text-base font-bold text-nc-content-gray">{{ $t('general.all') }} {{ $t('general.plans') }}</div>
    <PaymentPlansSelectMode :value="paymentMode" :discount="16" @change="onPaymentModeChange" />
    <div class="w-full grid gap-4 grid-cols-[repeat(auto-fill,minmax(288px,1fr))]">
      <PaymentPlansCard v-for="plan in plansAvailable" :key="plan.title" :plan="plan" :active-plan="activePlan?.title" />
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
