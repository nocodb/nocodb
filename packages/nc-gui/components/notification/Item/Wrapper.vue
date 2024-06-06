<script setup lang="ts">
import type { NotificationType } from 'nocodb-sdk'
import { timeAgo } from '~/utils/datetimeUtils'

const props = defineProps<{
  item: NotificationType
}>()

const item = toRef(props, 'item')

const notificationStore = useNotification()

const { toggleRead } = notificationStore
</script>

<template>
  <div class="flex pl-6 pr-4 group py-4 relative gap-4 cursor-pointer">
    <div class="w-8 h-8">
      <slot name="avatar">
        <img src="~assets/img/brand/nocodb-logo.svg" alt="NocoDB" class="flex-none w-8 h-8" />
      </slot>
    </div>

    <div class="flex w-full text-[13px] leading-5 flex-grow-1">
      <slot />
    </div>
    <div v-if="item" class="text-xs whitespace-nowrap absolute right-5 bottom-5 text-gray-600">
      {{ timeAgo(item.created_at) }}
    </div>
    <div class="flex items-start">
      <NcTooltip>
        <template #title>
          <span>{{ item.is_read ? 'Mark as unread' : 'Mark as read' }}</span>
        </template>

        <NcButton
          type="secondary"
          class="!border-0 transition-all duration-100 opacity-0 !group-hover:opacity-100"
          size="xsmall"
          @click.stop="() => toggleRead(item)"
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
