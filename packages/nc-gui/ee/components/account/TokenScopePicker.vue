<script lang="ts" setup>
import { ApiTokenScopeResourceType, NO_SCOPE } from 'nocodb-sdk'
import type { ApiTokenScopeEntry } from 'nocodb-sdk'

interface BaseInfo {
  id: string
  title: string
  meta?: Record<string, any>
}

interface WorkspaceInfo {
  id: string
  title: string
  bases: BaseInfo[]
}

interface BaseListAllData {
  workspaces: WorkspaceInfo[]
}

const props = defineProps<{
  scopes: ApiTokenScopeEntry[]
}>()

const emit = defineEmits(['update:scopes'])

const { $api } = useNuxtApp()
const { t } = useI18n()

const allData = ref<BaseListAllData | null>(null)
const isLoading = ref(false)
const showBaseDropdown = ref(false)
const searchQuery = ref('')

// Track state: has "all resources" been added?
// Initialize from props: sentinel present, or editing with no base scopes = org-wide
const hasAllResources = ref(
  props.scopes.some((s) => s.resource_type === 'all') ||
  (props.scopes.length > 0 && !props.scopes.some((s) => s.resource_type === ApiTokenScopeResourceType.BASE)),
)

// Track selected base IDs
const selectedBaseIds = ref<string[]>(
  props.scopes
    .filter((s) => s.resource_type === ApiTokenScopeResourceType.BASE)
    .map((s) => s.resource_id),
)

// Initialize from props — if no scopes, nothing is selected
// (unlike radio cards, the user starts from scratch)
onMounted(() => {
  loadAll()
})

const baseInfoMap = computed(() => {
  const map: Record<string, { title: string; meta?: Record<string, any>; workspaceTitle: string }> = {}
  for (const ws of allData.value?.workspaces || []) {
    for (const base of ws.bases) {
      map[base.id] = { title: base.title, meta: base.meta, workspaceTitle: ws.title }
    }
  }
  return map
})

// Group selected bases by workspace for display
const selectedByWorkspace = computed(() => {
  const groups: { workspace: WorkspaceInfo; bases: BaseInfo[] }[] = []

  for (const ws of allData.value?.workspaces || []) {
    const selected = ws.bases.filter((b) => selectedBaseIds.value.includes(b.id))
    if (selected.length) {
      groups.push({ workspace: ws, bases: selected })
    }
  }

  return groups
})

// Filtered workspaces/bases for dropdown search
const filteredWorkspaces = computed(() => {
  if (!allData.value) return []
  const q = searchQuery.value.toLowerCase().trim()

  return allData.value.workspaces
    .map((ws) => ({
      ...ws,
      bases: ws.bases.filter((b) => {
        if (selectedBaseIds.value.includes(b.id)) return false
        if (!q) return true
        return b.title.toLowerCase().includes(q) || ws.title.toLowerCase().includes(q)
      }),
    }))
    .filter((ws) => ws.bases.length > 0)
})

const loadAll = async () => {
  if (allData.value) return
  isLoading.value = true
  try {
    allData.value = (await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
      operation: 'baseListAll',
    })) as BaseListAllData
  } catch {
    // ignore
  } finally {
    isLoading.value = false
  }
}

const emitScopes = () => {
  if (hasAllResources.value) {
    // Emit a sentinel scope to indicate "all resources" was explicitly selected
    // Backend treats empty scopes as org-wide; this lets the parent distinguish
    // "all resources selected" from "nothing selected"
    emit('update:scopes', [{ resource_type: 'all', resource_id: '*' }] as ApiTokenScopeEntry[])
    return
  }

  const newScopes: ApiTokenScopeEntry[] = selectedBaseIds.value.map((id) => ({
    resource_type: ApiTokenScopeResourceType.BASE,
    resource_id: id,
  }))
  emit('update:scopes', newScopes)
}

const addAllResources = () => {
  hasAllResources.value = true
  selectedBaseIds.value = []
  emitScopes()
}

const removeAllResources = () => {
  hasAllResources.value = false
  emitScopes()
}

const addBase = (baseId: string) => {
  if (selectedBaseIds.value.includes(baseId)) return
  selectedBaseIds.value = [...selectedBaseIds.value, baseId]
  showBaseDropdown.value = false
  searchQuery.value = ''
  emitScopes()
}

const removeBase = (baseId: string) => {
  selectedBaseIds.value = selectedBaseIds.value.filter((id) => id !== baseId)
  emitScopes()
}

const toggleBaseDropdown = () => {
  showBaseDropdown.value = !showBaseDropdown.value
  if (showBaseDropdown.value) {
    searchQuery.value = ''
  }
}
</script>

<template>
  <div class="nc-token-scope-picker flex flex-col gap-2" data-testid="nc-token-scope-picker">
    <!-- Added resources in single bordered container -->
    <div
      v-if="hasAllResources || selectedByWorkspace.length"
      class="nc-scope-container"
    >
      <!-- All Resources section -->
      <template v-if="hasAllResources">
        <div class="nc-scope-group-header">
          {{ $t('labels.allResources') }}
        </div>
        <div class="nc-scope-row">
          <GeneralIcon icon="globe" class="w-5 h-5 text-nc-content-gray-subtle2 flex-none" />
          <span class="flex-1 text-sm text-nc-content-gray-extreme">
            {{ $t('msg.info.allCurrentAndFutureBasesInAllWorkspaces') }}
          </span>
          <NcButton type="text" size="xxsmall" class="!p-0.5 flex-none" @click="removeAllResources">
            <GeneralIcon icon="close" class="w-4 h-4 text-nc-content-gray-muted" />
          </NcButton>
        </div>
      </template>

      <!-- Selected bases grouped by workspace -->
      <template v-for="(group, gIdx) in selectedByWorkspace" :key="group.workspace.id">
        <div
          class="nc-scope-group-header"
          :class="{ '!border-t-1': gIdx > 0 || hasAllResources }"
        >
          {{ group.workspace.title }}
        </div>
        <div
          v-for="(base, bIdx) in group.bases"
          :key="base.id"
          class="nc-scope-row"
          :class="{ 'border-t-1 border-nc-border-gray-light': bIdx > 0 }"
        >
          <div class="min-w-5 flex items-center justify-center flex-none">
            <GeneralProjectIcon :color="parseProp(base.meta).iconColor" size="small" />
          </div>
          <span class="flex-1 text-sm text-nc-content-gray-extreme truncate">{{ base.title }}</span>
          <NcButton type="text" size="xxsmall" class="!p-0.5 flex-none" @click="removeBase(base.id)">
            <GeneralIcon icon="close" class="w-4 h-4 text-nc-content-gray-muted" />
          </NcButton>
        </div>
      </template>
    </div>

    <!-- Action links -->
    <div class="flex items-center gap-4">
      <NcButton
        v-if="!hasAllResources"
        v-e="['c:api-token:add-all-resources']"
        type="text"
        size="small"
        class="!text-brand-500 !px-2 !font-medium"
        data-testid="nc-token-scope-add-all"
        @click="addAllResources"
      >
        <div class="flex items-center gap-1">
          <component :is="iconMap.plus" class="w-4 h-4" />
          {{ $t('labels.addAllResources') }}
        </div>
      </NcButton>

      <NcDropdown
        v-model:visible="showBaseDropdown"
        :trigger="['click']"
        placement="bottomLeft"
        overlay-class-name="nc-scope-base-dropdown"
      >
        <NcButton
          v-e="['c:api-token:add-base']"
          type="text"
          size="small"
          class="!text-brand-500 !px-2 !font-medium"
          data-testid="nc-token-scope-add-base"
          @click="toggleBaseDropdown"
        >
          <div class="flex items-center gap-1">
            <component :is="iconMap.plus" class="w-4 h-4" />
            {{ $t('labels.addABase') }}
          </div>
        </NcButton>

        <template #overlay>
          <div class="nc-scope-dropdown-content">
            <div class="px-2 pt-2 pb-1">
              <a-input
                v-model:value="searchQuery"
                :placeholder="$t('placeholder.findBaseOrWorkspace')"
                class="!rounded-lg"
                allow-clear
              >
                <template #prefix>
                  <GeneralIcon icon="search" class="w-4 h-4 text-nc-content-gray-muted" />
                </template>
              </a-input>
            </div>

            <div class="max-h-64 overflow-y-auto nc-scrollbar-thin">
              <div v-if="isLoading" class="flex items-center justify-center py-4">
                <GeneralLoader size="regular" />
              </div>

              <template v-else-if="filteredWorkspaces.length">
                <div v-for="ws in filteredWorkspaces" :key="ws.id" class="py-1">
                  <div class="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-nc-content-gray-muted">
                    {{ ws.title }}
                  </div>
                  <div
                    v-for="base in ws.bases"
                    :key="base.id"
                    class="nc-scope-dropdown-item"
                    @click="addBase(base.id)"
                  >
                    <div class="min-w-5 flex items-center justify-center flex-none">
                      <GeneralProjectIcon :color="parseProp(base.meta).iconColor" size="small" />
                    </div>
                    <span class="truncate">{{ base.title }}</span>
                  </div>
                </div>
              </template>

              <div v-else class="px-3 py-4 text-sm text-nc-content-gray-muted text-center">
                {{ $t('labels.noData') }}
              </div>
            </div>
          </div>
        </template>
      </NcDropdown>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-scope-group-header {
  @apply px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-nc-content-gray-muted
    bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-light;
}

.nc-scope-row {
  @apply flex items-center gap-3 px-3 py-2.5;
}

.nc-scope-container {
  @apply border-1 border-nc-border-gray-medium rounded-lg overflow-hidden;
}

.nc-scope-dropdown-content {
  @apply w-80 bg-nc-bg-default rounded-lg shadow-lg border-1 border-nc-border-gray-medium;
}

.nc-scope-dropdown-item {
  @apply flex items-center gap-2 px-3 py-2 cursor-pointer text-sm text-nc-content-gray-extreme;

  &:hover {
    @apply bg-nc-bg-gray-light;
  }
}
</style>
