<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed } from '@vue/reactivity'
import { useNotification } from '#imports'

import InfiniteLoading from 'v3-infinite-loading'

const notificationStore = useNotification()

const {
  notifications, // : _notifications,
  // readNotifications,
  isRead,
  pageInfo, // : _pageInfo,
  // readPageInfo,
} = storeToRefs(notificationStore)

// const notifications = computed(() => {
//   return isRead.value ? readNotifications.value : _notifications.value
// })
//
// const pageInfo = computed(() => {
//   return isRead.value ? readPageInfo.value : _pageInfo.value
// })

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
  <div class="min-w-[350px] max-w-[350px] min-h-[400px] !rounded-2xl bg-white rounded-xl nc-card" @click.stop>
    <div class="p-3">
      <div class="flex items-center">
        <span class="text-md font-medium text-[#212121]">
          <!-- todo: i18n -->
          Notification
        </span>
        <div class="flex-grow"></div>
        <div
            v-if="!isRead && notifications?.length"
            class="cursor-pointer text-xs text-gray-500 hover:text-primary"
            @click.stop="notificationStore.markAllAsRead"
        >
          Mark all as read
        </div>
<!--        <GeneralIcon class="cursor-pointer !text-16px" icon="settings" />-->
      </div>
    </div>
    <a-divider class="!my-0" />

    <!--    <a-tabs v-model:activeKey="groupType"> -->
    <!--      <a-tab-pane key="unread" tab="Unread"> -->
    <!--        <span /> -->
    <!--      </a-tab-pane> -->
    <!--      <a-tab-pane key="read" tab="Read"> <span /></a-tab-pane> -->

    <!--      <template #rightExtra> -->
<!--    <div class="flex px-3">-->

<!--    </div>-->
    <!--      </template> -->
    <!--    </a-tabs> -->

    <div
      class="overflow-y-auto max-h-[max(60vh,500px)] min-h-100"
      :class="{
        'flex items-center justify-center': !notifications?.length,
      }"
      @click.stop
    >
      <template v-if="!notifications?.length">
        <div class="flex flex-col gap-2 items-center justify-center">
          <div class="text-sm text-gray-400">You have no new notifications</div>
          <GeneralIcon icon="inbox" class="!text-40px text-gray-400" />
        </div>
      </template>
      <template v-else>
        <template v-for="item in notifications" :key="item.id">
          <NotificationItem class="" :item="item" />
          <a-divider class="!my-0" />
        </template>


        <InfiniteLoading v-if="notifications && pageInfo && pageInfo.totalRows > notifications.length" @infinite="notificationStore.loadNotifications(true)">
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
