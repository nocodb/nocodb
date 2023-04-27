<script setup lang="ts">
const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper @click="navigateTo(`/ws/${item.body.workspace_id}`)" :item="item">
    <div class="text-xs">{{ item.body.invited_by }} has invited you to collaborate on {{ item.body.title }} workspace.</div>
  </NotificationItemWrapper>
</template>
