<script setup lang="ts">
import { AppEvents } from 'nocodb-sdk'
import type { NotificationType } from 'nocodb-sdk'

const props = defineProps<{
  item: NotificationType
}>()

const emits = defineEmits(['close'])

const item = toRef(props, 'item')

const notificationStore = useNotification()

const { toggleRead } = notificationStore

// Clicking a notification acts on it (usually navigating away) — the popover
// closes so it doesn't sit over the destination.
function onItemClick() {
  toggleRead(item.value, item.value.is_read)
  emits('close')
}
</script>

<template>
  <div class="select-none" @click="onItemClick">
    <NotificationItemWelcome v-if="item.type === AppEvents.WELCOME" :item="item" />
    <NotificationItemProjectInvite v-else-if="item.type === AppEvents.PROJECT_INVITE" :item="item" />
    <NotificationItemWorkspaceInvite v-else-if="item.type === AppEvents.WORKSPACE_USER_INVITE" :item="item" />
    <NotificationItemMentionEvent v-else-if="['mention'].includes(item.type)" :item="item" />
    <NotificationItemRowMentionEvent v-else-if="AppEvents.ROW_USER_MENTION === item.type" :item="item" />
    <NotificationItemDocMentionEvent v-else-if="item.type === 'doc_mention'" :item="item" />
    <NotificationItemWorkspaceUpgradeRequest v-else-if="item.type === AppEvents.WORKSPACE_UPGRADE_REQUEST" :item="item" />
    <NotificationItemWorkspaceTeamInvite v-else-if="item.type === AppEvents.WORKSPACE_TEAM_INVITE" :item="item" />
    <NotificationItemProjectTeamInvite v-else-if="item.type === AppEvents.PROJECT_TEAM_INVITE" :item="item" />
    <NotificationItemTeamMemberInvite v-else-if="item.type === AppEvents.TEAM_MEMBER_ADD" :item="item" />
    <span v-else />
  </div>
</template>

<style scoped></style>
