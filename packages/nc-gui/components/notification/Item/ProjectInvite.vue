<script setup lang="ts">
import type { ProjectInviteEventType } from 'nocodb-sdk'

const props = defineProps<{
  item: ProjectInviteEventType
}>()

const { navigateToProject } = useGlobal()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateToProject({ baseId: item.body.base.id })">
    <div class="text-xs">
      <span class="font-semibold">{{ item.body.user.display_name ?? item.body.user.email }}</span> has invited you to collaborate
      on
      <GeneralProjectIcon style="vertical-align: middle" :type="item.body.base.type" />
      <span class="font-semibold">{{ item.body.base.title }}</span> base.
    </div>
  </NotificationItemWrapper>
</template>
