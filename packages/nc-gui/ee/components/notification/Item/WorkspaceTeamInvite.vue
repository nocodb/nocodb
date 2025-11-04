<script setup lang="ts">
import type { NotificationType } from 'nocodb-sdk'

const props = defineProps<{
  item: NotificationType
}>()

const { navigateToProject } = useGlobal()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateToProject({ workspaceId: item.body.workspace.id })">
    <div>
      <span class="font-semibold">{{ item.body.user.displayName ?? item.body.user.email }}</span> has added your team
      <span class="font-semibold">{{ item.body.team.title }}</span> to workspace
      <span class="font-semibold">{{ item.body.workspace.title }}</span> with role
      <span class="font-semibold">{{ item.body.role }}</span
      >.
    </div>
  </NotificationItemWrapper>
</template>
