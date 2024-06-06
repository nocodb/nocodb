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
      <strong>{{ item.body.user.display_name ?? item.body.user.email }}</strong> has invited you to collaborate on
      <GeneralProjectIcon style="vertical-align: middle" :type="item.body.base.type" />
      <strong>{{ item.body.base.title }}</strong> base.
    </div>
  </NotificationItemWrapper>
</template>
