<script lang="ts" setup>
const notificationStore = useNotification()

const { unreadCount } = toRefs(notificationStore)
</script>

<template>
  <div class="cursor-pointer flex items-center">
    <NcDropdown overlay-class-name="!shadow-none" placement="topRight" :trigger="['click']">
      <div class="relative leading-none">
        <GeneralIcon icon="notification" />
        <span
          v-if="unreadCount"
          :key="unreadCount"
          class="bg-red-500 flex items-center text-xs min-w-[14px] h-[18px] px-1 rounded-[6px] absolute top-[-10px] right-[-13px] text-white"
          >{{ unreadCount }}</span
        >
      </div>
      <template #overlay>
        <NotificationCard />
      </template>
    </NcDropdown>
  </div>
</template>

<style scoped>
.nc-count-badge {
  @apply flex items-center  px-1  rounded-full bg-[red-500] bg-opacity-100 !text-[9px] !z-21;
}
</style>
