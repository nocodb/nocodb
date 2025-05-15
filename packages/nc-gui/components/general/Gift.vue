<script setup lang="ts">
const { appInfo, giftBannerDismissedCount, user } = useGlobal()

const { $e } = useNuxtApp()

const isBannerClosed = ref(true)
const confirmDialog = ref(false)
const hideImage = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0) < 780

const isAvailable = computed(() => {
  return (
    !isEeUI &&
    user.value?.email &&
    !/^[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|aol|icloud|qq|163|126|sina|nocodb)(\.com)?$/i.test(user.value?.email) &&
    (!giftBannerDismissedCount.value || giftBannerDismissedCount.value < 5)
  )
})

if (giftBannerDismissedCount.value) {
  setTimeout(() => {
    isBannerClosed.value = false
  }, giftBannerDismissedCount.value * 60000)
} else {
  isBannerClosed.value = false
}

const open = () => {
  giftBannerDismissedCount.value++
  $e('a:claim:gift:coupon')
  window.open(appInfo.value?.giftUrl, '_blank', 'noopener,noreferrer')
}

const closeBanner = () => {
  if (!giftBannerDismissedCount.value || giftBannerDismissedCount.value < 4) {
    confirmDialog.value = true
  } else {
    isBannerClosed.value = true
    giftBannerDismissedCount.value++
  }
}

const dontShowAgain = () => {
  isBannerClosed.value = true
  giftBannerDismissedCount.value = 5
  confirmDialog.value = false
}

const closeAndShowAgain = () => {
  isBannerClosed.value = true
  giftBannerDismissedCount.value++
  confirmDialog.value = false
}
</script>

<template>
  <div v-if="isAvailable && !isBannerClosed && appInfo.giftUrl" class="container" @click="open">
    <div class="wrapper">
      <div class="header">
        <GeneralIcon class="icon" icon="gift" size="xlarge" />
        <h4>Gifts Unlocked!</h4>
      </div>
      <div class="body">We are giving away $25 worth of amazon coupons to our pro open source users!</div>
    </div>
    <div v-if="!hideImage && !giftBannerDismissedCount" class="img-wrapper">
      <img src="~assets/img/giftCard.svg" />
    </div>

    <NcButton type="text" size="small" class="close-icon" @click.stop="closeBanner">
      <GeneralIcon icon="close" size="xlarge" />
    </NcButton>
    <NcModal v-model:visible="confirmDialog" size="small">
      <div>
        <div class="mt-1 text-sm">Do you want to remind later on your next visit?</div>
        <div class="flex justify-end mt-7 gap-x-2">
          <NcButton type="secondary" size="small" @click="dontShowAgain"> Don’t show again </NcButton>
          <NcButton type="primary" size="small" @click="closeAndShowAgain"> Yes </NcButton>
        </div>
      </div>
    </NcModal>
  </div>
</template>

<style scoped lang="scss">
.container {
  @apply relative bg-white hover:(shadow-default bg-gray-50) overflow-hidden cursor-pointer rounded-lg;
  .wrapper {
    @apply p-3;

    .header {
      @apply flex items-center gap-3 mb-2;
      .icon {
        @apply -mt-1;
      }

      h4 {
        @apply text-lg mb-0 font-weight-bold;
      }
    }

    .body {
      @apply text-gray-600;
    }
  }

  .img-wrapper {
    @apply flex justify-center items-center bg-maroon-50 py-5 px-2 w-full;
    img {
      @apply !max-w-[170px];
    }
  }

  .close-icon {
    @apply absolute top-3 right-3;
  }
}
</style>
