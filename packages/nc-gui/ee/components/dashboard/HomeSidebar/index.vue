<script setup lang="ts">
const { user, isMobileMode } = useGlobal()

const workspaceStore = useWorkspace()

const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const isCreateWsDlgOpen = ref(false)

const navigateToWorkspace = (wsId: string) => {
  navigateTo(`/${wsId}`)
}

const name = computed(() => user.value?.display_name?.trim())

// Track which workspace context menu is open
const openMenuWsId = ref<string | null>(null)

// User menu
const isUserMenuOpen = ref(false)

const notificationStore = useNotification()

const { unreadCount } = toRefs(notificationStore)

const isNotificationOpen = ref(false)

const { isDark } = useTheme()
</script>

<template>
  <div class="nc-home-sidebar flex flex-col h-full bg-nc-bg-gray-sidebar border-r-1 border-nc-border-gray-light select-none">
    <!-- Brand header — same pattern as SidebarHeaderWrapper -->
    <div class="w-full px-2 py-1.5 flex items-center justify-between gap-2 h-[var(--topbar-height)] flex-none">
      <div class="pl-1">
        <img v-if="isDark" alt="NocoDB" src="~/assets/img/brand/text.png" class="h-4" />
        <img v-else alt="NocoDB" src="~/assets/img/brand/nocodb.png" class="h-4" />
      </div>
      <div class="flex items-center gap-0.5">
        <NcTooltip class="flex" placement="bottom" hide-on-click :disabled="!!isMobileMode">
          <template #title>
            {{ isLeftSidebarOpen ? $t('title.hideSidebar') : $t('title.showSidebar') }}
          </template>
          <NcButton
            v-e="['c:leftSidebar:hideToggle']"
            :type="isMobileMode ? 'secondary' : 'text'"
            :size="isMobileMode ? 'medium' : 'small'"
            class="nc-sidebar-left-toggle-icon !text-nc-content-gray-subtle !hover:text-nc-content-gray !md:(hover:bg-nc-bg-gray-medium) !rounded-md"
            @click="isLeftSidebarOpen = !isLeftSidebarOpen"
          >
            <div class="flex items-center text-inherit">
              <GeneralIcon v-if="isMobileMode" icon="close" />
              <GeneralIcon
                v-else
                icon="doubleLeftArrow"
                class="duration-150 transition-all !text-lg -mt-0.5 !text-nc-content-gray-muted bg-opacity-50"
                :class="{ 'transform rotate-180': !isLeftSidebarOpen }"
              />
            </div>
          </NcButton>
        </NcTooltip>
      </div>
    </div>

    <!-- Workspaces section -->
    <div class="flex-1 flex flex-col overflow-hidden nc-project-home-section !pb-0">
      <!-- Header -->
      <div class="nc-ws-section-header flex items-center justify-between">
        <span>{{ $t('labels.workspaces') }}</span>
        <NcButton type="text" size="xxsmall" data-testid="nc-home-sidebar-create-ws" @click="isCreateWsDlgOpen = true">
          <GeneralIcon icon="plus" class="h-3.5 w-3.5" />
        </NcButton>
      </div>

      <!-- Workspace list -->
      <div class="flex-1 overflow-y-auto nc-scrollbar-thin">
        <NcSidebarMenuItem
          v-for="ws in workspacesList"
          :key="ws.id"
          class="group"
          :active="activeWorkspaceId === ws.id"
          :data-testid="`nc-home-sidebar-ws-${ws.id}`"
          @click="navigateToWorkspace(ws.id!)"
        >
          <template #icon>
            <GeneralWorkspaceIcon :workspace="ws" size="small" class="flex-none" />
          </template>
          <span class="capitalize">{{ ws.title }}</span>
          <template #extraRight>
            <NcDropdown
              :trigger="['click']"
              @update:visible="(val: boolean) => { openMenuWsId = val ? ws.id! : null }"
              @click.stop
            >
              <NcButton
                type="text"
                size="xxsmall"
                class="nc-sidebar-node-btn !rounded-md flex-none"
                :class="{
                  '!opacity-100 !inline-block': openMenuWsId === ws.id,
                  'opacity-0 group-hover:opacity-100': openMenuWsId !== ws.id,
                }"
              >
                <GeneralIcon icon="threeDotVertical" class="text-nc-content-gray-subtle" />
              </NcButton>
              <template #overlay>
                <NcMenu variant="small">
                  <NcMenuItemCopyId
                    :id="ws.id"
                    :tooltip="$t('labels.clickToCopy')"
                    :label="$t('labels.workspaceId', { workspaceId: ws.id })"
                  />
                  <NcDivider />
                  <NcMenuItem @click.stop="navigateTo(`/${ws.id}/more`)">
                    <GeneralIcon icon="ncSettings" class="h-4 w-4" />
                    {{ $t('labels.settings') }}
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </template>
        </NcSidebarMenuItem>
      </div>
    </div>

    <!-- Templates & Import -->
    <div class="flex-none px-1 pb-1">
      <NcSidebarMenuItem icon="ncLayout">
        {{ $t('general.templates') }}
      </NcSidebarMenuItem>
      <NcSidebarMenuItem icon="ncDownload">
        {{ $t('general.import') }}
      </NcSidebarMenuItem>
    </div>

    <!-- Bottom section: User info with dropdown + notification bell -->
    <div class="flex-none border-t-1 border-nc-border-gray-light p-1.5">
      <div class="flex items-center gap-0.5">
        <NcDropdown v-model:visible="isUserMenuOpen" placement="topLeft" overlay-class-name="!min-w-56">
          <div
            class="flex items-center gap-2 pl-1.5 pr-2 h-8 rounded-md cursor-pointer flex-1 min-w-0 transition-colors"
            :class="{
              'bg-nc-bg-gray-medium': isUserMenuOpen,
              'hover:bg-nc-bg-gray-medium': !isUserMenuOpen,
            }"
            data-testid="nc-home-sidebar-userinfo"
          >
            <GeneralUserIcon :user="user" size="medium" class="flex-none" />
            <div class="flex-1 min-w-0">
              <NcTooltip show-on-truncate-only class="truncate text-bodyDefaultSm text-nc-content-gray block">
                <template #title>{{ name || user?.email }}</template>
                {{ name || user?.email }}
              </NcTooltip>
              <NcTooltip v-if="name" show-on-truncate-only class="truncate text-bodySm text-nc-content-gray-muted block">
                <template #title>{{ user?.email }}</template>
                {{ user?.email }}
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

    <!-- Create workspace dialog -->
    <LazyWorkspaceCreateDlg v-model:model-value="isCreateWsDlgOpen" />
  </div>
</template>

<style lang="scss" scoped>
.nc-home-sidebar {
  @apply !pb-0;
  width: 100%;
}

.nc-ws-section-header {
  @apply px-3 pt-1.5 pb-1 font-semibold text-nc-content-brand uppercase tracking-wide;
  font-size: 13px;
}
</style>
