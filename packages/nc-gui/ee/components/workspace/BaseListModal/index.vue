<script lang="ts" setup>
import type { SourceType, WorkspaceType } from 'nocodb-sdk'
import { ProjectRoles } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const workspaceStore = useWorkspace()
const basesStore = useBases()

const { workspacesList, activeWorkspaceId } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const { workspaceBasesMap } = storeToRefs(basesStore)
const { loadProjects, updateProject } = basesStore

const { navigateToTable } = useTablesStore()

const { navigateToProject, isMobileMode } = useGlobal()
const { $e } = useNuxtApp()

// Responsive breakpoint - show workspace panel on large screens only
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const isCompactView = computed(() => isMobileMode.value || windowWidth.value < 1024)

// Update windowWidth on resize
const onResize = () => {
  windowWidth.value = window.innerWidth
}

// Keyboard navigation
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

const selectedWorkspaceId = ref<string | null>(null)
const searchQuery = ref('')
const activeFilter = ref<'all' | 'starred' | 'private' | 'owned' | 'managed'>('all')

// Initialize selected workspace when modal opens
watch(visible, (isVisible) => {
  if (isVisible) {
    selectedWorkspaceId.value = activeWorkspaceId.value || workspacesList.value[0]?.id || null
    searchQuery.value = ''
    activeFilter.value = 'all'
  }
})

// Get the selected workspace
const selectedWorkspace = computed(() => {
  return workspacesList.value.find((ws) => ws.id === selectedWorkspaceId.value)
})

// Filter bases for the selected workspace
const workspaceBases = computed(() => {
  if (!selectedWorkspaceId.value) return []

  return Array.from((workspaceBasesMap.value.get(selectedWorkspaceId.value) || new Map()).values() || []).sort(
    (a, b) => (a.order != null ? a.order : Infinity) - (b.order != null ? b.order : Infinity),
  )
})

// Priority-based categorization (mutually exclusive)
// Priority order: Starred → Private → Managed → Owned by Me → Default
// Each base appears in only ONE category based on highest priority

// Helper functions to check base attributes
const isBaseStarred = (base: NcProject) => !!base.starred
const isBasePrivate = (base: NcProject) => base.default_role === ProjectRoles.NO_ACCESS
const isBaseManaged = (base: NcProject) => !!base.managed_app_id
const isBaseOwned = (base: NcProject) => base.project_role === ProjectRoles.OWNER || base.project_role === 'owner'

// 1. Starred bases (highest priority)
const starredBases = computed(() => workspaceBases.value.filter((base) => isBaseStarred(base)))

// 2. Private bases (not starred)
const privateBases = computed(() => workspaceBases.value.filter((base) => !isBaseStarred(base) && isBasePrivate(base)))

// 3. Managed bases (not starred, not private)
const managedBases = computed(() =>
  workspaceBases.value.filter((base) => !isBaseStarred(base) && !isBasePrivate(base) && isBaseManaged(base)),
)

// 4. Owned bases (not starred, not private, not managed)
const ownedBases = computed(() =>
  workspaceBases.value.filter(
    (base) => !isBaseStarred(base) && !isBasePrivate(base) && !isBaseManaged(base) && isBaseOwned(base),
  ),
)

// 5. Default bases (remaining - not in any other category)
const defaultBases = computed(() =>
  workspaceBases.value.filter(
    (base) => !isBaseStarred(base) && !isBasePrivate(base) && !isBaseManaged(base) && !isBaseOwned(base),
  ),
)

// Apply search filter to each category
const filteredStarredBases = computed(() => starredBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))
const filteredOwnedBases = computed(() => ownedBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))
const filteredPrivateBases = computed(() => privateBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))
const filteredManagedBases = computed(() => managedBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))
const filteredDefaultBases = computed(() => defaultBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))

// All bases matching each filter criteria (for filtered views)
// These include ALL bases with the attribute, not priority-filtered
const allStarredBases = computed(() => workspaceBases.value.filter((base) => isBaseStarred(base)))
const allPrivateBases = computed(() => workspaceBases.value.filter((base) => isBasePrivate(base)))
const allManagedBases = computed(() => workspaceBases.value.filter((base) => isBaseManaged(base)))
const allOwnedBases = computed(() => workspaceBases.value.filter((base) => isBaseOwned(base)))

// Apply search filter to "all" filtered bases
const filteredAllStarredBases = computed(() => allStarredBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))
const filteredAllPrivateBases = computed(() => allPrivateBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))
const filteredAllManagedBases = computed(() => allManagedBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))
const filteredAllOwnedBases = computed(() => allOwnedBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))

// Get bases based on active filter
// When 'all': Show priority-based sections (Starred → Private → Managed → Owned → Default)
// When specific filter: Show ALL bases matching that criteria with indicators
const displayedBases = computed(() => {
  switch (activeFilter.value) {
    case 'starred':
      return { starred: filteredAllStarredBases.value }
    case 'private':
      return { private: filteredAllPrivateBases.value }
    case 'managed':
      return { managed: filteredAllManagedBases.value }
    case 'owned':
      return { owned: filteredAllOwnedBases.value }
    default:
      // Show all categories in priority order
      return {
        starred: filteredStarredBases.value,
        private: filteredPrivateBases.value,
        managed: filteredManagedBases.value,
        owned: filteredOwnedBases.value,
        default: filteredDefaultBases.value,
      }
  }
})

// Base count for the selected workspace
const baseCount = computed(() => workspaceBases.value.length)

// Check if there are no search results based on active filter
const hasNoSearchResults = computed(() => {
  if (workspaceBases.value.length === 0) return false

  if (activeFilter.value === 'all') {
    return (
      !filteredStarredBases.value.length &&
      !filteredPrivateBases.value.length &&
      !filteredManagedBases.value.length &&
      !filteredOwnedBases.value.length &&
      !filteredDefaultBases.value.length
    )
  }

  // For specific filters, check if the filtered view is empty
  const bases = displayedBases.value
  return Object.values(bases).every((arr) => !arr?.length)
})

// Handle workspace selection
const onSelectWorkspace = async (workspaceId: string) => {
  selectedWorkspaceId.value = workspaceId

  if (workspaceBasesMap.value.get(selectedWorkspaceId.value)) {
    return
  }

  // Load bases for the selected workspace
  await loadProjects('workspace', workspaceId)
}

// Handle base selection
const onSelectBase = async (base: NcProject) => {
  $e('a:workspace:base:select')
  visible.value = false

  await navigateToProject({
    baseId: base.id!,
    workspaceId: base.fk_workspace_id!,
  })
}

// Handle base reorder
const onReorderBase = async (baseId: string, newOrder: number) => {
  await updateProject(baseId, { order: newOrder })
  $e('a:base:reorder')
}

// Handle base rename
const onRenameBase = async (base: NcProject, title: string) => {
  try {
    await updateProject(base.id!, { title })
    $e('a:base:rename')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// Handle toggle starred
const { toggleStarred } = basesStore
const onToggleStarred = async (baseId: string) => {
  await toggleStarred(baseId)
  $e('a:base:starred:toggle')
}

// Handle base duplicate
const isDuplicateDlgOpen = ref(false)
const selectedProjectToDuplicate = ref<NcProject | null>(null)

const onDuplicateBase = (base: NcProject) => {
  selectedProjectToDuplicate.value = base
  isDuplicateDlgOpen.value = true
  $e('c:base:duplicate')
}

// Handle open ERD
const onOpenErd = (base: NcProject, source: SourceType) => {
  $e('c:project:relation')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgBaseErd'), {
    'modelValue': isOpen,
    'sourceId': source.id,
    'onUpdate:modelValue': () => closeDialog(),
    'baseId': base.id,
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

// Handle open base settings
const route = useRoute()
const onOpenSettings = async (baseId: string) => {
  visible.value = false
  await navigateTo(`/${route.params.typeOrId}/${baseId}?page=base-settings`)
}

// Handle base delete
const isDeleteDlgOpen = ref(false)
const selectedProjectToDelete = ref<NcProject | null>(null)

const onDeleteBase = (base: NcProject) => {
  selectedProjectToDelete.value = base
  isDeleteDlgOpen.value = true
}

// Handle base icon color update
const onUpdateColor = async (base: NcProject, color: string) => {
  try {
    const meta = {
      ...parseProp(base.meta),
      iconColor: color,
    }
    await updateProject(base.id!, { meta: JSON.stringify(meta) })
    $e('a:base:icon:color:modal', { iconColor: color })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// Handle creating new workspace
const createDlg = ref(false)
const onCreateWorkspace = () => {
  $e('c:workspace:create:modal')
  createDlg.value = true
}

const onWorkspaceCreate = async (workspace: WorkspaceType) => {
  createDlg.value = false
  await loadWorkspaces()

  // TODO: Add to swagger
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
          v-model:value="searchQuery"
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
              :is-selected="selectedWorkspaceId === workspace.id"
              :base-count="workspace.id === selectedWorkspaceId ? baseCount : undefined"
              @select="onSelectWorkspace"
            />
          </div>

          <!-- New Workspace Button -->
          <div class="px-2 py-2 w-full">
            <NcButton
              type="secondary"
              text-color="primary"
              full-width
              inner-class="!gap-2"
              class="w-full !border-nc-border-brand"
              @click="onCreateWorkspace"
            >
              <template #icon>
                <GeneralIcon icon="plus" class="flex-none" />
              </template>
              <span class="text-sm font-medium">{{ $t('activity.newWorkspace') }}</span>
            </NcButton>
          </div>
        </div>

        <!-- Right Panel - Bases -->
        <div class="nc-bases-panel flex-1 flex flex-col min-w-0 bg-nc-bg-gray-extralight dark:bg-transparent">
          <!-- Compact View: Workspace Selector -->
          <WorkspaceBaseListModalWorkspaceSelector
            v-if="isCompactView"
            :workspaces="workspacesList"
            :selected-workspace-id="selectedWorkspaceId"
            :base-count="baseCount"
            @select="onSelectWorkspace"
            @create="onCreateWorkspace"
          />

          <!-- Bases Header (with search on compact view) -->
          <WorkspaceBaseListModalBasesHeader
            v-model:search-query="searchQuery"
            :workspace="selectedWorkspace"
            :base-count="baseCount"
            :active-filter="activeFilter"
            :is-compact-view="isCompactView"
            @update:active-filter="activeFilter = $event"
          />

          <!-- Bases Content -->
          <!-- Priority Order: Starred → Private → Managed → Owned → Default -->
          <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-4">
            <!-- Starred Section -->
            <WorkspaceBaseListModalBasesSection
              v-if="displayedBases.starred?.length"
              type="starred"
              :bases="displayedBases.starred"
              :is-base-starred="isBaseStarred"
              :is-base-private="isBasePrivate"
              @select="onSelectBase"
              @reorder="onReorderBase"
              @rename="onRenameBase"
              @toggle-starred="onToggleStarred"
              @duplicate="onDuplicateBase"
              @open-erd="onOpenErd"
              @open-settings="onOpenSettings"
              @delete="onDeleteBase"
              @update-color="onUpdateColor"
            />

            <!-- Private Section -->
            <WorkspaceBaseListModalBasesSection
              v-if="displayedBases.private?.length"
              type="private"
              :bases="displayedBases.private"
              :is-base-starred="isBaseStarred"
              :is-base-private="isBasePrivate"
              @select="onSelectBase"
              @reorder="onReorderBase"
              @rename="onRenameBase"
              @toggle-starred="onToggleStarred"
              @duplicate="onDuplicateBase"
              @open-erd="onOpenErd"
              @open-settings="onOpenSettings"
              @delete="onDeleteBase"
              @update-color="onUpdateColor"
            />

            <!-- Managed Section -->
            <WorkspaceBaseListModalBasesSection
              v-if="displayedBases.managed?.length"
              type="managed"
              :bases="displayedBases.managed"
              :is-base-starred="isBaseStarred"
              :is-base-private="isBasePrivate"
              @select="onSelectBase"
              @reorder="onReorderBase"
              @rename="onRenameBase"
              @toggle-starred="onToggleStarred"
              @duplicate="onDuplicateBase"
              @open-erd="onOpenErd"
              @open-settings="onOpenSettings"
              @delete="onDeleteBase"
              @update-color="onUpdateColor"
            />

            <!-- Owned by Me Section -->
            <WorkspaceBaseListModalBasesSection
              v-if="displayedBases.owned?.length"
              type="owned"
              :bases="displayedBases.owned"
              :is-base-starred="isBaseStarred"
              :is-base-private="isBasePrivate"
              @select="onSelectBase"
              @reorder="onReorderBase"
              @rename="onRenameBase"
              @toggle-starred="onToggleStarred"
              @duplicate="onDuplicateBase"
              @open-erd="onOpenErd"
              @open-settings="onOpenSettings"
              @delete="onDeleteBase"
              @update-color="onUpdateColor"
            />

            <!-- Default Bases Section (remaining) -->
            <WorkspaceBaseListModalBasesSection
              v-if="displayedBases.default?.length"
              type="default"
              :bases="displayedBases.default"
              :is-base-starred="isBaseStarred"
              :is-base-private="isBasePrivate"
              @select="onSelectBase"
              @reorder="onReorderBase"
              @rename="onRenameBase"
              @toggle-starred="onToggleStarred"
              @duplicate="onDuplicateBase"
              @open-erd="onOpenErd"
              @open-settings="onOpenSettings"
              @delete="onDeleteBase"
              @update-color="onUpdateColor"
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
  <DlgBaseDuplicate
    v-if="selectedProjectToDuplicate"
    v-model="isDuplicateDlgOpen"
    :base="selectedProjectToDuplicate"
  />

  <!-- Delete Base Dialog -->
  <DlgBaseDelete
    v-if="selectedProjectToDelete"
    v-model:visible="isDeleteDlgOpen"
    :base-id="selectedProjectToDelete?.id"
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
