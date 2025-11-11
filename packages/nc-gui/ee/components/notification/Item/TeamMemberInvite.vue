<script setup lang="ts">
import type { NotificationType } from 'nocodb-sdk'

const props = defineProps<{
  item: NotificationType
}>()

const { navigateToProject } = useGlobal()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper
    :item="item"
    @click="
      navigateToProject({
        workspaceId: item.body.workspace?.id,
        baseId: item.body.base?.id,
      })
    "
  >
    <div>
      <span class="font-semibold">{{ extractUserDisplayNameOrEmail(item.body.user) }}</span> has added you to the team
      <span class="font-semibold">{{ item.body.team.title }}</span>
      <span v-if="item.body.workspace">
        in workspace <span class="font-semibold">{{ item.body.workspace.title }}</span></span
      >
      <span v-if="item.body.base">
        in base <span class="font-semibold">{{ item.body.base.title }}</span></span
      >
      with role <span class="font-semibold">{{ item.body.teamRole }}</span
      >.
    </div>
  </NotificationItemWrapper>
</template>
