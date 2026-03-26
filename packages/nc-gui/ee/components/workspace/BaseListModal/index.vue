<script lang="ts" setup>
import { NO_SCOPE, OrgUserRoles, ProjectRoles } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

provide(IsWsBaseListModalInj, readonly(ref(true)))

// Stores
const workspaceStore = useWorkspace()
const basesStore = useBases()

const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const { workspaceBasesMap, basesList, isProjectsLoading } = storeToRefs(basesStore)
const { loadProjects } = basesStore

const { navigateToTable } = useTablesStore()
const { activeBreakpoint, appInfo } = useGlobal()
const { $api, $e } = useNuxtApp()
const { isEEFeatureBlocked, showEEFeatures, blockWorkspaceCreate, showUpgradeToCreateWorkspace } = useEeConfig()

const { orgRoles } = useRoles()

const isSuper = computed(() => orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

const canCreateWorkspace = computed(() => {
  if (appInfo.value.restrictWorkspaceCreation !== true) {
    return true
  }

  return !!isSuper.value
})

// baseListAll — lightweight search index across all workspaces
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

const baseListAllData = ref<BaseListAllData | null>(null)
const isBaseListAllLoading = ref(false)

const loadBaseListAll = async () => {
  isBaseListAllLoading.value = true
  try {
    baseListAllData.value = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
      operation: 'baseListAll',
    })) as BaseListAllData
  } catch {
    // silently fail — cross-workspace search won't be available
  } finally {
    isBaseListAllLoading.value = false
  }
}

const baseListAllWsMap = computed(() => {
  const obj: Record<string, { plan_title: string | null }> = {}
  for (const ws of baseListAllData.value?.workspaces ?? []) {
    obj[ws.id] = { plan_title: ws.plan_title }
  }
  return obj
})

// Provide base actions to child components
const closeModal = () => {
  visible.value = false
}
const { dialogState } = useProvideWsBaseListActions(closeModal)

const searchInputRef = ref<HTMLInputElement>()

// Compact view for mobile (xs) and tablet (sm)
const isCompactView = computed(() => activeBreakpoint.value === 'xs' || activeBreakpoint.value === 'sm')

// Modal state - consolidated
const modalState = reactive({
  selectedWorkspaceId: null as string | null,
  searchQuery: '',
  activeFilter: 'all' as 'all' | 'starred' | 'private' | 'owned' | 'managed',
})

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    visible.value = false
  }
}

useEventListener(window, 'keydown', handleKeydown)

// Reset state when modal opens and load baseListAll index upfront
watch(visible, (isVisible) => {
  if (isVisible) {
    modalState.selectedWorkspaceId = activeWorkspaceId.value || workspacesList.value[0]?.id || null
    modalState.searchQuery = ''
    modalState.activeFilter = 'all'
    loadBaseListAll()
  }
})

watch(
  searchInputRef,
  () => {
    if (!searchInputRef.value) return

    searchInputRef.value.focus()
  },
  {
    immediate: true,
  },
)

// Workspace IDs that have at least one base title matching the search query (from the lightweight index)
const baseListAllMatchByWs = computed(() => {
  if (!modalState.searchQuery || !baseListAllData.value) return new Map<string, number>()
  const map = new Map<string, number>()
  for (const ws of baseListAllData.value.workspaces) {
    const count = ws.bases.filter((b) => searchCompare(b.title, modalState.searchQuery)).length
    if (count > 0) map.set(ws.id, count)
  }
  return map
})

const filteredWorkspaceList = computed(() => {
  if (!modalState.searchQuery) return workspacesList.value

  // When searching, show workspaces whose title matches OR have matching bases.
  // Always keep the currently selected workspace visible (safety net while baseListAll loads).
  return workspacesList.value.filter(
    (ws) =>
      ws.id === modalState.selectedWorkspaceId ||
      searchCompare(ws.title ?? '', modalState.searchQuery) ||
      baseListAllMatchByWs.value.has(ws.id),
  )
})

// Computed
const selectedWorkspace = computed(() => {
  return workspacesList.value.find((ws) => ws.id === modalState.selectedWorkspaceId)
})

const workspaceBases = computed(() => {
  if (!modalState.selectedWorkspaceId) return []

  // to reflect changes immediately
  if (activeWorkspaceId.value === modalState.selectedWorkspaceId) {
    return basesList.value
  }

  return Array.from((workspaceBasesMap.value.get(modalState.selectedWorkspaceId) || new Map()).values() || []).sort(
    (a, b) => (a.order != null ? a.order : Infinity) - (b.order != null ? b.order : Infinity),
  )
})

const baseCount = computed(() => workspaceBases.value.length)

// Base attribute checkers
const baseCheckers = {
  starred: (base: NcProject) => !!base.starred,
  private: (base: NcProject) => base.default_role === ProjectRoles.NO_ACCESS,
  managed: (base: NcProject) => !!base.managed_app_id,
  owned: (base: NcProject) => base.project_role === ProjectRoles.OWNER,
}

// Helper to filter bases with search
const filterWithSearch = (bases: NcProject[]) => {
  return bases.filter((base) => searchCompare(base.title, modalState.searchQuery))
}

// Priority-based categorization using a single computed
// Each base appears in only ONE category based on highest priority
const categorizedBases = computed(() => {
  const bases = workspaceBases.value
  const { starred, private: isPrivate, managed, owned } = baseCheckers

  // Priority order: Starred → Private → Managed → Owned → Default
  const starredBases = bases.filter(starred)
  const privateBases = bases.filter((b) => !starred(b) && isPrivate(b))
  const managedBases = bases.filter((b) => !starred(b) && !isPrivate(b) && managed(b))
  const ownedBases = bases.filter((b) => !starred(b) && !isPrivate(b) && !managed(b) && owned(b))
  const defaultBases = bases.filter((b) => !starred(b) && !isPrivate(b) && !managed(b) && !owned(b))

  return { starred: starredBases, private: privateBases, managed: managedBases, owned: ownedBases, default: defaultBases }
})

// All bases matching specific filter (not priority-based)
const allFilteredBases = computed(() => {
  const bases = workspaceBases.value
  return {
    starred: bases.filter(baseCheckers.starred),
    private: bases.filter(baseCheckers.private),
    managed: bases.filter(baseCheckers.managed),
    owned: bases.filter(baseCheckers.owned),
  }
})

// Section types for loop rendering
type SectionType = 'starred' | 'private' | 'managed' | 'owned' | 'default'
const sectionOrder: SectionType[] = ['starred', 'private', 'managed', 'owned', 'default']

// Get displayed bases based on active filter
const displayedSections = computed(() => {
  const filter = modalState.activeFilter

  if (filter === 'all') {
    // Show all categories with search filter applied
    return sectionOrder
      .map((type) => ({
        type,
        bases: filterWithSearch(categorizedBases.value[type]),
      }))
      .filter((section) => section.bases.length > 0)
  }

  // Show only the selected filter category (all bases matching, not priority-filtered)
  const bases = filterWithSearch(allFilteredBases.value[filter] || [])
  return [{ type: filter, bases }]
})

const emptyFilterResult = computed(() => {
  return displayedSections.value.every((section) => section.bases.length === 0)
})

// Other workspaces (not selected) that have matching base titles or workspace title
const otherMatchingWorkspaceIds = computed((): string[] => {
  if (!modalState.searchQuery || !baseListAllData.value) return []
  return baseListAllData.value.workspaces
    .filter(
      (ws) =>
        ws.id !== modalState.selectedWorkspaceId &&
        (searchCompare(ws.title, modalState.searchQuery) || ws.bases.some((b) => searchCompare(b.title, modalState.searchQuery))),
    )
    .map((ws) => ws.id)
})

// Load full workspace data for other matching workspaces as they appear
// Skip locked workspaces — their bases come from baseListAll (no extra API call)
watch(
  otherMatchingWorkspaceIds,
  async (wsIds) => {
    for (const wsId of wsIds) {
      if (workspaceBasesMap.value.has(wsId)) continue
      if (workspaceStore.isWorkspaceCeLocked(wsId)) continue
      await loadProjects('workspace', wsId)
    }
  },
  { immediate: true },
)

// Shared helper — compute categorized + search-filtered sections from a base list
const computeSections = (bases: NcProject[]) => {
  const { starred, private: isPrivate, managed, owned } = baseCheckers
  const starredBases = bases.filter(starred)
  const privateBases = bases.filter((b) => !starred(b) && isPrivate(b))
  const managedBases = bases.filter((b) => !starred(b) && !isPrivate(b) && managed(b))
  const ownedBases = bases.filter((b) => !starred(b) && !isPrivate(b) && !managed(b) && owned(b))
  const defaultBases = bases.filter((b) => !starred(b) && !isPrivate(b) && !managed(b) && !owned(b))

  const categorized: Record<SectionType, NcProject[]> = {
    starred: starredBases,
    private: privateBases,
    managed: managedBases,
    owned: ownedBases,
    default: defaultBases,
  }

  return sectionOrder
    .map((type) => ({ type, bases: filterWithSearch(categorized[type]) }))
    .filter((section) => section.bases.length > 0)
}

// Sections for each other matching workspace (fully loaded, full feature parity)
// Locked workspaces use lightweight baseListAll data instead of full project data
const otherWorkspaceSections = computed(() => {
  if (!modalState.searchQuery) return []

  return otherMatchingWorkspaceIds.value
    .map((wsId) => {
      const ws = workspacesList.value.find((w) => w.id === wsId)
      if (!ws) return null

      const isLocked = workspaceStore.isWorkspaceCeLocked(wsId)

      if (isLocked) {
        // Use baseListAll data for locked workspaces (no API call needed)
        const wsData = baseListAllData.value?.workspaces.find((w) => w.id === wsId)
        if (!wsData?.bases.length) return null

        const bases = wsData.bases
          .filter((b) => searchCompare(b.title, modalState.searchQuery))
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
          .map(
            (b) =>
              ({
                id: b.id,
                title: b.title,
                meta: b.meta,
                order: b.order,
                fk_workspace_id: wsId,
              } as NcProject),
          )

        if (!bases.length) return null
        return { workspace: ws, sections: [{ type: 'default' as SectionType, bases }] }
      }

      const wsBasesMap = workspaceBasesMap.value.get(wsId)
      if (!wsBasesMap) return null // still loading

      const bases = Array.from(wsBasesMap.values()).sort(
        (a, b) => (a.order != null ? a.order : Infinity) - (b.order != null ? b.order : Infinity),
      )

      const sections = computeSections(bases)
      if (sections.length === 0) return null

      return { workspace: ws, sections }
    })
    .filter(Boolean) as { workspace: NcWorkspace; sections: { type: SectionType; bases: NcProject[] }[] }[]
})

// Check if there are no search results
const hasNoSearchResults = computed(() => {
  if (!modalState.searchQuery) return false
  if (otherWorkspaceSections.value.length > 0) return false
  return displayedSections.value.every((section) => section.bases.length === 0)
})

// Workspace handlers
const onSelectWorkspace = async (workspaceId: string) => {
  // Prevent selecting locked workspaces (CE mode, non-default)
  if (workspaceStore.isWorkspaceCeLocked(workspaceId)) return

  modalState.selectedWorkspaceId = workspaceId

  if (workspaceBasesMap.value.get(workspaceId)) return
  await loadProjects('workspace', workspaceId)
}

// Auto-switch selected workspace when search changes and the current workspace has no results.
// Picks the first workspace in the filtered list (title match or base match), ensuring
// there is always at least one workspace selected and visible in the left panel.
watch(
  () => modalState.searchQuery,
  async (query) => {
    if (!query) return
    if (displayedSections.value.length > 0) return

    const firstVisible = filteredWorkspaceList.value.find(
      (ws) => ws.id !== modalState.selectedWorkspaceId && !workspaceStore.isWorkspaceCeLocked(ws.id),
    )
    if (!firstVisible?.id) return

    modalState.selectedWorkspaceId = firstVisible.id
    if (!workspaceBasesMap.value.has(firstVisible.id)) {
      await loadProjects('workspace', firstVisible.id)
    }
  },
)

// Workspace creation
const createDlg = ref(false)

const onCreateWorkspace = () => {
  if (blockWorkspaceCreate.value) {
    showUpgradeToCreateWorkspace()
    return
  }

  $e('c:workspace:create')

  createDlg.value = true
}

const onWorkspaceCreate = async (workspace: NcWorkspace) => {
  createDlg.value = false
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

  navigateTo(`/${workspace.id}`)
}
</script>

<template>
  <NcModal
    v-model:visible="visible"
    :keyboard="true"
    wrap-class-name="nc-modal-wrapper nc-workspace-base-list-modal-wrapper"
    nc-modal-class-name="!p-0"
    :footer="null"
    size="xl"
    @keydown.esc="visible = false"
  >
    <div class="nc-workspace-base-list-modal flex flex-col h-full w-full">
      <!-- Header with Search (Desktop only) -->
      <div
        v-if="!isCompactView"
        class="flex items-center px-4 py-3 border-b border-nc-border-gray-medium dark:bg-nc-bg-gray-extralight"
      >
        <a-input
          ref="searchInputRef"
          v-model:value="modalState.searchQuery"
          class="nc-workspace-base-search"
          :placeholder="$t('placeholder.searchWorkspacesAndBases')"
          allow-clear
          size="large"
        >
          <template #prefix>
            <div v-if="isBaseListAllLoading" class="h-4 w-4 mr-1">
              <GeneralLoader size="regular" />
            </div>

            <GeneralIcon v-else icon="search" class="text-nc-content-gray-muted mr-1" />
          </template>
        </a-input>
      </div>

      <!-- Main Content -->
      <div class="flex flex-1 min-h-0">
        <!-- Left Panel - Bases -->
        <div class="nc-bases-panel flex-1 flex flex-col min-w-0 bg-nc-bg-gray-extralight dark:bg-transparent">
          <!-- Compact View: Workspace Selector -->
          <WorkspaceBaseListModalWorkspaceSelector
            v-if="isCompactView"
            :workspaces="workspacesList"
            :selected-workspace-id="modalState.selectedWorkspaceId"
            :base-count="baseCount"
            :can-create-workspace="canCreateWorkspace"
            :base-list-all-ws-map="baseListAllWsMap"
            @select="onSelectWorkspace"
            @create="onCreateWorkspace"
          />

          <!-- Bases Header (with search on compact view) -->
          <WorkspaceBaseListModalBasesHeader
            v-model:search-query="modalState.searchQuery"
            :base-count="baseCount"
            :active-filter="modalState.activeFilter"
            :is-compact-view="isCompactView"
            :selected-workspace-id="modalState.selectedWorkspaceId ?? undefined"
            @update:active-filter="modalState.activeFilter = $event"
          >
            <template #baseListHeader>
              <span class="text-nc-content-gray-muted whitespace-nowrap">
                {{ $t('activity.basesIn') }}
              </span>
              <span
                v-if="selectedWorkspace"
                class="text-nc-content-gray-muted capitalize min-w-0 truncate text-ellipsis"
                :class="{
                  'text-nc-content-brand': activeWorkspaceId === selectedWorkspace?.id,
                  'underline cursor-pointer hover:text-nc-content-brand': activeWorkspaceId !== selectedWorkspace?.id,
                }"
                @click="switchWorkspace(selectedWorkspace?.id)"
              >
                {{ selectedWorkspace?.title ?? 'Current Workspace' }}
              </span>
            </template>
          </WorkspaceBaseListModalBasesHeader>

          <!-- Bases Content - Loop-based rendering -->
          <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-4 flex flex-col relative">
            <WorkspaceBaseListModalBasesSection
              v-for="section in displayedSections"
              :key="section.type"
              :type="section.type"
              :bases="section.bases"
              :is-filter-applied="modalState.activeFilter !== 'all'"
              :is-base-starred="baseCheckers.starred"
              :is-base-private="baseCheckers.private"
            />

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
              v-else-if="emptyFilterResult"
              class="flex flex-col items-center justify-center h-full text-nc-content-gray-muted"
            >
              <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('activity.noBases')" />
            </div>

            <!-- Other Workspaces cross-workspace search results -->
            <template v-if="otherWorkspaceSections.length > 0">
              <div class="flex items-center gap-3 my-2">
                <div class="h-px flex-1 bg-nc-border-gray-medium" />
                <span class="text-xs text-nc-content-gray-muted font-medium tracking-wide whitespace-nowrap">
                  {{ $t('labels.otherWorkspaces') }}
                </span>
                <div class="h-px flex-1 bg-nc-border-gray-medium" />
              </div>

              <template v-for="wsData in otherWorkspaceSections" :key="wsData.workspace.id">
                <div :class="{ 'opacity-50 pointer-events-none': workspaceStore.isWorkspaceCeLocked(wsData.workspace.id) }">
                  <div class="flex items-center gap-2 mb-4 mt-4 text-xs font-medium tracking-wide">
                    <span class="text-nc-content-gray-muted">{{ $t('activity.basesIn') }}</span>
                    <span
                      class="text-nc-content-gray-muted capitalize"
                      :class="{
                        'text-nc-content-brand': activeWorkspaceId === wsData.workspace?.id,
                        'underline cursor-pointer hover:text-nc-content-brand':
                          activeWorkspaceId !== wsData.workspace?.id && !workspaceStore.isWorkspaceCeLocked(wsData.workspace.id),
                      }"
                      @click="switchWorkspace(wsData.workspace?.id)"
                    >
                      {{ wsData.workspace.title }}
                    </span>
                    <GeneralIcon
                      v-if="workspaceStore.isWorkspaceCeLocked(wsData.workspace.id)"
                      icon="ncLock"
                      class="w-3 h-3 text-nc-content-gray-muted"
                    />
                    <span class="font-normal text-nc-content-gray-muted">
                      ({{ wsData.sections.reduce((n, s) => n + s.bases.length, 0) }})
                    </span>
                  </div>

                  <WorkspaceBaseListModalBasesSection
                    v-for="section in wsData.sections"
                    :key="`${wsData.workspace.id}-${section.type}`"
                    :type="section.type"
                    :bases="section.bases"
                    :is-filter-applied="false"
                    :is-base-starred="baseCheckers.starred"
                    :is-base-private="baseCheckers.private"
                  />
                </div>
              </template>
            </template>
          </div>
        </div>

        <!-- Right Panel - Workspaces (hidden on compact view) -->
        <div v-if="!isCompactView" class="nc-workspace-panel w-[320px] border-r border-nc-border-gray-medium flex flex-col">
          <div class="px-3 pt-3 pb-1 text-xs font-medium text-nc-content-gray-muted tracking-wide">
            {{ $t('objects.workspaces') }}
          </div>

          <div class="flex-1 overflow-y-auto nc-scrollbar-thin flex flex-col px-2 py-1">
            <WorkspaceBaseListModalWorkspaceNode
              v-for="workspace in filteredWorkspaceList"
              :key="workspace.id"
              :workspace="workspace"
              :is-selected="modalState.selectedWorkspaceId === workspace.id"
              :base-count="workspace.id === modalState.selectedWorkspaceId ? baseCount : undefined"
              :plan-title="baseListAllWsMap[workspace.id]?.plan_title"
              @select="onSelectWorkspace"
            />
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
        </div>
      </div>

      <!-- Footer with keyboard shortcuts (Desktop only) -->
      <WorkspaceBaseListModalFooter v-if="!isCompactView" />
    </div>
  </NcModal>

  <!-- Create Workspace Dialog -->
  <WorkspaceCreateDlg v-model="createDlg" @success="onWorkspaceCreate" />

  <!-- Duplicate Base Dialog -->
  <DlgBaseDuplicate v-if="dialogState.duplicate.base" v-model="dialogState.duplicate.isOpen" :base="dialogState.duplicate.base" />

  <!-- Delete Base Dialog -->
  <DlgBaseDelete
    v-if="dialogState.delete.base"
    v-model:visible="dialogState.delete.isOpen"
    :base-id="dialogState.delete.base?.id"
    :base="dialogState.delete.base"
  />
</template>

<style scoped lang="scss">
.nc-workspace-base-list-modal {
  @apply rounded-xl overflow-hidden;
}

.nc-workspace-base-search {
  @apply !rounded-lg dark:!bg-nc-bg-gray-dark;

  :deep(.ant-input) {
    @apply !border-none !shadow-none !text-body dark:!bg-nc-bg-gray-dark;
  }

  :deep(.ant-input-affix-wrapper) {
    @apply !border-none !shadow-none rounded-lg px-3 py-2 dark:!bg-nc-bg-gray-dark;
  }
}

.nc-workspace-panel {
  @apply dark:bg-nc-bg-gray-extralight;
}

kbd {
  @apply font-mono;
}
</style>

<style lang="scss">
.nc-workspace-base-list-modal-wrapper {
  @apply !transition-none;

  backdrop-filter: blur(4px);

  .ant-modal-content {
    @apply !p-0 !rounded-xl overflow-hidden;
  }
}
</style>
