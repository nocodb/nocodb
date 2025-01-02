<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import InfiniteLoading from 'v3-infinite-loading'

const notificationStore = useNotification()

const { isMobileMode } = useGlobal()

const container = ref()

const { height } = useElementSize(container)

const { loadUnReadNotifications, loadReadNotifications, markAllAsRead } = notificationStore

const { unreadNotifications, readNotifications, readPageInfo, unreadPageInfo, notificationTab } = storeToRefs(notificationStore)
</script>

<template>
  <div
    ref="container"
    style="box-shadow: 0px -12px 16px -4px rgba(0, 0, 0, 0.1), 0px -4px 6px -2px rgba(0, 0, 0, 0.06)"
    :style="!isMobileMode ? 'width: min(80svw, 520px);' : ''"
    :class="{
      'max-h-[70vh] h-[620px]': !isMobileMode,
      'h-[100svh] w-[100svw]': isMobileMode,
    }"
    class="!rounded-lg pt-4"
  >
    <div class="space-y-3">
      <div class="flex px-6 justify-between items-center">
        <span class="text-md font-bold text-gray-800" @click.stop> {{ $t('general.notification') }}s </span>

        <NcButton v-if="isMobileMode" size="small" type="secondary">
          <GeneralIcon icon="close" class="text-gray-700" />
        </NcButton>
      </div>
      <div
        v-if="notificationTab !== 'read'"
        :class="{
          'text-gray-400': !unreadNotifications?.length,
        }"
        class="cursor-pointer right-5 pointer-events-auto top-12.5 z-2 absolute text-[13px] text-gray-600 font-weight-semibold"
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
              {{ $t('general.unread') }}
            </span>
          </template>
          <div
            class="overflow-y-auto"
            :style="`height: ${height - 72}px`"
            :class="{
              'flex flex-col items-center min-h-[48svh] justify-center': !unreadNotifications?.length,
            }"
          >
            <template v-if="!unreadNotifications?.length">
              <div class="text-sm !text-gray-500">{{ $t('msg.noNewNotifications') }}</div>
              <GeneralIcon icon="inbox" class="!text-40px !text-gray-500" />
            </template>
            <template v-else>
              <NotificationItem v-for="item in unreadNotifications" :key="item.id" :item="item" />

              <InfiniteLoading
                v-if="unreadNotifications && unreadPageInfo && unreadPageInfo.totalRows > unreadNotifications.length"
                @infinite="loadUnReadNotifications(true)"
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
              {{ $t('general.read') }}
            </span>
          </template>

          <div
            class="overflow-y-auto"
            :style="!isMobileMode ? `height: ${height - 72}px` : ''"
            :class="{
              'flex flex-col items-center min-h-[48svh] justify-center': !readNotifications?.length,
            }"
          >
            <template v-if="!readNotifications?.length">
              <div class="text-sm text-gray-500">{{ $t('msg.noNewNotifications') }}</div>
              <GeneralIcon icon="inbox" class="!text-40px text-gray-500" />
            </template>
            <template v-else>
              <NotificationItem v-for="item in readNotifications" :key="item.id" :item="item" />

              <InfiniteLoading
                v-if="readNotifications && readPageInfo && readPageInfo.totalRows > readNotifications.length"
                @infinite="loadReadNotifications(true)"
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
