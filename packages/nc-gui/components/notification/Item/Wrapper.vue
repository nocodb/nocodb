<script setup lang="ts">
import type { NotificationType } from 'nocodb-sdk'
import { timeAgo } from '~/utils/datetimeUtils'

const props = defineProps<{
  item: NotificationType
}>()

const item = toRef(props, 'item')

const { isMobileMode } = useGlobal()

const notificationStore = useNotification()

const { toggleRead, deleteNotification } = notificationStore
</script>

<template>
  <div class="flex pl-6 pr-4 w-full overflow-x-hidden group py-4 hover:bg-gray-50 gap-3 relative cursor-pointer">
    <div class="w-9.625">
      <slot name="avatar">
        <img src="~assets/img/brand/nocodb-logo.svg" alt="NocoDB" class="w-8" />
      </slot>
    </div>

    <div class="text-[13px] min-h-12 w-full leading-5">
      <slot />
    </div>
    <div v-if="item" class="text-xs whitespace-nowrap absolute right-4.1 bottom-5 text-gray-600">
      {{ timeAgo(item.created_at) }}
    </div>
    <div class="flex items-start">
      <NcTooltip v-if="!item.is_read">
        <template #title>
          <span>Mark as read</span>
        </template>

        <NcButton
          :class="{
            '!opacity-100': isMobileMode,
          }"
          type="secondary"
          class="!border-0 transition-all duration-100 opacity-0 !group-hover:opacity-100"
          size="xsmall"
          @click.stop="() => toggleRead(item)"
        >
          <GeneralIcon icon="check" class="text-gray-700" />
        </NcButton>
      </NcTooltip>
      <NcDropdown
        v-else
        :class="{
          '!opacity-100': isMobileMode,
        }"
        class="transition-all duration-100 opacity-0 !group-hover:opacity-100"
        placement="bottomRight"
      >
        <NcButton size="xsmall" type="secondary" @click.stop>
          <GeneralIcon icon="threeDotVertical" />
        </NcButton>

        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem @click.stop="() => toggleRead(item)"> Mark as unread </NcMenuItem>
            <NcDivider />
            <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click.stop="deleteNotification(item)"> Delete </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>
  </div>
</template>
