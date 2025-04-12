<script lang="ts" setup>
import { HigherPlan, PlanTitles } from 'nocodb-sdk'

const route = useRoute()

const router = useRouter()

const { annualDiscount, plansAvailable, activePlan, paymentMode, onPaymentModeChange } = usePaymentStoreOrThrow()

const activeBtnPlanTitle = ref('')

watch(
  [() => route?.query?.tab, () => route?.query?.activeBtn],
  async ([tab, activeBtn]) => {
    if (tab !== 'billing' || !activeBtn || !Object.values(PlanTitles).includes(activeBtn as PlanTitles)) return

    activeBtnPlanTitle.value = activeBtn as string

    const { activeBtn: _activeBtn, ...restQuery } = route.query as Record<string, string>

    router.push({ query: { ...restQuery } })
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="text-base font-bold text-nc-content-gray">{{ $t('general.all') }} {{ $t('general.plans') }}</div>
    <PaymentPlansSelectMode :value="paymentMode" :discount="annualDiscount" @change="onPaymentModeChange" />
    <div class="w-full grid gap-4 grid-cols-[repeat(auto-fill,minmax(288px,1fr))]">
      <PaymentPlansCard
        v-for="plan in plansAvailable"
        :key="plan.title"
        :plan="plan"
        :active-plan="activePlan?.title"
        :active-btn-plan-title="activeBtnPlanTitle"
      />

      <LazyPaymentPlansUpgradePlanModal />
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
