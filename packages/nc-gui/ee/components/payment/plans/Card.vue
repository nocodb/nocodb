<script lang="ts" setup>
import { PlanTitles } from 'nocodb-sdk'

const props = defineProps<{
  plan: PaymentPlan
  activePlan?: string
}>()

const { onSelectPlan, getPlanPrice, activeSubscription, getCustomerPortalSession } = usePaymentStoreOrThrow()

const price = computed(() => getPlanPrice(props.plan))

const onManageSubscription = async () => {
  if (!activeSubscription.value) return

  try {
    const url = await getCustomerPortalSession()
    if (url) window.open(url, '_blank')
  } catch (e: any) {
    console.log(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const popularPlan = PlanTitles.TEAM
</script>

<template>
  <div
    class="nc-payment-plan-card border-1 border-nc-border-gray-medium p-4 rounded-xl w-[288px] flex flex-col gap-4 transition-shadow duration-300 hover:!shadow-md"
  >
    <div class="flex flex-col">
      <div class="text-xl font-bold text-nc-content-gray">
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
      </div>
      <div v-if="activePlan === plan.title && activeSubscription" class="flex items-center gap-1 h-[62px] text-nc-content-gray">
        <span class="text-2xl text-nc-content-gray-subtle2">$</span>
        <span class="text-[40px] leading-[62px] font-bold mr-3">{{ getPlanPrice(props.plan, activeSubscription.period) }}</span>
        {{ $t('title.seatMonth') }}
      </div>
      <div v-else class="flex items-center gap-1 h-[62px] w-[256px] text-nc-content-gray">
        <span class="text-xl text-nc-content-gray-subtle2">$</span><span class="text-3xl font-bold">{{ price }}</span>
        {{ $t('title.seatMonth') }}
      </div>
    </div>

    <NcButton
      v-if="activeSubscription && activePlan === plan.title"
      type="primary"
      size="medium"
      class="w-full"
      @click="onManageSubscription"
    >
      <div class="flex items-center justify-center gap-1">{{ $t('labels.manageSubscription') }}</div>
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
      v-else
      :type="plan.title === popularPlan ? 'primary' : 'secondary'"
      size="medium"
      class="w-full"
      @click="onSelectPlan(plan)"
    >
      {{ $t('general.choose') }} {{ $t(`objects.paymentPlan.${plan.title}`) }}
    </NcButton>

    <div v-if="plan.descriptions" class="flex flex-col pt-2">
      <div v-for="desc in plan.descriptions" :key="desc" class="flex items-center text-nc-content-gray-subtle2 leading-[24px]">
        <span class="mr-2">•</span>
        <span>{{ desc }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-payment-plan-card {
  box-shadow: 0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02);
}
</style>
