<script setup lang="ts">
import { OrgUserRoles, extractRolesObj } from 'nocodb-sdk'

const { appInfo, giftBannerDismissedCount, user } = useGlobal()

const isBannerClosed = ref(true)
const isModalOpen = ref(false)

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
const close = () => {
  isBannerClosed.value = true
  if (!giftBannerDismissedCount.value || giftBannerDismissedCount.value < 4) {
    const modal = Modal.confirm({
      title: 'Do you want to remind later on your next visit?',
      okText: 'Yes',
      onOk: () => {
        modal.destroy()
        isBannerClosed.value = true
        giftBannerDismissedCount.value++
      },
      onCancel: () => {
        modal.destroy()
        isBannerClosed.value = false
        giftBannerDismissedCount.value = 5
      },
      cancelText: 'Don’t show again',
    })
  } else {
    giftBannerDismissedCount.value++
  }
}

const closeModal = () => {
  isModalOpen.value = false
  giftBannerDismissedCount.value++
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

    <NcButton type="text" size="small" class="close-icon" @click.stop="close">
      <GeneralIcon icon="close" size="xlarge" />
    </NcButton>

    <NcModal v-model:visible="isModalOpen" size="large" @ok="closeModal">
      <div class="absolute top-4 right-4 cursor-pointer">
        <NcButton type="text" class="absolute top-3 right-3 cursor-pointer" @click="closeModal">
          <GeneralIcon icon="close" size="small" />
        </NcButton>
      </div>
      <div class="overflow-auto">
        <iframe
          width="100%"
          style="height: max(600px, 90vh)"
          :src="appInfo.giftUrl"
          title="Gifts Unlocked!"
          frameborder="0"
        ></iframe>
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
