<script setup lang="ts">
import type { NotificationType } from 'nocodb-sdk'
import { timeAgo } from '~/utils/datetimeUtils'

const props = defineProps<{
  item: NotificationType
}>()

const item = toRef(props, 'item')

const notificationStore = useNotification()

const { toggleRead, deleteNotification } = notificationStore
</script>

<template>
  <div class="flex pl-6 pr-4 group py-4 hover:bg-gray-50 relative gap-4 cursor-pointer">
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
      <NcTooltip v-if="!item.is_read">
        <template #title>
          <span>Mark as read</span>
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
      <NcDropdown v-else>
        <NcButton size="xsmall" type="secondary" @click.stop>
          <GeneralIcon icon="threeDotVertical" />
        </NcButton>

        <template #overlay>
          <NcMenu>
            <NcMenuItem @click.stop="() => toggleRead(item)"> Mark as unread </NcMenuItem>
            <NcDivider />
            <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click.stop="deleteNotification(item)"> Delete </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
