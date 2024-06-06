<script setup lang="ts">
import type { WorkspaceInviteEventType } from 'nocodb-sdk'

const props = defineProps<{
  item: WorkspaceInviteEventType
}>()

const { navigateToProject } = useGlobal()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateToProject({ workspaceId: item.body.workspace.id })">
    <div>
      <span class="font-semibold">{{ item.body.user.display_name ?? item.body.user.email }}</span> has invited you to collaborate
      on <span class="font-semibold">{{ item.body.workspace.title }}</span> workspace.
    </div>
  </NotificationItemWrapper>
</template>
