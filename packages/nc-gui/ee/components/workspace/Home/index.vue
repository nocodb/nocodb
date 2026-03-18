<script setup lang="ts">
import { useStorage } from '@vueuse/core'

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

const isBasesTab = computed(() => {
  return !props.wsTab || activeTab.value === 'bases'
})

const basesStore = useBases()

const { basesList } = storeToRefs(basesStore)

const filterMode = ref<'all' | 'starred'>('all')

// localStorage-based "last opened" tracking
const lastOpenedMap = useStorage<Record<string, number>>('nc-base-last-opened', {})

const trackBaseOpened = (baseId: string) => {
  lastOpenedMap.value[baseId] = Date.now()
}

const getLastOpened = (baseId: string): number => {
  return lastOpenedMap.value[baseId] || 0
}

const filteredBases = computed(() => {
  let result = basesList.value

  if (filterMode.value === 'starred') {
    result = result.filter((b: any) => b.starred)
  }

  return [...result].sort((a, b) => {
    const aTime = getLastOpened(a.id!) || new Date(a.updated_at || 0).getTime()
    const bTime = getLastOpened(b.id!) || new Date(b.updated_at || 0).getTime()
    return bTime - aTime
  })
})

// Group bases by time period
const now = Date.now()
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

const groupedBases = computed(() => {
  const groups: { label: string; bases: any[] }[] = []
  const past7: any[] = []
  const past30: any[] = []
  const earlier: any[] = []

  for (const base of filteredBases.value) {
    const lastTime = getLastOpened(base.id!) || new Date(base.updated_at || 0).getTime()
    const diff = now - lastTime

    if (diff <= SEVEN_DAYS) {
      past7.push(base)
    } else if (diff <= THIRTY_DAYS) {
      past30.push(base)
    } else {
      earlier.push(base)
    }
  }

  if (past7.length) groups.push({ label: t('labels.past7Days'), bases: past7 })
  if (past30.length) groups.push({ label: t('labels.past30Days'), bases: past30 })
  if (earlier.length) groups.push({ label: t('labels.earlier'), bases: earlier })

  if (!groups.length && filteredBases.value.length) {
    groups.push({ label: '', bases: filteredBases.value })
  }

  return groups
})

const openBase = (base: any) => {
  trackBaseOpened(base.id!)
  basesStore.navigateToProject({
    workspaceId: base.fk_workspace_id!,
    baseId: base.id!,
  })
}

const onToggleStar = async (base: any, e: Event) => {
  e.stopPropagation()
  await basesStore.toggleStarred(base.id!)
}

const getBaseOpenedTimeAgo = (base: any): string => {
  const lastTime = getLastOpened(base.id!)
  if (lastTime) {
    return timeAgo(new Date(lastTime).toISOString())
  }
  if (base.updated_at) {
    return timeAgo(base.updated_at)
  }
  return ''
}

// Workspace tabs — conditional visibility like WorkspaceViewInline
const { isUIAllowed } = useRoles()

const { isMobileMode, appInfo } = useGlobal()

const {
  isWsAuditEnabled,
  isPaymentEnabled,
  getFeature,
  isEEFeatureBlocked,
  showEEFeatures,
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
  if (routeName === 'index-typeOrId-more' || routeName === 'index-typeOrId-general' || routeName === 'index-typeOrId-ws-settings') return 'more'
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
const { activePlanTitle, handleUpgradePlan } = useEeConfig()

const isFreePlan = computed(() => activePlanTitle.value === 'Free')

const showUpgrade = () => {
  handleUpgradePlan({})
}

// AI chat mock suggestions
const chatSuggestions = [
  'Lead qualification agent',
  'Customer support bot',
  'Inventory alerts',
  'Hiring pipeline',
  'Weekly reporting',
]
</script>

<template>
  <div class="h-full flex flex-col nc-workspace-home bg-nc-bg-default dark:bg-[#1C1C1E]">
    <!-- Workspace name + plan badge -->
    <div class="flex items-center gap-3 px-5 pt-3 pb-1 flex-none">
      <h1 class="text-lg font-bold text-nc-content-gray capitalize">
        {{ activeWorkspace?.title }}
      </h1>
      <div
        v-if="isPaymentEnabled"
        class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
        :class="{
          'bg-nc-bg-gray-light text-nc-content-gray-subtle': true,
        }"
      >
        <span class="uppercase">{{ activePlanTitle }} {{ $t('general.plan') }}</span>
        <template v-if="isFreePlan">
          <span class="text-nc-content-gray-muted">&middot;</span>
          <span class="text-primary cursor-pointer hover:underline" @click="showUpgrade">{{ $t('general.upgrade') }}</span>
        </template>
      </div>
    </div>

    <!-- Search bar — fixed top, centered -->
    <div class="flex items-center justify-center px-6 py-2.5 flex-none">
      <div
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-light cursor-pointer hover:border-nc-border-gray-dark transition-colors w-full max-w-[400px]"
        data-testid="nc-ws-home-search"
        @click="openSearch"
      >
        <GeneralIcon icon="search" class="h-4 w-4 text-nc-content-gray-muted flex-none" />
        <span class="text-[13px] text-nc-content-gray-muted flex-1">{{ $t('activity.searchWorkspaceBases') }}...</span>
        <div class="flex items-center gap-0.5">
          <kbd class="nc-ws-home-kbd">{{ renderCmdOrCtrlKey() }}</kbd>
          <kbd class="nc-ws-home-kbd">K</kbd>
        </div>
      </div>
    </div>

    <!-- Workspace tabs -->
    <div class="flex items-center flex-none px-2 border-y-1 border-nc-border-gray-medium">
      <div class="flex items-center gap-1 flex-1 overflow-x-auto">
        <div
          v-for="tab in wsTabItems"
          :key="tab.key"
          class="flex items-center gap-1.5 px-3 py-2 cursor-pointer text-[13px] transition-colors whitespace-nowrap border-b-2"
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
      <!-- Tab content: rendered directly to avoid ViewInline overhead -->
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
      <div v-else class="max-w-[1200px] mx-auto w-full">
        <!-- AI Chat mock section -->
        <div class="px-8 pt-10 pb-6 text-center">
          <h1 class="text-2xl font-bold text-nc-content-gray mb-1.5">
            What will you build next?
          </h1>
          <p class="text-[13px] text-nc-content-gray-subtle mb-6">
            Describe your agent or pick an idea below
          </p>

          <!-- Chat input mock -->
          <div class="max-w-[600px] mx-auto mb-4">
            <div class="nc-chat-input-border rounded-2xl p-[2px]">
              <div
                class="relative rounded-[14px] px-5 pt-4 pb-11 text-left bg-nc-bg-default dark:bg-[#1C1C1E]"
              >
                <span class="text-[13px] text-nc-content-gray-muted">Create a workflow to</span>
                <div class="absolute bottom-3.5 left-5 flex items-center gap-1.5 text-nc-content-gray-muted">
                  <GeneralIcon icon="magic" class="h-3.5 w-3.5" />
                  <span class="text-xs">AI-powered</span>
                </div>
                <div class="absolute bottom-3.5 right-5">
                  <div class="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                    <GeneralIcon icon="ncArrowUp" class="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Suggestion chips -->
          <div class="flex items-center justify-center gap-2 flex-wrap">
            <div
              v-for="chip in chatSuggestions"
              :key="chip"
              class="px-3 py-1.5 rounded-full border-1 border-nc-border-gray-medium text-xs text-nc-content-gray-subtle cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
            >
              {{ chip }}
            </div>
          </div>
        </div>

        <!-- Divider -->
        <div class="mx-8">
          <div class="border-t-1 border-nc-border-gray-medium" />
        </div>

        <!-- Bases section -->
        <div class="px-8 py-5">
          <!-- Header row -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h2 class="text-base font-semibold text-nc-content-gray">
                {{ t('labels.basesIn') }}
                <span class="text-primary capitalize">{{ activeWorkspace?.title }}</span>
                <span class="text-nc-content-gray-muted font-normal">({{ basesList.length }})</span>
              </h2>
            </div>

            <div class="flex items-center gap-2">
              <!-- Filter dropdown -->
              <NcDropdown>
                <NcButton type="secondary" size="small">
                  <div class="flex items-center gap-1.5">
                    <GeneralIcon icon="list" class="h-3.5 w-3.5" />
                    <span class="text-xs">{{ filterMode === 'starred' ? $t('general.starred') : $t('activity.allBases') }}</span>
                    <GeneralIcon icon="chevronDown" class="h-3 w-3" />
                  </div>
                </NcButton>
                <template #overlay>
                  <NcMenu>
                    <NcMenuItem @click="filterMode = 'all'">
                      <div class="flex items-center gap-2">
                        <GeneralIcon v-if="filterMode === 'all'" icon="check" class="h-4 w-4 text-primary" />
                        <span :class="{ 'pl-6': filterMode !== 'all' }">{{ $t('activity.allBases') }}</span>
                      </div>
                    </NcMenuItem>
                    <NcMenuItem @click="filterMode = 'starred'">
                      <div class="flex items-center gap-2">
                        <GeneralIcon v-if="filterMode === 'starred'" icon="check" class="h-4 w-4 text-primary" />
                        <span :class="{ 'pl-6': filterMode !== 'starred' }">{{ $t('general.starred') }}</span>
                      </div>
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>

              <!-- + New Base button -->
              <WorkspaceCreateProjectBtn type="primary" size="small" :workspace-id="activeWorkspaceId" :centered="false">
                <div class="flex items-center gap-1.5">
                  <GeneralIcon icon="plus" class="h-3.5 w-3.5" />
                  <span>{{ $t('title.newProj') }}</span>
                </div>
              </WorkspaceCreateProjectBtn>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="!filteredBases.length" class="flex flex-col items-center justify-center py-16 text-nc-content-gray-subtle">
            <span class="text-[13px]">{{ $t('labels.noData') }}</span>
          </div>

          <!-- Grouped base cards -->
          <template v-else>
            <div v-for="group in groupedBases" :key="group.label" class="mb-5">
              <div v-if="group.label" class="text-xs font-semibold text-nc-content-gray-muted uppercase tracking-wide mb-3">
                {{ group.label }}
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <div
                  v-for="base in group.bases"
                  :key="base.id"
                  class="nc-base-card group flex items-center gap-3 px-4 py-3.5 rounded-xl border-1 border-nc-border-gray-medium bg-nc-bg-default hover:shadow-sm cursor-pointer transition-all"
                  :data-testid="`nc-base-card-${base.id}`"
                  @click="openBase(base)"
                >
                  <GeneralProjectIcon :color="base.meta?.iconColor" class="flex-none" />
                  <div class="flex-1 min-w-0">
                    <NcTooltip show-on-truncate-only class="text-[13px] font-medium text-nc-content-gray truncate block">
                      <template #title>{{ base.title }}</template>
                      {{ base.title }}
                    </NcTooltip>
                    <div class="text-xs text-nc-content-gray-muted mt-0.5">
                      {{ getBaseOpenedTimeAgo(base) }}
                    </div>
                  </div>
                  <GeneralIcon
                    :icon="base.starred ? 'star' : 'ncStar'"
                    class="flex-none h-4 w-4 transition-opacity"
                    :class="{
                      'text-yellow-500': base.starred,
                      'text-nc-content-gray-muted opacity-0 group-hover:opacity-100': !base.starred,
                    }"
                    @click="onToggleStar(base, $event)"
                  />
                </div>
              </div>

            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-base-card {
  &:hover {
    @apply border-nc-border-gray-dark;
  }
}

.nc-chat-input-border {
  background: linear-gradient(135deg, #3366FF, #3B82F6, #2563EB);
  box-shadow: 0 0 16px rgba(51, 102, 255, 0.3);
}

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
