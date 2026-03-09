<script lang="ts" setup>
import { ApiTokenScopeResourceType, NO_SCOPE } from 'nocodb-sdk'
import type { ApiTokenScopeEntry } from 'nocodb-sdk'

interface BaseListAllData {
  workspaces: {
    id: string
    title: string
    bases: {
      id: string
      title: string
    }[]
  }[]
}

const props = defineProps<{
  scopes: ApiTokenScopeEntry[]
}>()

const emit = defineEmits(['update:scopes'])

const { $api } = useNuxtApp()

const allData = ref<BaseListAllData | null>(null)
const isLoading = ref(false)

// Mode: 'org' (no scopes), 'base' (select bases)
const scopeMode = ref<'org' | 'base'>(props.scopes.length ? 'base' : 'org')
const selectedBaseIds = ref<string[]>(
  props.scopes
    .filter((s) => s.resource_type === ApiTokenScopeResourceType.BASE)
    .map((s) => s.resource_id),
)

// Build a lookup map: baseId → base title
const baseNameMap = computed(() => {
  const map: Record<string, string> = {}
  for (const ws of allData.value?.workspaces || []) {
    for (const base of ws.bases) {
      map[base.id] = base.title
    }
  }
  return map
})

const removeBase = (id: string) => {
  selectedBaseIds.value = selectedBaseIds.value.filter((v) => v !== id)
}

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
  if (scopeMode.value === 'org') {
    emit('update:scopes', [])
    return
  }

  const newScopes: ApiTokenScopeEntry[] = selectedBaseIds.value.map((id) => ({
    resource_type: ApiTokenScopeResourceType.BASE,
    resource_id: id,
  }))
  emit('update:scopes', newScopes)
}

watch(scopeMode, () => {
  emitScopes()
})

watch(selectedBaseIds, () => {
  emitScopes()
})

onMounted(() => {
  loadAll()
})
</script>

<template>
  <div class="nc-token-scope-picker flex flex-col gap-3" data-testid="nc-token-scope-picker">
    <!-- All resources card -->
    <button
      class="nc-scope-card"
      :class="{ 'nc-scope-card-active': scopeMode === 'org' }"
      data-testid="nc-token-scope-org"
      @click="scopeMode = 'org'"
    >
      <div class="nc-scope-card-radio">
        <div v-if="scopeMode === 'org'" class="nc-scope-card-radio-dot" />
      </div>
      <div class="flex-1">
        <div class="text-sm font-semibold text-nc-content-gray-extreme">All resources</div>
        <div class="text-sm text-nc-content-gray-muted mt-0.5">
          Access all bases and workspaces you have access to
        </div>
      </div>
    </button>

    <!-- Specific bases card -->
    <button
      class="nc-scope-card"
      :class="{ 'nc-scope-card-active': scopeMode === 'base' }"
      data-testid="nc-token-scope-base"
      @click="scopeMode = 'base'"
    >
      <div class="nc-scope-card-radio">
        <div v-if="scopeMode === 'base'" class="nc-scope-card-radio-dot" />
      </div>
      <div class="flex-1">
        <div class="text-sm font-semibold text-nc-content-gray-extreme">Specific bases</div>
        <div class="text-sm text-nc-content-gray-muted mt-0.5">
          Restrict this token to only selected bases
        </div>
      </div>
    </button>

    <!-- Base selector (shown when specific bases selected) -->
    <div v-if="scopeMode === 'base'" class="ml-8 mt-1 flex flex-col gap-2">
      <a-select
        v-model:value="selectedBaseIds"
        mode="multiple"
        placeholder="Search and select bases..."
        show-search
        :loading="isLoading"
        option-filter-prop="label"
        class="nc-scope-base-select w-full"
        :max-tag-count="0"
        :max-tag-placeholder="() => ''"
      >
        <a-select-opt-group v-for="ws in allData?.workspaces" :key="ws.id" :label="ws.title">
          <a-select-option v-for="base in ws.bases" :key="base.id" :value="base.id" :label="`${ws.title} / ${base.title}`">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="ncDatabase" class="w-3.5 h-3.5 text-nc-content-gray-muted flex-none" />
              <span class="truncate">{{ base.title }}</span>
            </div>
          </a-select-option>
        </a-select-opt-group>
      </a-select>

      <!-- Selected bases as chips below the selector -->
      <div v-if="selectedBaseIds.length" class="flex flex-wrap gap-1.5">
        <div
          v-for="id in selectedBaseIds"
          :key="id"
          class="nc-scope-tag"
        >
          <GeneralIcon icon="ncDatabase" class="w-3.5 h-3.5 text-nc-content-gray-muted flex-none" />
          <span class="truncate">{{ baseNameMap[id] || id }}</span>
          <NcButton type="text" size="xxsmall" class="!p-0 !h-4 !w-4 !min-w-0 flex-none" @click="removeBase(id)">
            <GeneralIcon icon="close" class="w-3 h-3 text-nc-content-gray-muted" />
          </NcButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-scope-card {
  @apply flex items-start gap-3 px-4 py-3.5 rounded-lg border-1
    border-nc-border-gray-medium bg-nc-bg-default cursor-pointer transition-all text-left w-full;

  &:hover {
    @apply bg-nc-bg-gray-light;
  }

  &.nc-scope-card-active {
    @apply border-brand-500 bg-nc-bg-default;
  }
}

.nc-scope-card-radio {
  @apply w-4.5 h-4.5 mt-0.5 rounded-full border-2 border-nc-border-gray-medium
    flex items-center justify-center flex-none transition-all;

  .nc-scope-card-active & {
    @apply border-brand-500;
  }
}

.nc-scope-card-radio-dot {
  @apply w-2.5 h-2.5 rounded-full bg-brand-500;
}

.nc-scope-base-select {
  :deep(.ant-select-selector) {
    @apply !min-h-8 !rounded-lg !border-nc-border-gray-medium !bg-nc-bg-default;
  }

  :deep(.ant-select-selection-search) {
    @apply !ms-0;
  }

  :deep(.ant-select-selection-overflow-item:not(.ant-select-selection-overflow-item-suffix)) {
    @apply !hidden;
  }

  :deep(.ant-select-selection-placeholder) {
    @apply !start-3 text-nc-content-gray-muted;
  }
}

.nc-scope-tag {
  @apply flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md
    border-1 border-nc-border-gray-medium bg-nc-bg-gray-light
    text-xs text-nc-content-gray-extreme max-w-48;
}
</style>
