<script lang="ts" setup>
const workspaceStore = useWorkspace()
const { activeWorkspace } = storeToRefs(workspaceStore)
const { getPlanPrice, cancelSubscription } = usePaymentStoreOrThrow()

const activePlan = computed(() => activeWorkspace.value?.payment?.plan)
const activeSubscription = computed(() => activeWorkspace.value?.payment?.subscription)
const activePrice = computed(() =>
  activePlan.value?.prices.find((price) => price.id === activeSubscription.value?.stripe_price_id),
)
const activePaymentMode = computed(() => (activePrice.value?.recurring.interval === 'year' ? 'year' : 'month'))

const onCancelSubscription = async () => {
  if (!activeSubscription.value) return
  await cancelSubscription()

  activeWorkspace.value.payment.subscription = undefined
}
</script>

<template>
  <div v-if="activePlan && activeSubscription" class="m-6 rounded-lg nc-border-gray-medium p-4 shadow-default max-w-[300px]">
    <div class="text-lg">{{ activePlan.title }}</div>
    <div class="flex items-center gap-1 my-4">
      <div class="text-xl">$</div>
      <div class="text-3xl font-bold">{{ getPlanPrice(activePlan, activePaymentMode) }}</div>
      / seat / month
    </div>

    <NcButton type="ghost" size="small" class="w-full my-4" disabled>
      <div class="flex items-center justify-center gap-1">Current Plan</div>
    </NcButton>

    <NcButton type="danger" size="small" class="w-full my-4" @click="onCancelSubscription">
      <div class="flex items-center justify-center gap-1">Cancel Subscription</div>
    </NcButton>
  </div>
</template>

<style lang="scss" scoped></style>
