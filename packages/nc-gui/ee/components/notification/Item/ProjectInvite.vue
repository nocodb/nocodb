<script setup lang="ts">
import type { ProjectInviteEventType } from 'nocodb-sdk'

const props = defineProps<{
  item: ProjectInviteEventType
}>()

const { navigateToProject } = useGlobal()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper
    :item="item"
    @click="
      navigateToProject({
        workspaceId: item.body.workspace.id,
        baseId: item.body.base.id,
        type: item.body.base.type,
      })
    "
  >
    <div>
      <span class="font-semibold">{{ item.body.user.display_name ?? item.body.user.email }}</span> has invited you to collaborate
      on <span class="font-semibold">{{ item.body.base.title }}</span> base.
    </div>
    <span v-if="item.body.workspace.title" class="capitalize text-gray-600 bg-gray-200 rounded-lg !mt-2 px-2">
      {{ item.body.workspace.title }}
    </span>
  </NotificationItemWrapper>
</template>
