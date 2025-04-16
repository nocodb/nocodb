<script lang="ts" setup>
import { PlanTitles } from 'nocodb-sdk'
import bgImage from '~/assets/img/loyalty-bg.png'

const route = useRoute()

const router = useRouter()

const { annualDiscount, plansAvailable, activePlan, paymentMode, onPaymentModeChange, isLoyaltyWorkspace } =
  usePaymentStoreOrThrow()

const allPlanRef = ref<HTMLDivElement>()

const activeBtnPlanTitle = ref('')

watch(
  [() => route?.query?.tab, () => route?.query?.activeBtn, () => route?.query?.autoScroll],
  async ([tab, activeBtn, autoScroll]) => {
    if (tab !== 'billing') return

    const { activeBtn: _activeBtn, autoScroll: _autoScroll, ...restQuery } = route.query as Record<string, string>

    if (autoScroll === 'plan') {
      await until(() => !!allPlanRef.value).toBeTruthy()

      await ncDelay(300)

      allPlanRef.value?.scrollIntoView({ behavior: 'smooth' })
    }

    if (!activeBtn || !Object.values(PlanTitles).includes(activeBtn as PlanTitles)) {
      if (autoScroll) {
        router.push({ query: { ...restQuery } })
      }

      return
    }

    activeBtnPlanTitle.value = activeBtn as string

    router.push({ query: { ...restQuery } })
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div id="nc-payment-all-plans" ref="allPlanRef" class="text-base font-bold text-nc-content-gray">
      {{ $t('general.all') }} {{ $t('general.plans') }}
    </div>
    <PaymentPlansSelectMode :value="paymentMode" :discount="annualDiscount" @change="onPaymentModeChange" />
    <div
      v-if="isLoyaltyWorkspace"
      class="loyalty-badge flex gap-5 rounded-lg p-4 border-1 border-nc-border-grey-medium bg-cover bg-no-repeat bg-center"
      :style="{
        'background-image': `url(${bgImage})`,
        'background-color': 'rgba(255, 255, 255, 0.8)',
        'background-blend-mode': 'overlay',
      }"
    >
      <div>🎊</div>
      <div class="flex flex-col gap-2">
        <span class="font-bold text-base">You’ve Unlocked Loyalty Discounts! Save up to 55%!</span>
        <span class="text-sm text-nc-content-gray-muted"
          >Thanks for being with us since day one. Enjoy the team plan capped at
          <span class="line-through decoration-red-500 font-bold mr-1">$108</span><span class="font-bold">$48</span> and the
          Business plan capped at <span class="line-through decoration-red-500 font-bold mr-1">$216</span>
          <span class="font-bold">$96</span> for the next year!</span
        >
        <PaymentExpiresIn end-time="2025-04-30" />
      </div>
    </div>
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
