<script lang="ts" setup>
import { PlanTitles } from 'nocodb-sdk'

const route = useRoute()

const router = useRouter()

const { navigateToPricing } = useEeConfig()

const { annualDiscount, plansAvailable, activePlan, paymentMode, onPaymentModeChange, isLoyaltyDiscountAvailable, isPaidPlan } =
  usePaymentStoreOrThrow()

const allPlanRef = ref<HTMLDivElement>()

const activeBtnPlanTitle = ref('')

watch(
  [() => route?.query?.activeBtn, () => route?.query?.autoScroll],
  async ([activeBtn, autoScroll]) => {
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
    <PaymentLoyaltyBadge v-if="isLoyaltyDiscountAvailable && !isPaidPlan" />
    <div class="w-full grid gap-4 grid-cols-[repeat(auto-fill,minmax(288px,1fr))]">
      <PaymentPlansCard
        v-for="plan in plansAvailable"
        :key="plan.title"
        :plan="plan"
        :active-plan="activePlan?.title"
        :active-btn-plan-title="activeBtnPlanTitle"
      />
    </div>

    <a class="h-[48px] inline-block mx-auto" @click="navigateToPricing()">
      <NcButton type="text" icon-position="right" inner-class="!gap-2" size="medium" class="!h-full !text-base">
        <template #icon>
          <GeneralIcon icon="ncExternalLink" />
        </template>
        {{ $t('labels.compareAllFeatures') }}
      </NcButton>
    </a>
  </div>
</template>
