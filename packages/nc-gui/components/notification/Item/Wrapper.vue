<script setup lang="ts">
import { timeAgo } from '#imports'

const props = defineProps<{
  item: {
    created_at: any
  }
}>()

const item = toRef(props, 'item')

const notificationStore = useNotification()

const { markAsRead } = notificationStore
</script>

<template>
  <div
    class="flex items-center gap-1 cursor-pointer nc-notification-item-wrapper"
    :class="{
      active: !item.is_read,
    }"
  >
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
    <div @click.stop>
      <a-dropdown>
        <GeneralIcon v-if="!item.is_read" icon="threeDotVertical" class="nc-notification-menu-icon" />
        <template #overlay>
          <a-menu>
            <a-menu-item @click="markAsRead(item)">
              <div class="p-2 text-xs">Mark as read</div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>
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
  @apply min-w-2 min-h-2 mr-1  rounded-full;

  &.active {
    @apply bg-accent bg-opacity-100;
  }
}

.nc-notification-item-wrapper {
  .nc-notification-menu-icon {
    @apply !text-12px text-gray-500 opacity-0 transition-opacity duration-200 cursor-pointer;
  }

  &:hover {
    .nc-notification-menu-icon {
      @apply opacity-100;
    }
  }

  &.active {
    @apply bg-primary bg-opacity-4;
  }

  @apply py-3 px-3;
}
</style>
