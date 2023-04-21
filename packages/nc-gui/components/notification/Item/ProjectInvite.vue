<script setup lang="ts">
import { ProjectTypes } from 'nocodb-sdk'

const props = defineProps<{
  item: any
}>()

const item = toRef(props, 'item')
</script>

<template>
  <div class="flex items-center gap-2 cursor-pointer" @click="navigateTo(`/ws/${item.body.workspace_id}/nc/${item.body.id}`)">
    <div class="nc-notification-avatar"></div>
    <div class="flex-grow ml-4">
      <div class="flex items-center">
        <div class="text-xs">{{ item.body.invited_by }} has invited you to collaborate on {{ item.body.title }} project.</div>
      </div>
      <div class="text-xs text-gray-500">1 hour ago - NocoHUB</div>
    </div>
    <div class="self-start">
      <a-checkbox class="!my-0"></a-checkbox>
    </div>
  </div>
</template>

<style scoped>
.nc-notification-avatar {
  @apply w-12 h-12 rounded-full text-white font-weight-bold uppercase bg-gray-100;
  font-size: 0.7rem;
}
</style>
