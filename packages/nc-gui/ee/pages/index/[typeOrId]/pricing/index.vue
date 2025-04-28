<script lang="ts" setup>
import { PlanTitles } from 'nocodb-sdk'

const { hideSidebar, showTopbar } = storeToRefs(useSidebarStore())

const { appInfo } = useGlobal()

useStripe()

const { navigateToBilling } = useEeConfig()

const {
  activeWorkspace,
  activeSubscription,
  activePlan,
  paymentMode,
  isLoyaltyDiscountAvailable,
  loadPlans,
  plansAvailable,
  onSelectPlan,
} = useProvidePaymentStore()

const frameLoaded = ref(false)

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
  if (event.origin !== appInfo.value.marketingRootUrl) return

  const { type, data } = event.data

  if (type === 'navigateToCheckout') {
    const { planTitle, paymentMode: paymentModeInput } = data

    if (planTitle === 'Enterprise') {
      openNewTab('https://cal.com/nocodb')
      return
    }

    if (activePlan.value?.title === PlanTitles.FREE && planTitle === PlanTitles.FREE) {
      navigateTo(`/${activeWorkspace.value?.id}/settings?tab=billing`)
      return
    }

    const plan = plansAvailable.value.find((plan) => plan.title === planTitle)

    if (!plan) return

    paymentMode.value = paymentModeInput

    onSelectPlan(plan)
  } else if (type === 'navigateToBilling') {
    navigateToBilling()
  } else if (type === 'frameLoaded') {
    frameLoaded.value = true
  }
})
</script>

<template>
  <div class="overflow-hidden">
    <div v-if="!frameLoaded" class="w-full p-[20%] flex items-center justify-center">
      <GeneralLoader size="xlarge" />
    </div>
    <iframe
      v-show="frameLoaded"
      :src="`${appInfo.marketingRootUrl}/${isLoyaltyDiscountAvailable ? 'loyalty-' : ''}pricing?inApp=true&workspace=${
        activeWorkspace?.title
      }&plan=${activePlan?.title}&paymentMode=${paymentMode}&isLoyaltyWorkspace=${isLoyaltyDiscountAvailable}`"
      width="100%"
      style="border: none; height: calc(100vh - 56px)"
    ></iframe>
  </div>
</template>

<style></style>
