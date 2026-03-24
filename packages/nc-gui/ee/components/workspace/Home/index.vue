<script setup lang="ts">
import { Empty } from 'ant-design-vue'
import { useStorage } from '@vueuse/core'
import { ProjectRoles } from 'nocodb-sdk'

interface Props {
  wsTab?: string
}

const props = withDefaults(defineProps<Props>(), {
  wsTab: '',
})

const router = useRouter()
const route = router.currentRoute

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { activeWorkspace, activeWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const { basesList, isProjectsLoading } = storeToRefs(basesStore)

// ── Workspace tabs ──

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const {
  isPaymentEnabled,
  isEEFeatureBlocked,
  showEEFeatures,
  activePlanTitle,
  handleUpgradePlan,
} = useEeConfig()

const wsTabItems = computed(() => {
  const wsId = activeWorkspaceId.value
  const items: { key: string; label: string; icon: string; route: string }[] = [
    { key: 'bases', label: t('objects.projects'), icon: 'ncDatabase', route: `/${wsId}` },
  ]

  if (isUIAllowed('workspaceCollaborators')) {
    items.push({ key: 'members', label: t('labels.members'), icon: 'users', route: `/${wsId}/members` })
  }

  if (isEeUI && showEEFeatures.value) {
    items.push({ key: 'teams', label: t('general.teams'), icon: 'ncBuilding', route: `/${wsId}/teams` })
  }

  if (isUIAllowed('workspaceIntegrations') && !isMobileMode.value) {
    items.push({ key: 'integrations', label: t('general.integrations'), icon: 'integration', route: `/${wsId}/integrations` })
  }

  if (isEeUI && isUIAllowed('workspaceAuditList') && showEEFeatures.value) {
    items.push({ key: 'audits', label: t('title.audits'), icon: 'audit', route: `/${wsId}/audits` })
  }

  if (isEeUI && isPaymentEnabled.value && isUIAllowed('workspaceBilling') && showEEFeatures.value) {
    items.push({ key: 'billing', label: t('general.billing'), icon: 'ncDollarSign', route: `/${wsId}/billing` })
  }

  if (!isEEFeatureBlocked.value) {
    items.push({ key: 'more', label: t('general.more'), icon: 'ncMoreHorizontal', route: `/${wsId}/more` })
  }

  return items
})

const activeTab = computed(() => {
  const routeName = route.value.name as string
  if (routeName === 'index-typeOrId' || routeName === 'index-typeOrId-index') return 'bases'
  if (routeName === 'index-typeOrId-members') return 'members'
  if (routeName === 'index-typeOrId-teams') return 'teams'
  if (routeName === 'index-typeOrId-integrations') return 'integrations'
  if (routeName === 'index-typeOrId-audits') return 'audits'
  if (routeName === 'index-typeOrId-more' || routeName === 'index-typeOrId-general' || routeName === 'index-typeOrId-ws-settings')
    return 'more'
  if (routeName === 'index-typeOrId-billing') return 'billing'
  if (routeName === 'index-typeOrId-sso') return 'sso'
  return 'bases'
})

const onTabClick = (tab: any) => {
  navigateTo(tab.route)
}

// Load collaborators when on members/teams tab
const { loadCollaborators } = workspaceStore

watch(
  () => props.wsTab,
  (newTab) => {
    if (!newTab || !activeWorkspaceId.value) return

    if (['ws-collaborators', 'ws-teams'].includes(newTab) && isUIAllowed('workspaceCollaborators')) {
      loadCollaborators({}, activeWorkspaceId.value)
    }
  },
  { immediate: true },
)

// Command palette search
const { setActiveCmdView } = useCommand()

const openSearch = () => {
  setActiveCmdView('cmd-k')
}

// Plan info
const isFreePlan = computed(() => activePlanTitle.value === 'Free')

const showUpgrade = () => {
  handleUpgradePlan({})
}

// ── Bases: actions provider (same as BaseListModal) ──

provide(IsWsBaseListModalInj, readonly(ref(true)))

const { dialogState } = useProvideWsBaseListActions(() => {})

// ── Bases: categorization (same as BaseListModal) ──

// Shared search state with HomeSidebar
const searchQuery = useState<string>('ws-home-search', () => '')

type FilterType = 'all' | 'starred' | 'private' | 'owned' | 'managed'
const activeFilter = ref<FilterType>('all')

const baseCheckers = {
  starred: (base: NcProject) => !!base.starred,
  private: (base: NcProject) => base.default_role === ProjectRoles.NO_ACCESS,
  managed: (base: NcProject) => !!base.managed_app_id,
  owned: (base: NcProject) => base.project_role === ProjectRoles.OWNER,
}

const filterWithSearch = (bases: NcProject[]) => {
  if (!searchQuery.value) return bases
  return bases.filter((base) => searchCompare(base.title, searchQuery.value))
}

// Priority-based categorization — each base in only ONE category
const categorizedBases = computed(() => {
  const bases = basesList.value
  const { starred, private: isPrivate, managed, owned } = baseCheckers

  const starredBases = bases.filter(starred)
  const privateBases = bases.filter((b) => !starred(b) && isPrivate(b))
  const managedBases = bases.filter((b) => !starred(b) && !isPrivate(b) && managed(b))
  const ownedBases = bases.filter((b) => !starred(b) && !isPrivate(b) && !managed(b) && owned(b))
  const defaultBases = bases.filter((b) => !starred(b) && !isPrivate(b) && !managed(b) && !owned(b))

  return { starred: starredBases, private: privateBases, managed: managedBases, owned: ownedBases, default: defaultBases }
})

// All bases matching specific filter (not priority-based)
const allFilteredBases = computed(() => {
  const bases = basesList.value
  return {
    starred: bases.filter(baseCheckers.starred),
    private: bases.filter(baseCheckers.private),
    managed: bases.filter(baseCheckers.managed),
    owned: bases.filter(baseCheckers.owned),
  }
})

type SectionType = 'starred' | 'private' | 'managed' | 'owned' | 'default'
const sectionOrder: SectionType[] = ['starred', 'private', 'managed', 'owned', 'default']

const displayedSections = computed(() => {
  if (activeFilter.value === 'all') {
    return sectionOrder
      .map((type) => ({
        type,
        bases: filterWithSearch(categorizedBases.value[type]),
      }))
      .filter((section) => section.bases.length > 0)
  }

  const bases = filterWithSearch(allFilteredBases.value[activeFilter.value] || [])
  return [{ type: activeFilter.value, bases }]
})

const emptyFilterResult = computed(() => {
  return displayedSections.value.every((section) => section.bases.length === 0)
})

const hasNoSearchResults = computed(() => {
  if (!searchQuery.value) return false
  return emptyFilterResult.value
})

const baseCount = computed(() => basesList.value.length)

// ── Recently opened (extra section, not part of categories) ──

const lastOpenedMap = useStorage<Record<string, number>>('nc-base-last-opened', {})

const recentlyOpened = computed(() => {
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()

  return basesList.value
    .filter((b) => {
      const lastTime = lastOpenedMap.value[b.id!] || 0
      return lastTime && now - lastTime <= SEVEN_DAYS
    })
    .sort((a, b) => (lastOpenedMap.value[b.id!] || 0) - (lastOpenedMap.value[a.id!] || 0))
    .slice(0, 5)
})

const getBaseOpenedTimeAgo = (base: any): string => {
  const lastTime = lastOpenedMap.value[base.id!]
  if (lastTime) return timeAgo(new Date(lastTime).toISOString())
  return ''
}

const trackBaseOpened = (baseId: string) => {
  lastOpenedMap.value[baseId] = Date.now()
}

</script>

<template>
  <div class="h-full flex flex-col nc-workspace-home bg-white dark:bg-nc-bg-default">
    <!-- Top bar: 2 cols on < lg (search right), 3 equal cols on >= lg (search centered) -->
    <div
      class="grid grid-cols-[1fr_auto] lg:grid-cols-3 items-center px-2 h-[var(--topbar-height)] flex-none border-b-1 border-nc-border-gray-medium"
    >
      <!-- Left -->
      <div class="flex items-center gap-2 min-w-0">
        <GeneralOpenLeftSidebarBtn />
        <h1 class="text-bodyLgBold text-nc-content-gray capitalize truncate mb-0">
          {{ activeWorkspace?.title }}
        </h1>
        <div
          v-if="isEeUI"
          class="hidden md:flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium leading-none bg-nc-bg-gray-light text-nc-content-gray-subtle flex-shrink-0"
        >
          <span class="uppercase">{{ activePlanTitle }} {{ $t('general.plan') }}</span>
          <template v-if="isFreePlan && isPaymentEnabled">
            <span class="text-nc-content-gray-muted">&middot;</span>
            <span class="text-primary cursor-pointer hover:underline" @click="showUpgrade">{{ $t('general.upgrade') }}</span>
          </template>
        </div>
      </div>

      <!-- Center -->
      <div class="hidden sm:flex justify-center min-w-0 pl-2 pr-0 lg:pr-2">
        <div
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-light cursor-pointer hover:border-nc-border-gray-dark transition-colors w-full max-w-[400px]"
          data-testid="nc-ws-home-search"
          @click="openSearch"
        >
          <GeneralIcon icon="search" class="h-4 w-4 text-nc-content-gray-muted flex-none" />
          <span class="text-[13px] text-nc-content-gray-muted flex-1 truncate">{{ $t('activity.searchWorkspaceBases') }}...</span>
          <div class="flex items-center gap-0.5 flex-shrink-0">
            <kbd class="nc-ws-home-kbd">{{ renderCmdOrCtrlKey() }}</kbd>
            <kbd class="nc-ws-home-kbd">K</kbd>
          </div>
        </div>
      </div>

      <!-- Right spacer (only on lg+ for 3-col centering) -->
      <div class="hidden lg:block" />
    </div>

    <!-- Workspace tabs -->
    <div class="flex items-center flex-none px-2 border-b-1 border-nc-border-gray-medium overflow-x-auto nc-scrollbar-thin">
      <div class="flex items-center gap-1 flex-1 overflow-x-auto">
        <div
          v-for="tab in wsTabItems"
          :key="tab.key"
          class="flex items-center gap-1.5 px-3 py-2.5 cursor-pointer text-[13px] font-medium transition-colors whitespace-nowrap border-b-2"
          :class="{
            'border-primary text-nc-content-brand font-semibold': activeTab === tab.key,
            'border-transparent text-nc-content-gray-muted hover:text-nc-content-gray-subtle': activeTab !== tab.key,
          }"
          @click="onTabClick(tab)"
        >
          <GeneralIcon :icon="tab.icon" class="h-3.5 w-3.5 flex-none" />
          <span>{{ tab.label }}</span>
        </div>
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-auto nc-scrollbar-thin">
      <!-- Tab content -->
      <div v-if="wsTab === 'ws-integrations'" class="h-full">
        <WorkspaceIntegrationsView />
      </div>

      <div v-else-if="wsTab === 'ws-collaborators'" class="h-full">
        <WorkspaceCollaboratorsList :workspace-id="activeWorkspaceId!" :is-active="true" />
      </div>

      <div v-else-if="wsTab === 'ws-teams'" class="h-full">
        <WorkspaceTeams :workspace-id="activeWorkspaceId!" :is-active="true" />
      </div>

      <div v-else-if="wsTab === 'ws-audits'" class="h-full">
        <WorkspaceAudits />
      </div>

      <div v-else-if="wsTab === 'ws-billing'" class="h-full">
        <PaymentBillingPage />
      </div>

      <div v-else-if="wsTab === 'ws-sso'" class="h-full">
        <WorkspaceSso />
      </div>

      <div v-else-if="wsTab === 'ws-settings'" class="h-full">
        <WorkspaceSettings :workspace-id="activeWorkspaceId!" />
      </div>

      <!-- Bases tab content -->
      <div v-else class="flex flex-col h-full">
        <!-- Bases Header (filter + search + create) — same as BaseListModal -->
        <WorkspaceBaseListModalBasesHeader
          v-model:search-query="searchQuery"
          :base-count="baseCount"
          :active-filter="activeFilter"
          :is-compact-view="false"
          :selected-workspace-id="activeWorkspaceId ?? undefined"
          @update:active-filter="activeFilter = $event"
        >
          <template #baseListHeader>
            <span class="text-nc-content-gray-muted whitespace-nowrap">
              {{ $t('activity.basesIn') }}
            </span>
            <span class="text-nc-content-gray-muted capitalize min-w-0 truncate text-nc-content-brand">
              {{ activeWorkspace?.title ?? '' }}
            </span>
          </template>
        </WorkspaceBaseListModalBasesHeader>

        <!-- Bases Content -->
        <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-4 flex flex-col relative">
          <!-- Recently Opened (shown only when filter is 'all' and no search) -->
          <div v-if="activeFilter === 'all' && !searchQuery && recentlyOpened.length" class="mb-6">
            <div class="text-xs font-semibold text-nc-content-gray-muted uppercase tracking-wide mb-2 px-1">
              {{ $t('labels.recentlyOpened') }}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <div
                v-for="base in recentlyOpened"
                :key="`recent-${base.id}`"
                class="nc-base-card group relative flex items-center gap-3 px-4 h-[64px] rounded-xl bg-white dark:bg-nc-bg-gray-light border-1 border-nc-border-gray-medium hover:border-nc-border-gray-dark hover:shadow-sm cursor-pointer transition-all"
                @click="() => { trackBaseOpened(base.id!); basesStore.navigateToProject({ workspaceId: base.fk_workspace_id!, baseId: base.id! }) }"
              >
                <GeneralProjectIcon :color="base.meta?.iconColor" class="flex-none !w-7 !h-7 !text-xl" />
                <div class="flex-1 min-w-0">
                  <NcTooltip show-on-truncate-only class="text-bodyDefaultSm font-semibold text-nc-content-gray truncate block">
                    <template #title>{{ base.title }}</template>
                    {{ base.title }}
                  </NcTooltip>
                  <div class="text-bodySm text-nc-content-gray-muted mt-0.5">
                    {{ getBaseOpenedTimeAgo(base) }}
                  </div>
                </div>
                <!-- Actions: star + more menu -->
                <div class="absolute top-2 right-2 flex items-center gap-1">
                  <NcButton
                    type="text"
                    size="xxsmall"
                    class="!rounded-md flex-none transition-opacity"
                    :class="{
                      '!opacity-100': base.starred,
                      'opacity-0 group-hover:opacity-100': !base.starred,
                    }"
                    @click.stop="basesStore.toggleStarred(base.id!)"
                  >
                    <GeneralIcon
                      :icon="base.starred ? 'star' : 'ncStar'"
                      class="h-3.5 w-3.5"
                      :class="base.starred ? 'text-yellow-500' : 'text-nc-content-gray-muted'"
                    />
                  </NcButton>
                  <NcButton
                    type="text"
                    size="xxsmall"
                    class="!rounded-md flex-none opacity-0 group-hover:opacity-100 transition-opacity"
                    @click.stop="() => { trackBaseOpened(base.id!); navigateTo(`/${activeWorkspaceId}/${base.id}`) }"
                  >
                    <GeneralIcon icon="threeDotHorizontal" class="h-3.5 w-3.5 text-nc-content-gray-muted" />
                  </NcButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Categorized sections (same as BaseListModal) -->
          <WorkspaceBaseListModalBasesSection
            v-for="section in displayedSections"
            :key="section.type"
            :type="section.type"
            :bases="section.bases"
            :is-filter-applied="activeFilter !== 'all'"
            :is-base-starred="baseCheckers.starred"
            :is-base-private="baseCheckers.private"
          />

          <!-- Loading -->
          <GeneralOverlay
            v-if="isProjectsLoading && emptyFilterResult"
            :model-value="true"
            inline
            transition
            class="!bg-opacity-15"
            data-testid="nc-base-list-loading"
          >
            <div class="flex flex-col items-center justify-center h-full w-full">
              <a-spin size="large" />
            </div>
          </GeneralOverlay>

          <!-- No Search Results -->
          <div
            v-else-if="hasNoSearchResults"
            class="h-full px-2 py-6 text-nc-content-gray-muted flex flex-col items-center justify-center gap-6 text-center"
          >
            <img
              src="~assets/img/placeholder/no-search-result-found.png"
              class="!w-[164px] flex-none"
              alt="No search results found"
            />
            {{ $t('title.noResultsMatchedYourSearch') }}
          </div>

          <!-- Empty State -->
          <div
            v-else-if="emptyFilterResult && !isProjectsLoading"
            class="flex flex-col items-center justify-center h-full text-nc-content-gray-muted"
          >
            <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('activity.noBases')" />
          </div>
        </div>
      </div>
    </div>

    <!-- Dialogs (same as BaseListModal) -->
    <DlgBaseDuplicate v-if="dialogState.duplicate.base" v-model="dialogState.duplicate.isOpen" :base="dialogState.duplicate.base" />
    <DlgBaseDelete
      v-if="dialogState.delete.base"
      v-model:visible="dialogState.delete.isOpen"
      :base-id="dialogState.delete.base?.id"
      :base="dialogState.delete.base"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-ws-home-kbd {
  @apply inline-flex items-center justify-center
    min-w-5 h-5 px-1
    text-[11px] font-medium leading-none
    text-nc-content-gray-muted
    bg-nc-bg-default
    border-1 border-nc-border-gray-medium
    rounded;
}
</style>
