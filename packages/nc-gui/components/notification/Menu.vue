<script lang="ts" setup>
import { useNotification } from '#imports'

const notificationStore = useNotification()

const { loadNotifications } = notificationStore

onMounted(async () => {
  await loadNotifications()
})
</script>

<template>
  <div class="cursor-pointer flex items-center">
    <a-dropdown :trigger="['click']">
      <div class="relative leading-none">
        <GeneralIcon icon="notification" />
        <GeneralIcon icon="menuDown" />
        <span v-if="notificationStore.pageInfo?.totalRows" class="nc-count-badge">{{
          notificationStore.pageInfo.totalRows
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
  @apply absolute flex items-center top-[-6px] right-[-6px] px-1 min-w-[14px] h-[14px] rounded-full bg-primary bg-opacity-100 text-white !text-[9px] !z-21;
}
</style>
