<script setup lang="ts">
const { user, isMobileMode } = useGlobal()

const router = useRouter()

const route = router.currentRoute

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { activeWorkspaceId, activeWorkspace, workspaceUserCount } = storeToRefs(workspaceStore)
const { loadCollaborators } = workspaceStore

const basesStore = useBases()
const { isProjectsLoaded, basesList } = storeToRefs(basesStore)

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isUIAllowed } = useRoles()

const { wsTabVisibility } = useWorkspaceTabVisibility(activeWorkspace)

const notificationStore = useNotification()

const { unreadCount } = toRefs(notificationStore)

const { isDark } = useTheme()

const isUserMenuOpen = ref(false)

const isNotificationOpen = ref(false)

const name = computed(() => user.value?.display_name?.trim())

// ── Sidebar navigation ──

interface NavItem {
  key: string
  icon: string
  label: string
  count?: number
  hidden?: boolean
}

const navItems = computed<NavItem[]>(() => {
  return [
    {
      key: 'bases',
      icon: 'ncBaseOutline',
      label: t('objects.projects'),
      count: isProjectsLoaded.value ? basesList.value.length : undefined,
    },
    {
      key: 'collaborators',
      icon: 'users',
      label: t('labels.inviteMembers'),
      count: workspaceUserCount.value,
      hidden: !wsTabVisibility.value.collaborators,
    },
    {
      key: 'integrations',
      icon: 'integration',
      label: t('general.integrations'),
      hidden: !wsTabVisibility.value.integrations,
    },
  ].filter((item) => !item.hidden)
})

const activeNavKey = computed(() => {
  if (isWsAdminRoute(route.value)) return 'admin'

  return routeNameToWsTab[route.value.name as string] || 'bases'
})

function onNavClick(item: NavItem) {
  if (item.key === 'collaborators' && isUIAllowed('workspaceCollaborators')) {
    loadCollaborators({}, activeWorkspaceId.value)
  }

  const typeOrId = route.value.params.typeOrId || activeWorkspaceId.value || 'nc'

  router.push({ name: wsTabToRouteName[item.key] || 'index-typeOrId', params: { typeOrId } })

  if (isMobileMode.value) {
    isLeftSidebarOpen.value = false
  }
}
</script>

<template>
  <div class="nc-home-sidebar flex flex-col h-full bg-nc-bg-default select-none" style="--topbar-height: 3.5rem">
    <!-- Brand header -->
    <div
      class="w-full px-2 py-1.5 flex items-center justify-between gap-2 h-[var(--topbar-height)] flex-none border-b-1 border-nc-border-gray-light"
    >
      <div class="pl-1">
        <img v-if="isDark" alt="NocoDB" src="~/assets/img/brand/full-logo.png" class="h-9" />
        <img v-else alt="NocoDB" src="~/assets/img/brand/nocodb-full-color.png" class="h-9" />
      </div>

      <!-- Only in the collapsed (peek) state, where it re-docks the sidebar. -->
      <GeneralHideLeftSidebarBtn v-if="!isLeftSidebarOpen" show-always />
    </div>

    <!-- Navigation section -->
    <div class="flex-1 flex flex-col overflow-hidden pt-2">
      <div class="nc-ws-section-header flex items-center justify-between">
        <span>{{ $t('objects.workspace') }}</span>
      </div>

      <div class="flex-1 overflow-y-auto nc-scrollbar-thin px-2">
        <NcSidebarMenuItem
          v-for="item in navItems"
          :key="item.key"
          :icon="item.icon"
          :active="activeNavKey === item.key"
          class="!h-8 !my-0.5"
          :data-testid="`nc-ws-sidebar-${item.key}`"
          @click="onNavClick(item)"
        >
          {{ item.label }}
          <template #extraRight>
            <span v-if="item.count !== undefined" class="text-bodySm text-nc-content-gray-muted mr-1.5">
              {{ item.count }}
            </span>
          </template>
        </NcSidebarMenuItem>
      </div>
    </div>

    <!-- Bottom section: User info + notification bell -->
    <div class="flex-none border-t-1 border-nc-border-gray-light px-2 py-1.5">
      <div class="flex items-center gap-0.5">
        <NcDropdown v-model:visible="isUserMenuOpen" placement="topLeft" overlay-class-name="!min-w-56">
          <div
            class="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer flex-1 min-w-0 transition-colors"
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
              <NcTooltip v-if="name" show-on-truncate-only class="truncate text-captionSm text-nc-content-gray-muted block">
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
  </div>
</template>

<style lang="scss">
// Match the pane splitter to the topbar's bottom border on the ws-home
.nc-sidebar-content-resizable-wrapper:has(.nc-home-sidebar) > .splitpanes__splitter:before {
  @apply !bg-nc-border-gray-light;
}
</style>

<style lang="scss" scoped>
.nc-home-sidebar {
  @apply !pb-0;
  width: 100%;
}

.nc-ws-section-header {
  @apply pl-5 pr-2 pt-1.5 pb-1.5 font-semibold text-nc-content-gray-muted uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
}
</style>
