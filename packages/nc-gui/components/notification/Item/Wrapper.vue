<script setup lang="ts">
import { timeAgo } from '#imports'

const props = defineProps<{
  item: {
    created_at: any
  }
}>()

const item = toRef(props, 'item')
</script>

<template>
  <div class="flex items-center gap-2 cursor-pointer">
    <div class="nc-notification-avatar"></div>
    <div class="flex-grow ml-4">
      <div class="flex items-center">
        <slot />
      </div>
      <div v-if="item" class="text-xs text-gray-500">{{ timeAgo(item.created_at) }} - NocoHUB</div>
    </div>
    <div class="self-start">
<!--      <a-checkbox class="!my-0"></a-checkbox>-->
    </div>
  </div>
</template>

<style scoped>
.nc-notification-avatar {
  @apply w-12 h-12 rounded-full text-white font-weight-bold uppercase bg-gray-100;
  font-size: 0.7rem;
}
</style>
