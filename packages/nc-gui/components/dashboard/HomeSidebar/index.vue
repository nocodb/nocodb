<script setup lang="ts">
const { user, isMobileMode } = useGlobal()

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const notificationStore = useNotification()

const { unreadCount } = toRefs(notificationStore)

const { isDark } = useTheme()

const name = computed(() => user.value?.display_name?.trim())

const isUserMenuOpen = ref(false)

const isNotificationOpen = ref(false)

const searchQuery = useState<string>('ws-home-search', () => '')

const navigateToWorkspace = () => {
  navigateTo(`/${activeWorkspaceId.value}`)

  if (isMobileMode.value) {
    isLeftSidebarOpen.value = false
  }
}
</script>

<template>
  <div class="nc-home-sidebar flex flex-col h-full bg-nc-bg-gray-sidebar border-r-1 border-nc-border-gray-light select-none">
    <!-- Brand header -->
    <div class="w-full px-2 py-1.5 flex items-center justify-between gap-2 h-[var(--topbar-height)] flex-none">
      <div class="pl-1">
        <img v-if="isDark" alt="NocoDB" src="~/assets/img/brand/full-logo.png" class="h-9" />
        <img v-else alt="NocoDB" src="~/assets/img/brand/nocodb-full-color.png" class="h-9" />
      </div>

      <GeneralHideLeftSidebarBtn show-always />
    </div>

    <!-- Search input (desktop only — mobile has search in base list header) -->
    <div class="hidden md:flex px-2 h-[var(--toolbar-height)] items-center">
      <a-input
        v-model:value="searchQuery"
        :placeholder="$t('activity.searchProject')"
        allow-clear
        class="nc-input-border-on-value nc-home-sidebar-search nc-input-sm"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="text-nc-content-gray-muted/80 mr-0.5" />
        </template>
      </a-input>
    </div>

    <!-- Workspace section -->
    <div class="flex-1 flex flex-col overflow-hidden nc-project-home-section !pb-0">
      <div class="nc-ws-section-header flex items-center justify-between">
        <span>{{ $t('objects.workspace') }}</span>
      </div>

      <div class="flex-1 overflow-y-auto nc-scrollbar-thin px-1">
        <NcSidebarMenuItem
          v-if="activeWorkspaceId"
          class="group !my-1 !h-11 !gap-3 !text-sm"
          :active="true"
          data-testid="nc-home-sidebar-ws-nc"
          @click="navigateToWorkspace()"
        >
          <template #icon>
            <GeneralIcon icon="ncWorkspace" class="flex-none h-5 w-5" />
          </template>
          <span class="capitalize">Default Workspace</span>
        </NcSidebarMenuItem>
      </div>
    </div>

    <!-- Bottom section: User info + notification bell -->
    <div class="flex-none border-t-1 border-nc-border-gray-light p-1.5">
      <div class="flex items-center gap-0.5">
        <NcDropdown v-model:visible="isUserMenuOpen" placement="topLeft" overlay-class-name="!min-w-56">
          <div
            class="flex items-center gap-2 pl-1.5 pr-2 h-8 rounded-md cursor-pointer flex-1 min-w-0 transition-colors"
            :class="{
              'bg-nc-bg-gray-medium': isUserMenuOpen,
              'hover:bg-nc-bg-gray-medium': !isUserMenuOpen,
            }"
            data-testid="nc-sidebar-userinfo"
            :data-email="user?.email"
          >
            <GeneralUserIcon :user="user" size="medium" :initials-length="1" class="flex-none" />
            <div class="flex-1 min-w-0">
              <NcTooltip show-on-truncate-only class="truncate text-bodyDefaultSm text-nc-content-gray block">
                <template #title>{{ name || user?.email }}</template>
                {{ name || user?.email }}
              </NcTooltip>
            </div>
          </div>
          <template #overlay>
            <DashboardSidebarUserInfoMenu @close-menu="isUserMenuOpen = false" />
          </template>
        </NcDropdown>

        <!-- Notification bell -->
        <NcDropdown v-model:visible="isNotificationOpen" :trigger="['click']" placement="topRight" overlay-class-name="!min-w-80">
          <NcTooltip placement="top" :arrow="false" :disabled="isNotificationOpen">
            <template #title>{{ $t('general.notification') }}</template>
            <NcButton
              type="text"
              size="xxsmall"
              class="!rounded-md !w-8 !h-8 !min-w-8 relative flex-none"
              data-testid="nc-home-sidebar-notification"
            >
              <span
                v-if="unreadCount"
                class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full border border-white dark:border-[#1a1a1a]"
                style="background: #e75a8d"
              />
              <GeneralIcon icon="ncBell" class="h-4 w-4" />
            </NcButton>
          </NcTooltip>
          <template #overlay>
            <NotificationCard @close="isNotificationOpen = false" />
          </template>
        </NcDropdown>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-home-sidebar {
  @apply !pb-0;
  width: 100%;
}

.nc-ws-section-header {
  @apply px-2 pt-1.5 pb-1 font-semibold text-nc-content-brand uppercase tracking-wide;
  font-size: 13px;
}

.nc-home-sidebar-search {
  @apply !rounded-lg;

  :deep(.ant-input) {
    @apply !border-none !shadow-none !text-bodyDefaultSm;
  }

  :deep(.ant-input-affix-wrapper) {
    @apply !border-none !shadow-none rounded-lg px-2 py-1;
  }
}
</style>
