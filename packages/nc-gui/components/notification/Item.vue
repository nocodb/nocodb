<script setup lang="ts">
import { AppEvents } from 'nocodb-sdk'
import { toRef, useNotification } from '#imports'

const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')

const notificationStore = useNotification()

const { markAsRead } = notificationStore
</script>

<template>
  <div class="select-none" @click="markAsRead(item)">
    <NotificationItemWelcome v-if="item.type === AppEvents.WELCOME" :item="item" />
    <NotificationItemProjectInvite v-else-if="item.type === AppEvents.PROJECT_INVITE" :item="item" />
    <NotificationItemWorkspaceInvite v-else-if="item.type === AppEvents.WORKSPACE_INVITE" :item="item" />
    <NotificationItemProjectEvent
      v-else-if="[AppEvents.PROJECT_CREATE, AppEvents.PROJECT_DELETE, AppEvents.PROJECT_UPDATE].includes(item.type)"
      :item="item"
    />
    <NotificationItemTableEvent
      v-else-if="[AppEvents.TABLE_CREATE, AppEvents.TABLE_DELETE, AppEvents.TABLE_UPDATE].includes(item.type)"
      :item="item"
    />
    <NotificationItemViewEvent
      v-else-if="[AppEvents.VIEW_CREATE, AppEvents.VIEW_DELETE, AppEvents.VIEW_UPDATE].includes(item.type)"
      :item="item"
    />
    <NotificationItemSharedViewEvent
      v-else-if="[AppEvents.SHARED_VIEW_CREATE, AppEvents.SHARED_VIEW_DELETE, AppEvents.SHARED_VIEW_UPDATE].includes(item.type)"
      :item="item"
    />
    <NotificationItemWorkspaceEvent
      v-else-if="[AppEvents.WORKSPACE_CREATE, AppEvents.WORKSPACE_DELETE, AppEvents.WORKSPACE_UPDATE].includes(item.type)"
      :item="item"
    />
    <span v-else />
  </div>
</template>

<style scoped></style>
