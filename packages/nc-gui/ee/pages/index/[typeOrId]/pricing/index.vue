<script lang="ts" setup>
const { hideSidebar, showTopbar } = storeToRefs(useSidebarStore())

useStripe()

const { navigateToBilling } = useEeConfig()

const {
  activeWorkspace,
  activeSubscription,
  activePlan,
  paymentMode,
  isLoyaltyWorkspace,
  loadPlans,
  plansAvailable,
  onSelectPlan,
} = useProvidePaymentStore()

onMounted(() => {
  hideSidebar.value = true
  showTopbar.value = true

  paymentMode.value = activeSubscription.value?.period || 'year'
})

onBeforeUnmount(() => {
  hideSidebar.value = false
  showTopbar.value = false
})

onMounted(() => {
  loadPlans()
})

const openNewTab = (url: string) => {
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer')
  if (newWindow) newWindow.opener = null
}

useEventListener('message', (event) => {
  if (event.origin !== 'https://marketing.localhost.com') return

  const { type, data } = event.data

  if (type === 'navigateToCheckout') {
    const { planTitle, paymentMode: paymentModeInput } = data

    if (planTitle === 'Enterprise') {
      openNewTab('https://cal.com/nocodb')
      return
    }

    const plan = plansAvailable.value.find((plan) => plan.title === planTitle)

    if (!plan) return

    paymentMode.value = paymentModeInput

    onSelectPlan(plan)
  } else if (type === 'navigateToBilling') {
    navigateToBilling()
  }
})
</script>

<template>
  <div class="overflow-hidden">
    <iframe
      :src="`https://marketing.localhost.com/pricing.html?inApp=true&workspace=${activeWorkspace?.title}&plan=${activePlan?.title}&paymentMode=${paymentMode}&isLoyaltyWorkspace=${isLoyaltyWorkspace}`"
      width="100%"
      height="1000"
      style="border: none"
    ></iframe>
  </div>
</template>

<style>
a {
  text-decoration: none !important;
}
</style>
