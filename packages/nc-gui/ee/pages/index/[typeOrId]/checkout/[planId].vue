<script lang="ts" setup>
const { activeSubscription } = useProvidePaymentStore()

const { hideSidebar, hideMiniSidebar, showTopbar, isNewSidebarEnabled } = storeToRefs(useSidebarStore())

const { appInfo } = useGlobal()

onMounted(() => {
  if (isNewSidebarEnabled.value) {
    hideSidebar.value = true
    hideMiniSidebar.value = true
  }

  showTopbar.value = true

  if (!appInfo.value.stripePublishableKey) {
    message.error('Stripe publishable key not found')
  }
})

onBeforeUnmount(() => {
  hideSidebar.value = false
  hideMiniSidebar.value = false
  showTopbar.value = false
})
</script>

<template>
  <div class="flex w-full pt-5 pb-10">
    <PaymentCheckout v-if="!activeSubscription" />
    <PaymentCheckoutChange v-else />
  </div>
</template>
