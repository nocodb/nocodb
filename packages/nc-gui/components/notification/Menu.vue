<script lang="ts" setup>

import {useNotification} from "#imports";

const notificationStore = useNotification()

const { loadNotifications } = notificationStore

onMounted(async () => {
await  loadNotifications()
})

</script>

<template>    <div class="cursor-pointer">

<a-dropdown :trigger="['click']" >
    <GeneralIcon icon="notification" />
    <GeneralIcon icon="menuDown" />
    <template #overlay>
      <NotificationCard />
    </template>
  </a-dropdown>
  </div>
</template>

<style scoped></style>
