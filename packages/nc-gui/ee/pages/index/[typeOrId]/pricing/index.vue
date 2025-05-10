<script lang="ts" setup>
import { PlanTitles } from 'nocodb-sdk'

const { hideSidebar, showTopbar, isNewSidebarEnabled } = storeToRefs(useSidebarStore())

const { appInfo } = useGlobal()

const route = useRoute()

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
  if (isNewSidebarEnabled.value) {
    hideSidebar.value = true
  }

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

const sendIframeMessage = (message: any) => {
  const iframe = document.querySelector('iframe')
  if (iframe) {
    iframe.contentWindow?.postMessage(message, appInfo.value.marketingRootUrl)
  }
}

useEventListener('message', (event) => {
  if (event.origin !== appInfo.value.marketingRootUrl) return

  const { type, data } = event.data

  if (type === 'navigateToCheckout') {
    const { planTitle, paymentMode: paymentModeInput, planCardClick = true } = data

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

    onSelectPlan(plan, !planCardClick)
  } else if (type === 'navigateToBilling') {
    navigateToBilling()
  } else if (type === 'frameLoaded') {
    frameLoaded.value = true
    const scrollTo = route?.query?.go
    if (scrollTo) {
      nextTick(() => {
        sendIframeMessage({
          type: 'scrollTo',
          id: scrollTo,
        })
      })
    }
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
      }&plan=${activePlan?.title}&paymentMode=${paymentMode}&isLoyaltyWorkspace=${isLoyaltyDiscountAvailable}${
        route?.query?.activeBtn ? `&CTA=${route?.query?.activeBtn}` : ''
      }`"
      width="100%"
      style="border: none; height: calc(100vh - 56px)"
    ></iframe>
  </div>
</template>

<style></style>
