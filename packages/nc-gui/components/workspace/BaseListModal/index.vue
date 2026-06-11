<script lang="ts" setup>
import { ProjectRoles } from 'nocodb-sdk'

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

const { basesList, isProjectsLoading } = storeToRefs(basesStore)

const { activeBreakpoint } = useGlobal()

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
  activeFilter: 'all' as 'all' | 'owned',
})

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    visible.value = false
  }
}

useEventListener(window, 'keydown', handleKeydown)

// Reset state when modal opens
watch(visible, (isVisible) => {
  if (isVisible) {
    modalState.selectedWorkspaceId = activeWorkspaceId.value || workspacesList.value[0]?.id || null
    modalState.searchQuery = ''
    modalState.activeFilter = 'all'
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
  return bases.filter((base) => searchCompare(base.title, modalState.searchQuery))
}

// Priority-based categorization using a single computed
// Each base appears in only ONE category based on highest priority
const categorizedBases = computed(() => {
  const bases = workspaceBases.value
  const { starred, private: isPrivate, managed, owned } = baseCheckers

  const ownedBases = bases.filter((b) => owned(b))
  const defaultBases = bases.filter((b) => !starred(b) && !isPrivate(b) && !managed(b) && !owned(b))

  return { owned: ownedBases, default: defaultBases }
})

// All bases matching specific filter (not priority-based)
const allFilteredBases = computed(() => {
  const bases = workspaceBases.value
  return {
    owned: bases.filter(baseCheckers.owned),
  }
})

// Section types for loop rendering
type SectionType = 'owned' | 'default'
const sectionOrder: SectionType[] = ['owned', 'default']

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
  return displayedSections.value.every((section) => section.bases.length === 0) && !modalState.searchQuery
})

// Check if there are no search results
const hasNoSearchResults = computed(() => {
  if (workspaceBases.value.length === 0) return false
  return displayedSections.value.length === 0 && modalState.searchQuery.length > 0
})
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
          :placeholder="isEeUI ? $t('placeholder.searchWorkspacesAndBases') : `${$t('labels.searchProjects')}...`"
          allow-clear
          size="large"
        >
          <template #prefix>
            <GeneralIcon icon="search" class="text-nc-content-gray-muted mr-1" />
          </template>
        </a-input>
      </div>

      <!-- Main Content -->
      <div class="flex flex-1 min-h-0">
        <!-- Right Panel - Bases -->
        <div class="nc-bases-panel flex-1 flex flex-col min-w-0 bg-nc-bg-gray-extralight dark:bg-transparent">
          <!-- Bases Header (with search on compact view) -->
          <WorkspaceBaseListModalBasesHeader
            v-model:search-query="modalState.searchQuery"
            :base-count="baseCount"
            :active-filter="modalState.activeFilter"
            :is-compact-view="isCompactView"
            @update:active-filter="modalState.activeFilter = $event"
          >
            <template #baseListHeader>
              <span class="text-nc-content-gray-muted">
                {{ $t('objects.projects') }}
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

            <!-- Empty State -->
            <div
              v-else-if="emptyFilterResult"
              class="flex flex-col items-center justify-center h-full text-nc-content-gray-muted"
            >
              <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('activity.noBases')" />
            </div>

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
          </div>
        </div>
      </div>

      <!-- Footer with keyboard shortcuts (Desktop only) -->
      <WorkspaceBaseListModalFooter v-if="!isCompactView" />
    </div>
  </NcModal>

  <!-- Duplicate Base Dialog -->
  <DlgBaseDuplicate v-if="dialogState.duplicate.base" v-model="dialogState.duplicate.isOpen" :base="dialogState.duplicate.base" />

  <!-- Delete Base Dialog -->
  <DlgBaseDelete
    v-if="dialogState.delete.base"
    v-model:visible="dialogState.delete.isOpen"
    :base-id="dialogState.delete.base?.id"
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
