<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import InfiniteLoading from 'v3-infinite-loading'

const notificationStore = useNotification()

const { isMobileMode } = useGlobal()

const { loadNotifications, markAllAsRead } = notificationStore

const { notifications, pageInfo, notificationTab } = storeToRefs(notificationStore)
</script>

<template>
  <div
    :class="{
      '!w-[100svw] !h-[100svh]': isMobileMode,
    }"
    class="w-[520px] h-[620px] pt-4"
  >
    <div class="space-y-6">
      <div class="flex px-6 justify-between items-center">
        <span class="text-md font-bold text-gray-800" @click.stop> {{ $t('general.notification') }}s </span>

        <NcButton v-if="isMobileMode" size="small" type="secondary">
          <GeneralIcon icon="close" class="text-gray-700" />
        </NcButton>
      </div>
      <div
        v-if="notificationTab !== 'read'"
        :class="{
          'text-gray-400': !notifications?.length,
        }"
        class="cursor-pointer right-5 pointer-events-auto top-12.5 z-2 absolute text-[13px] text-gray-700 font-weight-semibold"
        @click.stop="markAllAsRead"
      >
        {{ $t('activity.markAllAsRead') }}
      </div>
      <NcTabs v-model:activeKey="notificationTab">
        <a-tab-pane key="unread">
          <template #tab>
            <span
              :class="{
                'font-semibold': notificationTab === 'unread',
              }"
              class="text-xs"
            >
              Unread
            </span>
          </template>
          <div
            class="overflow-y-auto max-h-[max(60vh,520px)] min-h-100"
            :class="{
              'flex items-center justify-center': !notifications?.length,
            }"
          >
            <template v-if="!notifications?.length">
              <div class="flex flex-col gap-2 items-center justify-center">
                <div class="text-sm text-gray-400">{{ $t('msg.noNewNotifications') }}</div>
                <GeneralIcon icon="inbox" class="!text-40px text-gray-400" />
              </div>
            </template>
            <template v-else>
              <template v-for="item in notifications" :key="item.id">
                <NotificationItem class="" :item="item" />
                <NcDivider />
              </template>

              <InfiniteLoading
                v-if="notifications && pageInfo && pageInfo.totalRows > notifications.length"
                @infinite="loadNotifications(true)"
              >
              </InfiniteLoading>
            </template>
          </div>
        </a-tab-pane>
        <a-tab-pane key="read">
          <template #tab>
            <span
              :class="{
                'font-semibold': notificationTab === 'read',
              }"
              class="text-xs"
            >
              Read
            </span>
          </template>

          <div
            class="overflow-y-auto max-h-[max(60vh,520px)] min-h-100"
            :class="{
              'flex items-center justify-center': !notifications?.length,
            }"
          >
            <template v-if="!notifications?.length">
              <div class="flex flex-col gap-2 items-center justify-center">
                <div class="text-sm text-gray-500">{{ $t('msg.noNewNotifications') }}</div>
                <GeneralIcon icon="inbox" class="!text-40px text-gray-500" />
              </div>
            </template>
            <template v-else>
              <template v-for="item in notifications" :key="item.id">
                <NotificationItem class="" :item="item" />
                <NcDivider />
              </template>

              <InfiniteLoading
                v-if="notifications && pageInfo && pageInfo.totalRows > notifications.length"
                @infinite="loadNotifications(true)"
              >
              </InfiniteLoading>
            </template>
          </div>
        </a-tab-pane>
      </NcTabs>
    </div>
  </div>
</template>

<style scoped>
:deep(.ant-tabs-nav-wrap) {
  @apply px-3;
}

:deep(.ant-tabs-tab) {
  @apply pb-1.5 pt-1;
}

:deep(.ant-tabs-nav) {
  @apply !mb-0;
}

:deep(.ant-tabs-tab-btn) {
  @apply !mb-1;
}
</style>
