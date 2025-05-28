<script lang="ts" setup>
const isMiniSidebar = inject(IsMiniSidebarInj, undefined)

const notificationStore = useNotification()

const { unreadCount } = toRefs(notificationStore)

const isDropdownOpen = ref(false)
</script>

<template>
  <div class="cursor-pointer flex items-center">
    <NcDropdown v-model:visible="isDropdownOpen" overlay-class-name="!shadow-none" placement="bottomRight" :trigger="['click']">
      <div
        :class="{
          'nc-mini-sidebar-btn-full-width': isMiniSidebar,
          'flex': !isMiniSidebar,
        }"
      >
        <NcButton
          :size="isMiniSidebar ? 'xs' : 'small'"
          class="!border-none nc-mini-sidebar-btn"
          :class="{
            active: isDropdownOpen,
          }"
          type="text"
          data-testid="nc-sidebar-notification-btn"
        >
          <span
            v-if="unreadCount"
            :key="unreadCount"
            class="bg-red-500 w-2 h-2 border-1 border-white rounded-[6px] absolute top-[5px] left-[15px]"
          ></span>
          <GeneralIcon
            :icon="isDropdownOpen ? 'ncNotificationDuo' : 'notification'"
            :class="{
              'h-4 w-4': isMiniSidebar,
            }"
          />
        </NcButton>
      </div>

      <template #overlay>
        <NotificationCard @close="isDropdownOpen = false" />
      </template>
    </NcDropdown>
  </div>
</template>
