<script setup lang="ts">
import { toRef, useNotification } from '#imports'

const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')

const notificationStore = useNotification()

const { markAsRead } = notificationStore
</script>

<template>
  <div class="select-none" @click.stop="markAsRead(item)">
    <NotificationItemWelcome v-if="item.type === 'WELCOME'" :item="item" />
    <NotificationItemProjectInvite v-else-if="item.type === 'PROJECT_INVITE'" :item="item" />
    <NotificationItemWorkspaceInvite v-else-if="item.type === 'WORKSPACE_INVITE'" :item="item" />
    <span v-else />
  </div>
</template>

<style scoped></style>
