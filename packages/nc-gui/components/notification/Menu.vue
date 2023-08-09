<script lang="ts" setup>
import { useNotification } from '#imports'

const notificationStore = useNotification()

const { loadNotifications, markAsOpened } = notificationStore

onMounted(async () => {
  await loadNotifications()
})

const onOpen = (visible: boolean) => {
  if (visible) {
    markAsOpened()
  }
}
</script>

<template>
  <div class="cursor-pointer flex items-center">
    <a-dropdown :trigger="['click']" @visible-change="onOpen">
      <div class="relative leading-none">
        <GeneralIcon icon="notification" />
        <GeneralIcon icon="menuDown" />
        <span v-if="!notificationStore.isOpened && notificationStore.unreadCount" class="nc-count-badge">{{
          notificationStore.unreadCount
        }}</span>
      </div>
      <template #overlay>
        <NotificationCard />
      </template>
    </a-dropdown>
  </div>
</template>

<style scoped>
.nc-count-badge {
  @apply absolute flex items-center top-[-6px] right-[-6px] px-1 min-w-[14px] h-[14px] rounded-full bg-accent bg-opacity-100 text-white !text-[9px] !z-21;
}
</style>
