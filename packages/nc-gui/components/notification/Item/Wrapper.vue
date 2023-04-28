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
    <div class="nc-notification-dot" :class="{ active: !item.is_read }"></div>
    <div class="nc-avatar-wrapper">
      <slot name="avatar">
        <div class="nc-notification-avatar"></div>
      </slot>
    </div>
    <div class="flex-grow ml-3">
      <div class="flex items-center">
        <slot />
      </div>
      <div
        v-if="item"
        class="text-xs text-gray-500 mt-1"
        :class="{
          'text-primary': !item.is_read,
        }"
      >
        {{ timeAgo(item.created_at) }}
      </div>
    </div>
    <!--    <div class="self-start"> -->
    <!--      <a-checkbox class="!my-0"></a-checkbox> -->
    <!--    </div> -->
  </div>
</template>

<style scoped lang="scss">
.nc-avatar-wrapper {
  @apply min-w-6 h-6 flex items-center justify-center;
}

.nc-notification-avatar {
  @apply w-6 h-6 rounded-full text-white font-weight-bold uppercase bg-gray-100;
  font-size: 0.7rem;
}

.nc-notification-dot {
  @apply w-1 h-1 rounded-full;

  &.active {
    @apply bg-accent;
  }
}
</style>
