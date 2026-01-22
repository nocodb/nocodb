<script lang="ts" setup>
import { ProjectRoles, type WorkspaceType } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const workspaceStore = useWorkspace()
const basesStore = useBases()

const { workspacesList, activeWorkspace, activeWorkspaceId } = storeToRefs(workspaceStore)
const { loadWorkspaces, navigateToWorkspace } = workspaceStore

const { basesList, workspaceBasesMap } = storeToRefs(basesStore)
const { loadProjects } = basesStore

const { navigateToTable } = useTablesStore()

const { navigateToProject, isMobileMode } = useGlobal()
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

console.log('wokrpsace base', workspaceBases.value)
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
          <div class="px-4 py-4 text-xs font-medium text-nc-content-gray-muted uppercase tracking-wide">
            {{ $t('objects.workspaces') }}
          </div>

          <div class="flex-1 overflow-y-auto nc-scrollbar-thin px-4">
            <div
              v-for="workspace in workspacesList"
              :key="workspace.id"
              :tabindex="-1"
              :class="[
                'nc-workspace-item group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer mb-1 border-1 border-transparent',
                selectedWorkspaceId === workspace.id
                  ? 'bg-nc-bg-gray-medium !border-nc-border-gray-dark'
                  : 'hover:(bg-nc-bg-gray-light !border-nc-border-gray-medium)',
              ]"
              @click="onSelectWorkspace(workspace.id!)"
            >
              <GeneralWorkspaceIcon :workspace="workspace" size="large" class="flex-none" />
              <div class="flex flex-col flex-1 min-w-0">
                <span class="text-sm font-medium text-nc-content-gray-extreme truncate capitalize">
                  {{ workspace.title }}
                </span>
                <span v-if="workspace.id === selectedWorkspaceId" class="text-xs text-nc-content-gray-muted">
                  {{ baseCount }} {{ baseCount !== 1 ? $t('objects.projects') : $t('objects.project') }}
                </span>
              </div>
              <GeneralIcon v-if="selectedWorkspaceId === workspace.id" icon="check" class="text-nc-content-brand flex-none" />
              <GeneralIcon
                v-else
                icon="arrowRight"
                class="text-nc-content-gray-muted flex-none opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>

          <!-- New Workspace Button -->
          <div class="px-2 py-2 w-full">
            <NcButton
              type="secondary"
              text-color="primary"
              full-width
              inner-class="!gap-2 "
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
          <div class="flex items-center justify-between px-4 py-2 border-b border-nc-border-gray-medium">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-nc-content-gray-subtle">
                {{ $t('activity.basesIn') }}
              </span>
              <span class="text-sm font-semibold text-nc-content-gray-extreme capitalize">
                {{ selectedWorkspace?.title }}
              </span>
              <span class="text-xs text-nc-content-gray-muted">({{ baseCount }})</span>
            </div>

            <!-- Filter Dropdown -->
            <NcDropdown placement="bottomRight">
              <NcButton size="small" type="secondary">
                <div class="flex items-center gap-1">
                  <GeneralIcon icon="filter" class="w-4 h-4" />
                  <span>{{
                    activeFilter === 'all'
                      ? $t('activity.allBases')
                      : activeFilter === 'starred'
                      ? $t('general.starred')
                      : activeFilter === 'private'
                      ? $t('general.private')
                      : $t('activity.ownedByMe')
                  }}</span>
                  <GeneralIcon icon="chevronDown" class="w-4 h-4" />
                </div>
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem @click="activeFilter = 'all'">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="list" />
                      <span>{{ $t('activity.allBases') }}</span>
                    </div>
                  </NcMenuItem>
                  <NcMenuItem @click="activeFilter = 'starred'">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="star" />
                      <span>{{ $t('general.starred') }}</span>
                    </div>
                  </NcMenuItem>
                  <NcMenuItem @click="activeFilter = 'private'">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="lock" />
                      <span>{{ $t('general.private') }}</span>
                    </div>
                  </NcMenuItem>
                  <NcMenuItem @click="activeFilter = 'owned'">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="account" />
                      <span>{{ $t('activity.ownedByMe') }}</span>
                    </div>
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>

          <!-- Bases Content -->
          <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-4">
            <!-- Starred Section -->
            <template v-if="displayedBases.starred?.length">
              <div class="mb-4">
                <div class="flex items-center gap-2 mb-2 text-xs font-medium text-nc-content-gray-muted uppercase tracking-wide">
                  <GeneralIcon icon="star" class="w-3.5 h-3.5" />
                  <span>{{ $t('general.starred') }}</span>
                </div>
                <div class="grid grid-cols-3 gap-3">
                  <div
                    v-for="base in displayedBases.starred"
                    :key="base.id"
                    class="nc-base-card group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer border-1 transition-all border-nc-border-gray-medium hover:border-nc-border-gray-dark hover:shadow-sm"
                    @click="onSelectBase(base)"
                  >
                    <GeneralProjectIcon :color="parseProp(base.meta).iconColor" class="flex-none" />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-nc-content-gray-extreme truncate">
                        {{ base.title }}
                      </div>
                    </div>
                    <GeneralIcon icon="starSolid" class="flex-none w-4 h-4 text-yellow-500" />
                  </div>
                </div>
              </div>
            </template>

            <!-- Private Section -->
            <template v-if="displayedBases.private?.length">
              <div class="mb-4">
                <div class="flex items-center gap-2 mb-2 text-xs font-medium text-nc-content-gray-muted uppercase tracking-wide">
                  <GeneralIcon icon="lock" class="w-3.5 h-3.5" />
                  <span>{{ $t('general.private') }}</span>
                </div>
                <div class="grid grid-cols-3 gap-3">
                  <div
                    v-for="base in displayedBases.private"
                    :key="base.id"
                    class="nc-base-card group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer border-1 transition-all border-nc-border-gray-medium hover:border-nc-border-gray-dark hover:shadow-sm"
                    @click="onSelectBase(base)"
                  >
                    <GeneralProjectIcon :color="parseProp(base.meta).iconColor" class="flex-none" />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-nc-content-gray-extreme truncate">
                        {{ base.title }}
                      </div>
                    </div>
                    <NcBadge color="green" class="text-xs">
                      {{ $t('general.private') }}
                    </NcBadge>
                  </div>
                </div>
              </div>
            </template>

            <!-- Owned by Me Section -->
            <template v-if="displayedBases.owned?.length">
              <div class="mb-4">
                <div class="flex items-center gap-2 mb-2 text-xs font-medium text-nc-content-gray-muted uppercase tracking-wide">
                  <GeneralIcon icon="account" class="w-3.5 h-3.5" />
                  <span>{{ $t('activity.ownedByMe') }}</span>
                </div>
                <div class="grid grid-cols-3 gap-3">
                  <div
                    v-for="base in displayedBases.owned"
                    :key="base.id"
                    class="nc-base-card group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer border-1 transition-all border-nc-border-gray-medium hover:border-nc-border-gray-dark hover:shadow-sm"
                    @click="onSelectBase(base)"
                  >
                    <GeneralProjectIcon :color="parseProp(base.meta).iconColor" class="flex-none" />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-nc-content-gray-extreme truncate">
                        {{ base.title }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Default Bases Section -->
            <template v-if="displayedBases.default?.length">
              <div class="mb-4">
                <div class="flex items-center gap-2 mb-2 text-xs font-medium text-nc-content-gray-muted uppercase tracking-wide">
                  <GeneralIcon icon="ncFolder" class="w-3.5 h-3.5" />
                  <span>{{ $t('objects.projects') }}</span>
                </div>
                <div class="grid grid-cols-3 gap-3">
                  <div
                    v-for="base in displayedBases.default"
                    :key="base.id"
                    class="nc-base-card group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer border-1 transition-all border-nc-border-gray-medium hover:border-nc-border-gray-dark hover:shadow-sm"
                    @click="onSelectBase(base)"
                  >
                    <GeneralProjectIcon :color="parseProp(base.meta).iconColor" class="flex-none" />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-nc-content-gray-extreme truncate">
                        {{ base.title }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

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
              v-else-if="!filteredStarredBases.length && !filteredPrivateBases.length && !filteredDefaultBases.length"
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
          <kbd class="px-1.5 py-0.5 bg-nc-bg-gray-medium rounded text-[10px]">↑↓</kbd>
          <span>Navigate</span>
        </div>
        <div class="flex items-center gap-1">
          <kbd class="px-1.5 py-0.5 bg-nc-bg-gray-medium rounded text-[10px]">Enter</kbd>
          <span>Select</span>
        </div>
        <div class="flex items-center gap-1">
          <kbd class="px-1.5 py-0.5 bg-nc-bg-gray-medium rounded text-[10px]">Esc</kbd>
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

.nc-base-card {
  @apply bg-white dark:bg-nc-bg-gray-dark;

  &:hover {
    @apply bg-nc-bg-gray-light dark:bg-nc-bg-gray-medium;
  }
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
