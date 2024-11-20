<script lang="ts" setup>
const notificationStore = useNotification()

const { unreadCount } = toRefs(notificationStore)
</script>

<template>
  <div class="cursor-pointer flex items-center">
    <NcDropdown overlay-class-name="!shadow-none" placement="bottomRight" :trigger="['click']">
      <NcButton size="small" class="!border-none" type="text">
        <span
          v-if="unreadCount"
          :key="unreadCount"
          class="bg-red-500 w-2 h-2 border-1 border-white rounded-[6px] absolute top-[5px] left-[15px]"
        ></span>
        <GeneralIcon icon="notification" />
      </NcButton>

      <template #overlay>
        <NotificationCard />
      </template>
    </NcDropdown>
  </div>
</template>
