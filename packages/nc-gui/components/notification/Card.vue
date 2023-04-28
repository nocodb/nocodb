<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from '@vue/reactivity'
import { useNotification } from '#imports'

const notificationStore = useNotification()

const { notifications: _notifications, readNotifications, isRead, pageInfo: _pageInfo, readPageInfo } = storeToRefs(notificationStore)


const notifications = computed(() => {
  return isRead.value ? readNotifications.value : _notifications.value
})

const pageInfo = computed(() => {
  return isRead.value ? readPageInfo.value : _pageInfo.value
})

const groupType = computed({
  get() {
    return isRead.value ? 'read' : 'unread'
  },
  set(value) {
    isRead.value = value === 'read'
    notificationStore.loadNotifications()
  },
})
</script>

<template>
  <div class="min-w-[500px] max-w-[500px] min-h-[400px] !rounded-2xl bg-white rounded-xl nc-card" @click.stop>
    <div class="p-6 pb-3.5">
      <div class="flex items-center">
        <span class="text-xl font-medium">
          <!-- todo: i18n -->
          Notification
        </span>
        <span class="flex-grow"></span>
        <GeneralIcon class="cursor-pointer" icon="settings" />
      </div>
    </div>
    <a-tabs v-model:activeKey="groupType">
      <a-tab-pane key="unread" tab="Unread">
        <span />
      </a-tab-pane>
      <a-tab-pane key="read" tab="Read"> <span /></a-tab-pane>

      <template #rightExtra>
        <div v-if="!isRead" class="mr-6 text-primary cursor-pointer text-xs" @click.stop="notificationStore.markAllAsRead">
          Mark all as read
        </div>
      </template>
    </a-tabs>

    <div
      class="px-6 overflow-y-auto max-h-[max(60vh,500px)] min-h-100"
      :class="{
        'flex items-center justify-center': !notifications?.length,
      }"
      @click.stop
    >
      <template v-if="!notifications?.length">
        <a-empty description="No new notifications"> </a-empty>
      </template>
      <template v-else>
        <template v-for="item in notifications" :key="item.id">
          <NotificationItem class="py-6" :item="item" />
          <a-divider class="!my-0" />
        </template>
      </template>

      <!-- TODO: notification - load more ui   -->
      <div
        v-if="notifications && pageInfo.totalRows > notifications.length"
        class="px-3 pb-6 pt-6 text-xs cursor-pointer text-gray-500"
        @click.stop="notificationStore.loadNotifications(true)"
      >
        Load more
      </div>
    </div>
  </div>
</template>

<style scoped>
.nc-card {
  border: solid 1px #e1e3e6;
}

:deep(.ant-tabs-nav-wrap) {
  @apply px-6;
}

:deep(.ant-tabs-nav) {
  @apply !mb-0;
}

:deep(.ant-tabs-tab-btn) {
  @apply !mb-1;
}
</style>
