<script setup lang="ts">
import { AppEvents } from 'nocodb-sdk'
import type { NotificationType } from 'nocodb-sdk'

const props = defineProps<{
  item: NotificationType
}>()

const item = toRef(props, 'item')

const notificationStore = useNotification()

const { toggleRead } = notificationStore
</script>

<template>
  <div class="select-none" @click="toggleRead(item, item.is_read)">
    <NotificationItemWelcome v-if="item.type === AppEvents.WELCOME" :item="item" />
    <NotificationItemProjectInvite v-else-if="item.type === AppEvents.PROJECT_INVITE" :item="item" />
    <NotificationItemWorkspaceInvite v-else-if="item.type === AppEvents.WORKSPACE_INVITE" :item="item" />
    <NotificationItemMentionEvent v-else-if="['mention'].includes(item.type)" :item="item" />
    <NotificationItemRowMentionEvent v-else-if="AppEvents.ROW_USER_MENTION === item.type" :item="item" />
    <span v-else />
  </div>
</template>

<style scoped></style>
