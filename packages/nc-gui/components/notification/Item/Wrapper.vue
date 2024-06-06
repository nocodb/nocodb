<script setup lang="ts">
import { timeAgo } from 'nocodb-sdk'

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
  <div class="flex pl-6 pr-4 group py-4 relative gap-4 cursor-pointer">
    <div class="w-12 h-12">
      <slot name="avatar">
        <img src="~assets/img/brand/nocodb-logo.svg" alt="NocoDB" class="flex-none w-12 h-12" />
      </slot>
    </div>

    <div class="flex flex-grow-1">
      <slot />
    </div>
    <div v-if="item" class="text-xs whitespace-nowrap text-gray-600">
      {{ timeAgo(item.created_at) }}
    </div>
    <div v-if="!item.is_read" class="flex absolute right-5 top-10 items-center">
      <NcTooltip>
        <template #title>
          <span>Mark as read</span>
        </template>

        <NcButton
          type="secondary"
          class="!border-0 transition-all duration-100 !opacity-0 !group-hover:opacity-100"
          size="xsmall"
          @click="() => markAsRead(item)"
        >
          <GeneralIcon icon="check" class="text-gray-700" />
        </NcButton>
      </NcTooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-notification-dot {
  @apply min-w-2 min-h-2 mr-1  rounded-full;

  &.active {
    @apply bg-accent bg-opacity-100;
  }
}
</style>
