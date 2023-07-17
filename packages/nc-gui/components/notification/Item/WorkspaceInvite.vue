<script setup lang="ts">
import { useGlobal } from '#imports'

const props = defineProps<{
  item: any
}>()

const { navigateToProject } = $(useGlobal())

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateToProject({ workspaceId: item.body.id })">
    <div class="text-xs">
      <strong>{{ item.body.invited_by }}</strong> has invited you to collaborate on
      <strong>{{ item.body.title }}</strong> workspace.
    </div>
  </NotificationItemWrapper>
</template>
