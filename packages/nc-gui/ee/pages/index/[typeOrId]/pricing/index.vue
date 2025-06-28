<script lang="ts" setup>
import { PlanLimitTypes, PlanTitles } from 'nocodb-sdk'

const { $e } = useNuxtApp()

const { hideMiniSidebar, hideSidebar, showTopbar } = storeToRefs(useSidebarStore())

const { appInfo } = useGlobal()

const route = useRoute()

useStripe()

const { navigateToBilling, getStatLimit } = useEeConfig()

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
  hideMiniSidebar.value = true

  showTopbar.value = true

  paymentMode.value = activeSubscription.value?.period || 'year'
})

onBeforeUnmount(() => {
  hideSidebar.value = false
  hideMiniSidebar.value = false
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
      $e(`c:payment:pricing:${planCardClick ? 'plan-card' : 'compare-features'}:choose-plan`, {
        activePlan: activePlan.value?.title || PlanTitles.FREE,
        newPlan: planTitle,
        paymentMode: paymentModeInput,
      })
      openNewTab('https://cal.com/nocodb')
      return
    }

    if (
      activePlan.value?.title.toLowerCase() === PlanTitles.FREE.toLowerCase() &&
      planTitle.toLowerCase() === PlanTitles.FREE.toLowerCase()
    ) {
      $e('c:payment:pricing:choose-current-plan:navigate-to-billing', {
        activePlan: activePlan.value?.title || PlanTitles.FREE,
      })
      navigateTo(`/${activeWorkspace.value?.id}/settings?tab=billing`)
      return
    }

    $e(`c:payment:pricing:${planCardClick ? 'plan-card' : 'compare-features'}:choose-plan`, {
      activePlan: activePlan.value?.title || PlanTitles.FREE,
      newPlan: planTitle,
      paymentMode: paymentModeInput,
    })

    const plan = plansAvailable.value.find((plan) => plan.title.toLowerCase() === planTitle.toLowerCase())

    if (!plan) return

    paymentMode.value = paymentModeInput

    onSelectPlan(plan, !planCardClick)
  } else if (type === 'navigateToBilling') {
    $e('c:payment:pricing:navigate-to-billing')
    navigateToBilling({ isBackToBilling: true })
  } else if (type === 'frameLoaded') {
    frameLoaded.value = true
    const scrollTo = route?.query?.go
    if (scrollTo) {
      forcedNextTick(() => {
        sendIframeMessage({
          type: 'scrollTo',
          id: scrollTo,
        })
      })
    }
  }
})

const embedPage = computed(() => {
  let page = 'pricing'

  if (isLoyaltyDiscountAvailable.value && activeWorkspace.value?.segment_code === 7) {
    page = 'loyalty-pricing-2'
  } else if (isLoyaltyDiscountAvailable.value) {
    page = 'loyalty-pricing'
  }

  const searchQuery = new URLSearchParams()

  searchQuery.set('inApp', 'true')

  if (activeWorkspace.value?.title) {
    searchQuery.set('workspace', activeWorkspace.value?.title)
  }

  if (activeWorkspace.value?.id) {
    searchQuery.set('workspaceId', activeWorkspace.value?.id)
  }

  if (activePlan.value?.title) {
    searchQuery.set('plan', activePlan.value?.title)
  }

  if (paymentMode.value) {
    searchQuery.set('paymentMode', paymentMode.value)
  }

  searchQuery.set('isLoyaltyWorkspace', `${isLoyaltyDiscountAvailable.value}`)

  if (route.query?.activeBtn) {
    searchQuery.set('CTA', route.query?.activeBtn as string)
  }

  const hasExternal = getStatLimit(PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE) > 0

  if (hasExternal) {
    searchQuery.set('hasExternal', 'true')
  }

  return `${appInfo.value.marketingRootUrl}/${page}?${searchQuery.toString()}`
})
</script>

<template>
  <div class="overflow-hidden">
    <div v-if="!frameLoaded" class="w-full p-[20%] flex items-center justify-center">
      <GeneralLoader size="xlarge" />
    </div>
    <iframe v-show="frameLoaded" :src="embedPage" width="100%" style="border: none; height: calc(100vh - 56px)"></iframe>
  </div>
</template>
