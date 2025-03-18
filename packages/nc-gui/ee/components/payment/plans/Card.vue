<script lang="ts" setup>
const props = defineProps<{
  plan: PaymentPlan
  activePlan?: string
}>()

const { onSelectPlan, getPlanPrice, activeSubscription, getCustomerPortalSession } = usePaymentStoreOrThrow()

const price = computed(() => getPlanPrice(props.plan))

const onManageSubscription = async () => {
  if (!activeSubscription.value) return
  const url = await getCustomerPortalSession()

  if (url) window.open(url, '_blank')
}
</script>

<template>
  <div class="border-1 border-nc-border-gray-medium p-4 shadow-default rounded-lg w-[300px] flex flex-col gap-2">
    <div class="flex flex-col">
      <div class="text-xl font-bold">
        {{ plan.title
        }}<span v-if="activePlan === plan.title && activeSubscription" class="text-xs text-nc-content-gray-muted">
          ({{ activeSubscription.period === 'year' ? 'Annually' : 'Monthly' }})</span
        >
      </div>
      <div v-if="activePlan === plan.title && activeSubscription" class="flex items-center gap-1 h-[64px]">
        <span class="text-xl">$</span
        ><span class="text-3xl font-bold">{{ getPlanPrice(props.plan, activeSubscription.period) }}</span
        >/seat/month
      </div>
      <div v-else class="flex items-center gap-1 h-[64px]">
        <span class="text-xl">$</span><span class="text-3xl font-bold">{{ price }}</span
        >/seat/month
      </div>
    </div>

    <NcButton
      v-if="activeSubscription && activePlan === plan.title"
      type="primary"
      size="medium"
      class="w-full"
      @click="onManageSubscription"
    >
      <div class="flex items-center justify-center gap-1">Manage Subscription</div>
    </NcButton>
    <NcButton v-else-if="activePlan === plan.title" type="ghost" size="medium" class="w-full !text-black pointer-events-none">
      <div class="flex items-center justify-center gap-1">Current Plan</div>
    </NcButton>
    <NcButton v-else type="primary" size="medium" class="w-full" @click="onSelectPlan(plan)">
      <div class="flex items-center justify-center gap-1">Choose {{ plan.title }}</div>
    </NcButton>

    <div v-if="plan.descriptions" class="flex flex-col mt-4">
      <div v-for="desc in plan.descriptions" :key="desc" class="flex items-center gap-2">
        <span>•</span>
        <div>{{ desc }}</div>
      </div>
    </div>
  </div>
</template>
