<script lang="ts" setup>
import { Empty } from 'ant-design-vue'
import { OrgUserRoles, ProjectRoles } from 'nocodb-sdk'

provide(IsWsBaseListModalInj, readonly(ref(true)))

// Stores
const workspaceStore = useWorkspace()
const basesStore = useBases()

const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)

const { workspaceBasesMap, basesList, isProjectsLoading } = storeToRefs(basesStore)
const { loadProjects } = basesStore

const { appInfo } = useGlobal()

const { t } = useI18n()

const { orgRoles } = useRoles()

const { showEEFeatures } = useEeConfig()

// Shared state
const { baseListAllData, loadBaseListAll } = useWsBaseListAll()

const searchQuery = useState<string>('ws-home-search', () => '')

// Actions provider
const { dialogState, switchWorkspace } = useProvideWsBaseListActions(() => {})

// Filter state
type FilterType = 'all' | 'starred' | 'private' | 'owned' | 'managed'
const activeFilter = ref<FilterType>('all')

const isSuperAdmin = computed(() => !!orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

const filterOptions = computed<{ value: string; label: string; icon: string }[]>(() => [
  { value: 'all', label: t('activity.allBases'), icon: 'ncList' },
  ...(appInfo.value.ee
    ? [
        { value: 'starred', label: t('general.starred'), icon: 'star' },
        ...(showEEFeatures.value
          ? [
              { value: 'private', label: t('general.private'), icon: 'ncLock' },
              { value: 'managed', label: t('labels.managed'), icon: 'ncBox' },
            ]
          : []),
      ]
    : []),
  ...(!isSuperAdmin.value ? [{ value: 'owned', label: t('activity.ownedByMe'), icon: 'ncUser' }] : []),
])

const isFilterActive = computed(() => activeFilter.value !== 'all')

const selectedFilter = computed(() => filterOptions.value.find((o) => o.value === activeFilter.value))

// Load baseListAll on mount
onMounted(() => {
  loadBaseListAll()
})

// Current workspace's bases
const workspaceBases = computed(() => {
  return basesList.value
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
  if (!searchQuery.value) return bases
  return bases.filter((base) => searchCompare(base.title, searchQuery.value))
}

// Priority-based categorization — each base in only ONE category
const categorizedBases = computed(() => {
  const bases = workspaceBases.value
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
  const filter = activeFilter.value

  if (filter === 'all') {
    return sectionOrder
      .map((type) => ({
        type,
        bases: filterWithSearch(categorizedBases.value[type]),
      }))
      .filter((section) => section.bases.length > 0)
  }

  const bases = filterWithSearch(allFilteredBases.value[filter] || [])
  return [{ type: filter, bases }]
})

const emptyFilterResult = computed(() => {
  return displayedSections.value.every((section) => section.bases.length === 0)
})

// Other workspaces (not active) that have matching base titles or workspace title
const otherMatchingWorkspaceIds = computed((): string[] => {
  if (!searchQuery.value || !baseListAllData.value) return []
  return baseListAllData.value.workspaces
    .filter(
      (ws) =>
        ws.id !== activeWorkspaceId.value &&
        (searchCompare(ws.title, searchQuery.value) || ws.bases.some((b) => searchCompare(b.title, searchQuery.value))),
    )
    .map((ws) => ws.id)
})

// Load full workspace data for other matching workspaces as they appear
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

// Sections for each other matching workspace
const otherWorkspaceSections = computed(() => {
  if (!searchQuery.value) return []

  return otherMatchingWorkspaceIds.value
    .map((wsId) => {
      const ws = workspacesList.value.find((w) => w.id === wsId)
      if (!ws) return null

      const isLocked = workspaceStore.isWorkspaceCeLocked(wsId)

      if (isLocked) {
        const wsData = baseListAllData.value?.workspaces.find((w) => w.id === wsId)
        if (!wsData?.bases.length) return null

        const bases = wsData.bases
          .filter((b) => searchCompare(b.title, searchQuery.value))
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
      if (!wsBasesMap) return null

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
  if (!searchQuery.value) return false
  if (otherWorkspaceSections.value.length > 0) return false
  return displayedSections.value.every((section) => section.bases.length === 0)
})

const selectedWorkspace = computed(() => {
  return workspacesList.value.find((ws) => ws.id === activeWorkspaceId.value)
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar: "Bases in {ws}" (left) + Filter + New Base (right) -->
    <div class="flex items-center justify-between gap-2 px-4 py-2 flex-none">
      <!-- Left: Bases in {workspace} -->
      <div v-if="selectedWorkspace" class="flex items-center gap-1.5 text-xs font-medium tracking-wide min-w-0">
        <span class="text-nc-content-gray-muted whitespace-nowrap">{{ $t('activity.basesIn') }}</span>
        <span class="text-nc-content-brand capitalize truncate">{{ selectedWorkspace.title }}</span>
        <span class="font-normal text-nc-content-gray-muted flex-shrink-0">({{ baseCount }})</span>
      </div>

      <!-- Right: Filter + New Base -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- Active filter pill -->
        <div v-if="isFilterActive" class="nc-filter-pill" @click.stop>
          <GeneralIcon :icon="selectedFilter?.icon || 'ncList'" class="w-3.5 h-3.5" />
          <span class="text-bodyDefaultSm font-medium">{{ selectedFilter?.label }}</span>
          <GeneralIcon icon="close" class="nc-filter-pill-close w-3.5 h-3.5 cursor-pointer" @click="activeFilter = 'all'" />
        </div>

        <!-- Filter Dropdown -->
        <NcDropdown v-if="!isFilterActive">
          <NcButton size="small" type="secondary">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="ncList" class="w-4 h-4" />
              <span class="text-bodyDefaultSm">{{ $t('activity.allBases') }}</span>
              <GeneralIcon icon="chevronDown" class="w-3.5 h-3.5" />
            </div>
          </NcButton>
          <template #overlay>
            <NcMenu>
              <NcMenuItem v-for="opt in filterOptions" :key="opt.value" @click="activeFilter = opt.value as FilterType">
                <GeneralIcon :icon="opt.icon" class="w-4 h-4" />
                {{ opt.label }}
                <GeneralIcon v-if="activeFilter === opt.value" icon="check" class="w-4 h-4 text-primary ml-auto" />
              </NcMenuItem>
            </NcMenu>
          </template>
        </NcDropdown>

        <WorkspaceCreateProjectBtn
          :workspace-id="activeWorkspaceId ?? undefined"
          type="primary"
          placement="bottomRight"
          centered
          inner-class="children:justify-center"
        >
          <div class="flex items-center gap-1.5">
            <GeneralIcon icon="plus" />
            <span class="hidden sm:inline">{{ $t('title.newProj') }}</span>
          </div>
        </WorkspaceCreateProjectBtn>
      </div>
    </div>

    <!-- Bases Content -->
    <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-4 flex flex-col relative">

      <!-- Categorized sections -->
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

    <!-- Dialogs -->
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
.nc-filter-pill {
  @apply flex items-center gap-1.5 px-2.5 py-1 rounded-full
    bg-primary-selected text-nc-content-brand border-1 border-primary/20
    text-bodyDefaultSm font-medium;
}

.nc-filter-pill-close {
  @apply opacity-70 hover:opacity-100 transition-opacity;
}
</style>
