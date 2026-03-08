<script lang="ts" setup>
import { ApiTokenScopeResourceType } from 'nocodb-sdk'
import type { ApiTokenScopeEntry } from 'nocodb-sdk'

const props = defineProps<{
  scopes: ApiTokenScopeEntry[]
}>()

const emit = defineEmits(['update:scopes'])

const basesStore = useBases()

const { basesList } = storeToRefs(basesStore)

// Mode: 'org' (no scopes), 'base' (select bases)
const scopeMode = ref<'org' | 'base'>(props.scopes.length ? 'base' : 'org')
const selectedBaseIds = ref<string[]>(
  props.scopes
    .filter((s) => s.resource_type === ApiTokenScopeResourceType.BASE)
    .map((s) => s.resource_id),
)

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
    <div v-if="scopeMode === 'base'" class="ml-8 mt-1">
      <a-select
        v-model:value="selectedBaseIds"
        mode="multiple"
        placeholder="Search and select bases..."
        show-search
        option-filter-prop="label"
        class="w-full"
        size="large"
      >
        <a-select-option v-for="base in basesList" :key="base.id" :value="base.id" :label="base.title">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncDatabase" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
            {{ base.title }}
          </div>
        </a-select-option>
      </a-select>
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
    @apply border-brand-500 bg-nc-bg-brand;
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
</style>
