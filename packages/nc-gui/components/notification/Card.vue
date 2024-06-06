<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import InfiniteLoading from 'v3-infinite-loading'

const notificationStore = useNotification()

const { loadNotifications } = notificationStore

const { notifications, isRead, pageInfo, notificationTab } = storeToRefs(notificationStore)
</script>

<template>
  <div class="w-[520px] h-[620px] pt-4 border-1 border-gray-200 shadow-md !rounded-2xl bg-white rounded-xl">
    <div class="space-y-6">
      <div class="flex px-6 items-center" @click.stop>
        <span class="text-md font-bold text-gray-800"> {{ $t('general.notification') }}s </span>
      </div>
      <div
        v-if="!isRead && notifications?.length"
        class="cursor-pointer right-5 pointer-events-auto top-10 absolute text-[13px] text-gray-700 font-weight-semibold"
        @click.stop="notificationStore.markAllAsRead"
      >
        {{ $t('activity.markAllAsRead') }}
      </div>
      <NcTabs v-model:model-value="notificationTab" @click.stop>
        <a-tab-pane key="unread">
          hello
          <template #tab>
            <span
              :class="{
                'font-semibold': notificationTab === 'read',
              }"
              class="text-xs"
            >
              Unread
            </span>
          </template>
        </a-tab-pane>
        <a-tab-pane key="read">
          hello
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
        </a-tab-pane>
      </NcTabs>
    </div>

    <div
      class="overflow-y-auto max-h-[max(60vh,500px)] min-h-100"
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
          <a-divider class="!my-0" />
        </template>

        <InfiniteLoading
          v-if="notifications && pageInfo && pageInfo.totalRows > notifications.length"
          @infinite="loadNotifications(true)"
        >
          <template #spinner>
            <div class="flex flex-row w-full justify-center mt-2">
              <a-spin />
            </div>
          </template>
          <template #complete>
            <span></span>
          </template>
        </InfiniteLoading>
      </template>
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
