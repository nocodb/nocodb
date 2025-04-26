<script lang="ts" setup>
import { HigherPlan, PlanOrder, PlanTitles } from 'nocodb-sdk'

const props = defineProps<{
  plan: PaymentPlan
  activePlan?: PlanTitles
  activeBtnPlanTitle?: PlanTitles
}>()

const popularPlan = PlanTitles.TEAM

// Todo: remove comingSoonPlans when we launch this
const comingSoonPlans = [PlanTitles.ENTERPRISE]

const planTitleToDescHeader = {
  [PlanTitles.FREE]: 'For Personal Applications',
  [PlanTitles.TEAM]: 'For Small Teams',
  [PlanTitles.BUSINESS]: 'For Scaling Applications',
  [PlanTitles.ENTERPRISE]: 'For Established Organizations',
}

const { onSelectPlan, getPlanPrice, activeSubscription, paymentMode, isLoyaltyDiscountAvailable } = usePaymentStoreOrThrow()

const price = computed(() => getPlanPrice(props.plan))

const upgradePlanBtnType = computed(() => {
  if (props.activeBtnPlanTitle) {
    if (props.plan.title === props.activeBtnPlanTitle) {
      return 'primary'
    } else {
      return 'secondary'
    }
  }

  if (!activeSubscription.value && props.plan.title === popularPlan) {
    return 'primary'
  }

  if (activeSubscription.value && props.activePlan && props.plan.title === HigherPlan[props.activePlan]) {
    return 'primary'
  }

  return 'secondary'
})
</script>

<template>
  <div
    class="nc-payment-plan-card"
    :class="{
      'nc-payment-plan-card-active-plan':
        activePlan === plan.title && activeSubscription && paymentMode === activeSubscription.period,
    }"
  >
    <div class="flex items-center gap-4">
      <div class="flex-1 text-base font-700 text-nc-content-gray-emphasis children:font-normal">
        {{ $t(`objects.paymentPlan.${plan.title}`) }}
        <span
          v-if="activePlan === plan.title && activeSubscription && paymentMode === activeSubscription.period"
          class="text-xs text-nc-content-gray-muted"
        >
          ({{ activeSubscription.period === 'year' ? 'Annually' : 'Monthly' }})
        </span>
        <span
          v-if="!activeSubscription && plan.title === PlanTitles.TEAM"
          class="inline-block bg-nc-bg-brand text-nc-content-brand rounded-md text-sm font-normal px-1"
        >
          {{ $t('title.mostPopular') }}
        </span>
        <span
          v-if="comingSoonPlans.includes(plan.title)"
          class="inline-block bg-nc-bg-brand text-nc-content-brand rounded-md text-sm font-normal px-1"
        >
          {{ $t('title.comingSoon') }}
        </span>
      </div>
    </div>

    <div class="flex items-center gap-3 h-[36px] text-nc-content-gray-emphasis mt-1">
      <span class="text-xl text-nc-content-gray-emphasis font-weight-700">$</span>
      <span class="text-4xl font-700">
        {{ price }}
      </span>
      <span class="text=xs text-nc-content-gray-muted">
        {{ $t('title.seatMonth') }}
      </span>
    </div>

    <div
      v-if="isLoyaltyDiscountAvailable"
      class="flex flex-col gap-0.5"
      :class="{
        'opacity-0': plan.title === PlanTitles.FREE,
        'flex flex-col-reverse': plan.title === PlanTitles.ENTERPRISE,
      }"
    >
      <div
        class="!w-[fit-content] inline-block font-semibold text-sm text-nc-content-inverted-primary bg-gray-700 rounded-md px-1"
        :class="{
          'opacity-0': plan.title === PlanTitles.ENTERPRISE,
        }"
      >
        Loyalty pricing capped at
        <span class="line-through decoration-red-500 font-bold mr-1">{{ plan.title === PlanTitles.TEAM ? '$108' : '$216' }}</span>

        {{ plan.title === PlanTitles.TEAM ? '$48' : '$96' }}
      </div>
      <div class="text-nc-content-gray-muted text-xs leading-[18px] font-500">
        {{ plan.title === PlanTitles.ENTERPRISE ? 'Starting at $1000 / month' : 'For first year' }}
      </div>
    </div>

    <div class="text-nc-content-gray-emphasis font-700">
      {{ planTitleToDescHeader[plan.title] }}
    </div>

    <div v-if="plan.descriptions" class="flex flex-col gap-2">
      <div
        v-for="(desc, idx) of plan.descriptions"
        :key="desc"
        class="flex items-start text-nc-content-gray-subtle text-sm leading-[24px] font-weight-500"
      >
        <span class="mr-2 h-6 inline-flex items-center">
          <span class="rounded text-nc-content-brand bg-nc-bg-brand inline-flex items-center justify-center h-4 w-4">
            <GeneralIcon icon="ncCheck" class="h-3 w-3" />
          </span>
        </span>
        <span class="relative">
          {{ desc }}

          <div
            v-if="plan.title !== PlanTitles.FREE && idx === plan.descriptions.length - 1"
            class="nc-plan-description-gradient"
          ></div>
        </span>
      </div>
    </div>

    <NcButton
      v-if="
        activeSubscription &&
        activePlan === plan.title &&
        activeSubscription.canceled_at &&
        paymentMode === activeSubscription.period
      "
      type="secondary"
      size="medium"
      class="w-full !text-nc-content-brand"
      @click="onSelectPlan(plan)"
    >
      {{ $t('general.reactivate') }}
    </NcButton>
    <NcButton
      v-else-if="
        (activeSubscription && paymentMode === activeSubscription.period && activePlan === plan.title) ||
        (activePlan === PlanTitles.FREE && activePlan === plan.title)
      "
      type="secondary"
      size="medium"
      class="w-full pointer-events-none !text-nc-content-brand"
    >
      {{ $t('title.currentPlan') }}
    </NcButton>
    <nuxt-link v-else-if="plan.title === PlanTitles.ENTERPRISE" no-ref href="mailto:support@nocodb.com" target="_blank">
      <NcButton
        :type="activeSubscription && activePlan && HigherPlan[activePlan] === plan.title ? 'primary' : 'secondary'"
        size="medium"
        class="w-full"
      >
        {{ $t('labels.contactSales') }}
      </NcButton>
    </nuxt-link>
    <NcButton
      v-else-if="!plan.is_active && comingSoonPlans.includes(plan.title)"
      type="secondary"
      size="medium"
      class="w-full pointer-events-none"
    >
      <div class="flex items-center justify-center gap-1">{{ $t('title.comingSoon') }}</div>
    </NcButton>
    <NcButton
      v-else
      :type="upgradePlanBtnType"
      size="medium"
      class="w-full"
      :disabled="plan.title === PlanTitles.FREE && activeSubscription?.canceled_at"
      @click="onSelectPlan(plan)"
    >
      {{
        activePlan && PlanOrder[plan.title] > PlanOrder[activePlan]
          ? $t('labels.upgradeToPlan', {
              plan: $t(`objects.paymentPlan.${plan.title}`),
            })
          : `${$t('general.choose')} ${$t(`objects.paymentPlan.${plan.title}`)}`
      }}
    </NcButton>
  </div>
</template>

<style lang="scss" scoped>
.nc-payment-plan-card {
  @apply border-1 border-nc-border-gray-medium p-4 rounded-2xl flex flex-col gap-4 transition-shadow duration-300;

  &.nc-payment-plan-card-active-plan {
    @apply border-brand-500;
    box-shadow: 0px 0px 0px 4px rgba(51, 102, 255, 0.12);
  }

  .nc-plan-description-gradient {
    @apply absolute rounded-[30px] inset-0 z-0 pointer-events-none;

    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.2) 0%,
      rgba(252, 58, 198, 0.2) 47.08%,
      rgba(255, 255, 255, 0.2) 100%
    );
    filter: blur(2px);
  }
}
</style>
