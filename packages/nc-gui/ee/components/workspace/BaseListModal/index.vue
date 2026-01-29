<script lang="ts" setup>
import { ProjectRoles, type WorkspaceType } from 'nocodb-sdk'

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
const { loadProjects } = basesStore

const { navigateToTable } = useTablesStore()

const { navigateToProject } = useGlobal()
const { $e } = useNuxtApp()

const selectedWorkspaceId = ref<string | null>(null)
const searchQuery = ref('')
const activeFilter = ref<'all' | 'starred' | 'private' | 'owned'>('all')

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

  return (workspaceBasesMap.value.get(selectedWorkspaceId.value) || []).filter(
    (base) => base.fk_workspace_id === selectedWorkspaceId.value,
  )
})

// Categorize bases
const starredBases = computed(() => workspaceBases.value.filter((base) => base.starred))

const privateBases = computed(() =>
  workspaceBases.value.filter((base) => !base.starred && base.default_role === ProjectRoles.NO_ACCESS),
)

const ownedBases = computed(() =>
  workspaceBases.value.filter((base) => base.project_role === ProjectRoles.OWNER || base.project_role === 'owner'),
)

const defaultBases = computed(() =>
  workspaceBases.value.filter((base) => !base.starred && base.default_role !== ProjectRoles.NO_ACCESS),
)

// Apply search filter
const filteredStarredBases = computed(() => starredBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))

const filteredPrivateBases = computed(() => privateBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))

const filteredOwnedBases = computed(() => ownedBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))

const filteredDefaultBases = computed(() => defaultBases.value.filter((base) => searchCompare(base.title, searchQuery.value)))

// Get bases based on active filter
const displayedBases = computed(() => {
  switch (activeFilter.value) {
    case 'starred':
      return { starred: filteredStarredBases.value }
    case 'private':
      return { private: filteredPrivateBases.value }
    case 'owned':
      return { owned: filteredOwnedBases.value }
    default:
      return {
        starred: filteredStarredBases.value,
        private: filteredPrivateBases.value,
        default: filteredDefaultBases.value,
      }
  }
})

// Base count for the selected workspace
const baseCount = computed(() => workspaceBases.value.length)

// Check if there are no search results
const hasNoSearchResults = computed(() => {
  return (
    workspaceBases.value.length > 0 &&
    !filteredStarredBases.value.length &&
    !filteredPrivateBases.value.length &&
    !filteredDefaultBases.value.length
  )
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

// Keyboard navigation
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    visible.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
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
      <!-- Header with Search -->
      <div class="flex items-center px-4 py-3 border-b border-nc-border-gray-medium dark:bg-nc-bg-gray-extralight">
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
        <!-- Left Panel - Workspaces -->
        <div class="nc-workspace-panel w-[320px] border-r border-nc-border-gray-medium flex flex-col">
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
          <!-- Bases Header -->
          <WorkspaceBaseListModalBasesHeader
            :workspace="selectedWorkspace"
            :base-count="baseCount"
            :active-filter="activeFilter"
            @update:active-filter="activeFilter = $event"
          />

          <!-- Bases Content -->
          <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-4">
            <!-- Starred Section -->
            <WorkspaceBaseListModalBasesSection
              v-if="displayedBases.starred?.length"
              type="starred"
              :bases="displayedBases.starred"
              @select="onSelectBase"
            />

            <!-- Private Section -->
            <WorkspaceBaseListModalBasesSection
              v-if="displayedBases.private?.length"
              type="private"
              :bases="displayedBases.private"
              @select="onSelectBase"
            />

            <!-- Owned by Me Section -->
            <WorkspaceBaseListModalBasesSection
              v-if="displayedBases.owned?.length"
              type="owned"
              :bases="displayedBases.owned"
              @select="onSelectBase"
            />

            <!-- Default Bases Section -->
            <WorkspaceBaseListModalBasesSection
              v-if="displayedBases.default?.length"
              type="default"
              :bases="displayedBases.default"
              @select="onSelectBase"
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

      <!-- Footer with keyboard shortcuts -->
      <div
        class="flex items-center gap-4 p-4 border-t border-nc-border-gray-medium text-xs text-nc-content-gray-muted dark:bg-nc-bg-gray-extralight"
      >
        <div class="flex items-center gap-1">
          <kbd class="px-1.5 py-1 bg-nc-bg-gray-medium rounded text-[10px]">↑↓</kbd>
          <span>Navigate</span>
        </div>
        <div class="flex items-center gap-1">
          <kbd class="px-1.5 py-1 bg-nc-bg-gray-medium rounded text-[10px]">Enter</kbd>
          <span>Select</span>
        </div>
        <div class="flex items-center gap-1">
          <kbd class="px-1.5 py-1 bg-nc-bg-gray-medium rounded text-[10px]">Esc</kbd>
          <span>{{ $t('general.close') }}</span>
        </div>
      </div>
    </div>
  </NcModal>

  <!-- Create Workspace Dialog -->
  <WorkspaceCreateDlg v-model="createDlg" @success="onWorkspaceCreate" />
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
