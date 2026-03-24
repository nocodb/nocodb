<script setup lang="ts">
import { NO_SCOPE } from 'nocodb-sdk'

const { user, isMobileMode, appInfo } = useGlobal()

const { orgRoles } = useRoles()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const workspaceStore = useWorkspace()

const { loadWorkspaces } = workspaceStore

const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)

const { $api, $e } = useNuxtApp()

const { navigateToTable } = useTablesStore()

const { isEEFeatureBlocked, showEEFeatures, showUpgradeToCreateWorkspace } = useEeConfig()

const isCreateWsDlgOpen = ref(false)

const isSuper = computed(() => orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

const canCreateWorkspace = computed(() => {
  if (appInfo.value.restrictWorkspaceCreation !== true) {
    return true
  }

  return !!isSuper.value
})

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

// ── Search (borrowed from BaseListModal) ──

interface BaseListAllData {
  workspaces: {
    id: string
    title: string
    meta: Record<string, any>
    plan_title: string | null
    bases: {
      id: string
      title: string
      meta: Record<string, any>
      role: string
      order: number
      managed_app_master?: boolean
      managed_app_id?: string | null
    }[]
  }[]
}

// Shared search state — used by both sidebar and WorkspaceHome content area
const searchQuery = useState<string>('ws-home-search', () => '')

const baseListAllData = ref<BaseListAllData | null>(null)
const isBaseListAllLoading = ref(false)

const loadBaseListAll = async () => {
  if (baseListAllData.value || isBaseListAllLoading.value) return

  isBaseListAllLoading.value = true
  try {
    baseListAllData.value = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
      operation: 'baseListAll',
    })) as BaseListAllData
  } catch {
    // silently fail
  } finally {
    isBaseListAllLoading.value = false
  }
}

// Load baseListAll on mount
onMounted(() => {
  loadBaseListAll()
})

// Workspace IDs that have at least one base title matching the search query
const baseListAllMatchByWs = computed(() => {
  if (!searchQuery.value || !baseListAllData.value) return new Map<string, number>()
  const map = new Map<string, number>()
  for (const ws of baseListAllData.value.workspaces) {
    const count = ws.bases.filter((b) => searchCompare(b.title, searchQuery.value)).length
    if (count > 0) map.set(ws.id, count)
  }
  return map
})

// Filtered workspace list: show all when no search, filter by ws title or base match when searching
const filteredWorkspaceList = computed(() => {
  if (!searchQuery.value) return workspacesList.value

  return workspacesList.value.filter(
    (ws) =>
      ws.id === activeWorkspaceId.value ||
      searchCompare(ws.title ?? '', searchQuery.value) ||
      baseListAllMatchByWs.value.has(ws.id),
  )
})

const isSearching = computed(() => !!searchQuery.value)

const hasNoResults = computed(() => {
  return isSearching.value && filteredWorkspaceList.value.length === 0
})

const onCreateWorkspace = () => {
  if (isEEFeatureBlocked.value) {
    showUpgradeToCreateWorkspace()
    return
  }

  $e('c:workspace:create')

  isCreateWsDlgOpen.value = true
}

const onWorkspaceCreate = async (workspace: NcWorkspace) => {
  isCreateWsDlgOpen.value = false
  await loadWorkspaces()

  const base = (workspace as any).bases?.[0]
  const table = base?.tables?.[0]

  if (base && table) {
    return await navigateToTable({
      baseId: base.id,
      tableId: table.id,
      workspaceId: workspace.id,
    })
  }

  if (workspace.id) {
    navigateToWorkspace(workspace.id)
  }
}
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

    <!-- Search input -->
    <div class="px-2 h-[var(--toolbar-height)] flex items-center">
      <a-input
        v-model:value="searchQuery"
        :placeholder="$t('placeholder.searchWorkspacesAndBases')"
        allow-clear
        class="nc-home-sidebar-search nc-input-sm"
      >
        <template #prefix>
          <GeneralLoader v-if="isBaseListAllLoading" size="regular" class="h-4 w-4 mr-0.5" />
          <GeneralIcon v-else icon="search" class="text-nc-content-gray-muted mr-0.5" />
        </template>
      </a-input>
    </div>

    <!-- Workspaces section -->
    <div class="flex-1 flex flex-col overflow-hidden nc-project-home-section !pb-0">
      <!-- Header -->
      <div class="nc-ws-section-header flex items-center justify-between">
        <span>{{ $t('labels.workspaces') }}</span>
      </div>

      <!-- Workspace list -->
      <div class="flex-1 overflow-y-auto nc-scrollbar-thin">
        <!-- No results -->
        <div v-if="hasNoResults" class="px-3 py-4 text-nc-content-gray-muted text-bodySm text-center">
          {{ $t('title.noResultsMatchedYourSearch') }}
        </div>

        <template v-else>
          <template v-for="ws in filteredWorkspaceList" :key="ws.id">
            <!-- Workspace item -->
            <NcSidebarMenuItem
              class="group"
              :active="activeWorkspaceId === ws.id && !isSearching"
              :data-testid="`nc-home-sidebar-ws-${ws.id}`"
              @click="navigateToWorkspace(ws.id!)"
            >
              <template #icon>
                <GeneralWorkspaceIcon :workspace="ws" size="small" class="flex-none" />
              </template>
              <span class="capitalize">{{ ws.title }}</span>
              <template #extraRight>
                <!-- Base match count badge when searching -->
                <div
                  v-if="isSearching && baseListAllMatchByWs.has(ws.id)"
                  class="text-[10px] text-nc-content-gray-muted bg-nc-bg-gray-medium rounded-full px-1.5 py-0.25 flex-shrink-0"
                >
                  {{ baseListAllMatchByWs.get(ws.id) }}
                </div>
                <NcDropdown
                  v-if="!isSearching"
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
          </template>
        </template>
      </div>
    </div>

    <!-- New Workspace Button -->
    <div v-if="canCreateWorkspace && showEEFeatures" class="px-2 py-1.5 w-full">
      <NcButton
        type="secondary"
        text-color="primary"
        full-width
        inner-class="children:justify-center"
        class="w-full !border-nc-border-brand justify-center"
        @click="onCreateWorkspace"
      >
        <div class="flex items-center justify-center gap-2 text-center">
          <GeneralIcon icon="plus" class="flex-none" />
          <span class="text-sm font-medium">{{ $t('activity.newWorkspace') }}</span>
        </div>
      </NcButton>
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
    <LazyWorkspaceCreateDlg v-model="isCreateWsDlgOpen" @success="onWorkspaceCreate" />
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
