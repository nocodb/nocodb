<script setup lang="ts">
import { timeAgo } from '#imports'


const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')
</script>

<template>

  <NotificationItemWrapper :item="item" @click="navigateTo(`/ws/${item.body.workspace_id}/nc/${item.body.id}`)">
    <div class="text-xs">{{ item.body.invited_by }} has invited you to collaborate on {{ item.body.title }} project.</div>
  </NotificationItemWrapper>

</template>
