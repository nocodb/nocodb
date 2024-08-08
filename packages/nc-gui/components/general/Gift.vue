<script setup lang="ts">
import { OrgUserRoles, extractRolesObj } from 'nocodb-sdk'

const { appInfo, giftBannerDismissedCount, user } = useGlobal()

const isBannerClosed = ref(true)
const isModalOpen = ref(false)
const confirmDialog = ref(false)

const isAvailable = computed(() => {
  return (
    !isEeUI &&
    user.value?.email &&
    [OrgUserRoles.CREATOR, OrgUserRoles.SUPER_ADMIN].some((r) => extractRolesObj(user.value?.roles)?.[r]) &&
    !/^[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|aol|icloud|qq|163|126|sina)(\.com)?$/i.test(user.value?.email) &&
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
  isModalOpen.value = true
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

const closeModal = () => {
  isModalOpen.value = false
  giftBannerDismissedCount.value++
  isBannerClosed.value = true
}

const onVisibleChange = (visible: boolean) => {
  if (!visible) {
    closeModal()
  }
}
</script>

<template>
  <div v-if="isAvailable && !isBannerClosed && appInfo.giftUrl" class="container" @click="open">
    <div class="wrapper">
      <div class="header">
        <GeneralIcon class="icon" icon="gift" size="xlarge" />
        <h4>Gifts Unlocked!</h4>
      </div>
      <div class="body">We are giving away $100 worth of amazon coupons to our pro open source users!</div>
    </div>
    <div class="img-wrapper">
      <img src="~assets/img/giftCard.svg" />
    </div>

    <NcButton type="text" size="small" class="close-icon" @click.stop="closeBanner">
      <GeneralIcon icon="close" size="xlarge" />
    </NcButton>

    <NcModal v-model:visible="isModalOpen" size="large" @update:visible="onVisibleChange">
      <div class="absolute top-4 right-4 cursor-pointer">
        <NcButton type="text" class="absolute top-3 right-3 cursor-pointer" @click="closeModal">
          <GeneralIcon icon="close" size="small" />
        </NcButton>
      </div>
      <div class="overflow-auto">
        <iframe
          width="100%"
          style="height: max(800px, 90vh)"
          :src="appInfo.giftUrl"
          title="Gifts Unlocked!"
          frameborder="0"
        ></iframe>
      </div>
    </NcModal>
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
  @apply relative bg-white hover:(shadow-default bg-gray-50) overflow-hidden cursor-pointer;
  .wrapper {
    @apply p-3 border-t-1;

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
