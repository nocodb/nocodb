<script lang="ts" setup>
const notificationStore = useNotification()

const { loadNotifications } = notificationStore

const { unreadCount } = toRefs(notificationStore)

onMounted(async () => {
  await loadNotifications()
})
</script>

<template>
  <div class="cursor-pointer flex items-center">
    <NcDropdown placement="topRight" :trigger="['click']">
      <div class="relative leading-none">
        <GeneralIcon icon="notification" />
        <span v-if="unreadCount" class="nc-count-badge">{{ unreadCount }}</span>
      </div>
      <template #overlay>
        <NotificationCard />
      </template>
    </NcDropdown>
  </div>
</template>

<style scoped>
.nc-count-badge {
  @apply absolute flex items-center top-[-6px] right-[-6px] px-1 min-w-[14px] h-[14px] rounded-full bg-accent bg-opacity-100 text-white !text-[9px] !z-21;
}
</style>
