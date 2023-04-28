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
  <div class="flex items-center gap-1 cursor-pointer">
    <div class="nc-avatar-wrapper">
      <slot name="avatar">
        <div class="nc-notification-avatar"></div>
      </slot>
    </div>
    <div class="flex-grow ml-3">
      <div class="flex items-center">
        <slot />
      </div>
      <div v-if="item" class="text-xs text-gray-500">{{ timeAgo(item.created_at) }} - NocoHUB</div>
    </div>
    <!--    <div class="self-start"> -->
    <!--      <a-checkbox class="!my-0"></a-checkbox> -->
    <!--    </div> -->
  </div>
</template>

<style scoped>
.nc-avatar-wrapper {
  @apply w-12 h-12 flex items-center justify-center;
}

.nc-notification-avatar {
  @apply w-12 h-12 rounded-full text-white font-weight-bold uppercase bg-gray-100;
  font-size: 0.7rem;
}
</style>
