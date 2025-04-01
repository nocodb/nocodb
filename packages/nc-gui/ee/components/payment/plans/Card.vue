<script lang="ts" setup>
import { PlanTitles } from 'nocodb-sdk'

const props = defineProps<{
  plan: PaymentPlan
  activePlan?: string
}>()

const popularPlan = PlanTitles.TEAM

// Todo: remove comingSoonPlans when we launch this
const comingSoonPlans = [PlanTitles.BUSINESS, PlanTitles.ENTERPRISE]

const PrevPlanTitleFromCurrentPlan = {
  [PlanTitles.TEAM]: PlanTitles.FREE,
  Plus: PlanTitles.TEAM,
  [PlanTitles.BUSINESS]: PlanTitles.TEAM,
  [PlanTitles.ENTERPRISE]: PlanTitles.BUSINESS,
}

const { onSelectPlan, getPlanPrice, activeSubscription } = usePaymentStoreOrThrow()

const price = computed(() => getPlanPrice(props.plan))

const isHigherPlan = (plan: string) => {
  if (!activeSubscription || !props.activePlan) return false

  // Todo: remove later
  if (plan === 'Plus') {
    plan = PlanTitles.BUSINESS
  }

  const planTitleValues = Object.values(PlanTitles)

  const activePlanIndex = planTitleValues.findIndex((p) => p === props.activePlan)

  const planIndex = planTitleValues.findIndex((p) => p === plan)

  return planIndex > activePlanIndex
}
</script>

<template>
  <div
    class="nc-payment-plan-card border-1 border-nc-border-gray-medium p-4 rounded-xl flex flex-col gap-4 transition-shadow duration-300 hover:!shadow-md"
  >
    <div class="flex flex-col">
      <div class="flex items-center gap-4">
        <div class="flex-1 text-xl font-bold text-nc-content-gray">
          {{ $t(`objects.paymentPlan.${plan.title}`) }}
          <span v-if="activePlan === plan.title && activeSubscription" class="text-xs text-nc-content-gray-muted">
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
        <div v-if="activePlan === plan.title && activeSubscription" class="text-nc-content-brand flex children:flex-none">
          <GeneralIcon icon="circleCheckSolid" />
        </div>
      </div>
      <div class="flex items-center gap-1 h-[62px] text-nc-content-gray mt-1">
        <span class="text-2xl text-nc-content-gray-subtle2 font-weight-700">$</span>
        <span class="text-[40px] leading-[62px] font-weight-700 mr-2">
          {{ activePlan === plan.title && activeSubscription ? getPlanPrice(props.plan, activeSubscription.period) : price }}
        </span>
        {{ $t('title.editorMonth') }}
      </div>
    </div>

    <NcButton
      v-if="activeSubscription && activePlan === plan.title && activeSubscription.end_at"
      type="secondary"
      size="medium"
      class="w-full !text-nc-content-brand"
      @click="onSelectPlan(plan)"
    >
      Reactivate
    </NcButton>
    <NcButton
      v-else-if="activeSubscription && activePlan === plan.title"
      type="secondary"
      size="medium"
      class="w-full pointer-events-none !text-nc-content-brand"
    >
      {{ $t('title.currentPlan') }}
    </NcButton>
    <NcButton v-else-if="activePlan === plan.title" type="secondary" size="medium" class="w-full pointer-events-none">
      <div class="flex items-center justify-center gap-1">{{ $t('title.currentPlan') }}</div>
    </NcButton>
    <nuxt-link v-else-if="plan.title === PlanTitles.ENTERPRISE" no-ref href="mailto:support@nocodb.com" target="_blank">
      <NcButton type="secondary" size="medium" class="w-full">
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
      :type="plan.title === popularPlan ? 'primary' : 'secondary'"
      size="medium"
      class="w-full"
      :disabled="plan.title === PlanTitles.FREE && activeSubscription.end_at"
      @click="onSelectPlan(plan)"
    >
      {{
        isHigherPlan(plan.title)
          ? $t('labels.upgradeToPlan', {
              plan: $t(`objects.paymentPlan.${plan.title}`),
            })
          : `${$t('general.choose')} ${$t(`objects.paymentPlan.${plan.title}`)}`
      }}
    </NcButton>

    <div class="flex flex-col gap-3">
      <div class="pt-2 text-nc-content-gray-subtle2 font-weight-700 text-sm">
        <span v-if="plan.title === PlanTitles.FREE">
          {{
            $t('labels.planIncludes', {
              plan: $t(`objects.paymentPlan.${plan.title}`),
            })
          }}
        </span>
        <span v-else>
          {{
            $t('labels.everythingInPlanPlus', {
              plan: $t(`objects.paymentPlan.${PrevPlanTitleFromCurrentPlan[plan.title]}`),
            })
          }}
        </span>
      </div>

      <div v-if="plan.descriptions" class="flex flex-col">
        <div
          v-for="desc in plan.descriptions"
          :key="desc"
          class="flex items-start text-nc-content-gray-subtle2 text-sm leading-[24px] font-weight-500"
        >
          <span class="mr-2">•</span>
          <span>{{ desc }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-payment-plan-card {
  box-shadow: 0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02);
}
</style>
