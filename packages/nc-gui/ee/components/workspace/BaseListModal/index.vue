<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import type { WorkspaceType } from 'nocodb-sdk'
import { ProjectRoles } from 'nocodb-sdk'
import { useBaseActionsProvider } from './useBaseActions'

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

// Stores
const workspaceStore = useWorkspace()
const basesStore = useBases()

const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const { workspaceBasesMap } = storeToRefs(basesStore)
const { loadProjects } = basesStore

const { navigateToTable } = useTablesStore()
const { isMobileMode } = useGlobal()
const { $e } = useNuxtApp()

// Provide base actions to child components
const closeModal = () => {
  visible.value = false
}
const { dialogState } = useBaseActionsProvider(closeModal)

// Autofocus search input
const focus: VNodeRef = (el) => el?.focus()

// Responsive state
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const isCompactView = computed(() => isMobileMode.value || windowWidth.value < 1024)

// Modal state - consolidated
const modalState = reactive({
  selectedWorkspaceId: null as string | null,
  searchQuery: '',
  activeFilter: 'all' as 'all' | 'starred' | 'private' | 'owned' | 'managed',
})

// Event handlers
const onResize = () => {
  windowWidth.value = window.innerWidth
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    visible.value = false
  }
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', handleKeydown)
})

// Reset state when modal opens
watch(visible, (isVisible) => {
  if (isVisible) {
    modalState.selectedWorkspaceId = activeWorkspaceId.value || workspacesList.value[0]?.id || null
    modalState.searchQuery = ''
    modalState.activeFilter = 'all'
  }
})

// Computed
const selectedWorkspace = computed(() => {
  return workspacesList.value.find((ws) => ws.id === modalState.selectedWorkspaceId)
})

const workspaceBases = computed(() => {
  if (!modalState.selectedWorkspaceId) return []

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
  owned: (base: NcProject) => base.project_role === ProjectRoles.OWNER || base.project_role === 'owner',
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
  return bases.length > 0 ? [{ type: filter, bases }] : []
})

// Check if there are no search results
const hasNoSearchResults = computed(() => {
  if (workspaceBases.value.length === 0) return false
  return displayedSections.value.length === 0 && modalState.searchQuery.length > 0
})

// Workspace handlers
const onSelectWorkspace = async (workspaceId: string) => {
  modalState.selectedWorkspaceId = workspaceId

  if (workspaceBasesMap.value.get(workspaceId)) return
  await loadProjects('workspace', workspaceId)
}

// Workspace creation
const createDlg = ref(false)

const onCreateWorkspace = () => {
  $e('c:workspace:create:modal')
  createDlg.value = true
}

const onWorkspaceCreate = async (workspace: WorkspaceType) => {
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
          :ref="focus"
          v-model:value="modalState.searchQuery"
          class="nc-workspace-base-search"
          :placeholder="$t('placeholder.searchWorkspacesAndBases')"
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
        <!-- Left Panel - Workspaces (hidden on compact view) -->
        <div v-if="!isCompactView" class="nc-workspace-panel w-[320px] border-r border-nc-border-gray-medium flex flex-col">
          <div class="px-4 pt-4 pb-1 text-xs font-medium text-nc-content-gray-muted uppercase tracking-wide">
            {{ $t('objects.workspaces') }}
          </div>

          <div class="flex-1 overflow-y-auto nc-scrollbar-thin flex flex-col px-4 py-2">
            <WorkspaceBaseListModalWorkspaceNode
              v-for="workspace in workspacesList"
              :key="workspace.id"
              :workspace="workspace"
              :is-selected="modalState.selectedWorkspaceId === workspace.id"
              :base-count="workspace.id === modalState.selectedWorkspaceId ? baseCount : undefined"
              @select="onSelectWorkspace"
            />
          </div>

          <!-- New Workspace Button -->
          <div class="px-2 py-2 w-full">
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

        <!-- Right Panel - Bases -->
        <div class="nc-bases-panel flex-1 flex flex-col min-w-0 bg-nc-bg-gray-extralight dark:bg-transparent">
          <!-- Compact View: Workspace Selector -->
          <WorkspaceBaseListModalWorkspaceSelector
            v-if="isCompactView"
            :workspaces="workspacesList"
            :selected-workspace-id="modalState.selectedWorkspaceId"
            :base-count="baseCount"
            @select="onSelectWorkspace"
            @create="onCreateWorkspace"
          />

          <!-- Bases Header (with search on compact view) -->
          <WorkspaceBaseListModalBasesHeader
            v-model:search-query="modalState.searchQuery"
            :workspace="selectedWorkspace"
            :base-count="baseCount"
            :active-filter="modalState.activeFilter"
            :is-compact-view="isCompactView"
            @update:active-filter="modalState.activeFilter = $event"
          />

          <!-- Bases Content - Loop-based rendering -->
          <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-4">
            <WorkspaceBaseListModalBasesSection
              v-for="section in displayedSections"
              :key="section.type"
              :type="section.type"
              :bases="section.bases"
              :is-base-starred="baseCheckers.starred"
              :is-base-private="baseCheckers.private"
            />

            <!-- Empty State -->
            <div
              v-if="!workspaceBases.length"
              class="flex flex-col items-center justify-center h-full text-nc-content-gray-muted"
            >
              <GeneralIcon icon="ncFolder" class="w-12 h-12 mb-2 opacity-50" />
              <span class="text-sm">{{ $t('activity.noBases') }}</span>
            </div>

            <!-- No Search Results -->
            <div
              v-else-if="hasNoSearchResults"
              class="flex flex-col items-center justify-center h-full text-nc-content-gray-muted"
            >
              <GeneralIcon icon="search" class="w-12 h-12 mb-2 opacity-50" />
              <span class="text-sm">{{ $t('placeholder.noResultsFoundForYourSearch') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer with keyboard shortcuts (Desktop only) -->
      <div
        v-if="!isCompactView"
        class="flex items-center gap-4 p-4 border-t border-nc-border-gray-medium text-xs text-nc-content-gray-muted dark:bg-nc-bg-gray-extralight"
      >
        <div class="flex items-center gap-1">
          <kbd class="nc-keyboard-shortcut">Tab</kbd>
          <span>{{ $t('labels.navigate') }}</span>
        </div>
        <div class="flex items-center gap-1">
          <kbd class="nc-keyboard-shortcut">Enter</kbd>
          <span>{{ $t('labels.select') }}</span>
        </div>
        <div class="flex items-center gap-1">
          <kbd class="nc-keyboard-shortcut">Esc</kbd>
          <span>{{ $t('general.close') }}</span>
        </div>
      </div>
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
  />
</template>

<style scoped lang="scss">
.nc-keyboard-shortcut {
  @apply px-2 py-1 bg-nc-bg-gray-light rounded border-1 border-nc-border-gray-medium text-tiny;
}

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
