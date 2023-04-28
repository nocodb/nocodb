<script setup lang="ts">
const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')
</script>

<template>
  <NotificationItemWrapper :item="item" @click="navigateTo(`/ws/${item.body.workspace_id}/nc/${item.body.id}`)">
    <div class="text-xs">
      <strong>{{ item.body.invited_by }}</strong> has invited you to collaborate on
      <GeneralProjectIcon style="vertical-align: middle" :type="item.body.type" /> <strong>{{ item.body.title }}</strong> project.
    </div>
  </NotificationItemWrapper>
</template>
