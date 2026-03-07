<script lang="ts" setup>
import { ApiTokenScopeResourceType } from 'nocodb-sdk'
import type { ApiTokenScopeEntry } from 'nocodb-sdk'

const props = defineProps<{
  scopes: ApiTokenScopeEntry[]
}>()

const emit = defineEmits(['update:scopes'])

const { api } = useApi()

const bases = ref<any[]>([])
const loadingBases = ref(false)

// Mode: 'org' (no scopes), 'base' (select bases)
const scopeMode = ref<'org' | 'base'>(props.scopes.length ? 'base' : 'org')
const selectedBaseIds = ref<string[]>(
  props.scopes
    .filter((s) => s.resource_type === ApiTokenScopeResourceType.BASE)
    .map((s) => s.resource_id),
)

const loadBases = async () => {
  if (bases.value.length) return
  loadingBases.value = true
  try {
    const response = await api.base.list()
    bases.value = response?.list || []
  } catch {
    // ignore
  } finally {
    loadingBases.value = false
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

watch(scopeMode, (val) => {
  if (val === 'base') {
    loadBases()
  }
  emitScopes()
})

watch(selectedBaseIds, () => {
  emitScopes()
})
</script>

<template>
  <div class="nc-token-scope-picker flex flex-col gap-4">
    <a-radio-group v-model:value="scopeMode" class="flex flex-col gap-3">
      <a-radio value="org" class="!items-start">
        <div>
          <div class="font-medium text-sm text-nc-content-gray-extreme">All resources</div>
          <div class="text-xs text-nc-content-gray-muted">Access all bases and workspaces you have access to</div>
        </div>
      </a-radio>
      <a-radio value="base" class="!items-start">
        <div>
          <div class="font-medium text-sm text-nc-content-gray-extreme">Specific bases</div>
          <div class="text-xs text-nc-content-gray-muted">Restrict token to selected bases</div>
        </div>
      </a-radio>
    </a-radio-group>

    <div v-if="scopeMode === 'base'" class="ml-6">
      <a-select
        v-model:value="selectedBaseIds"
        mode="multiple"
        placeholder="Select bases"
        show-search
        :loading="loadingBases"
        option-filter-prop="label"
        class="w-full max-w-80"
      >
        <a-select-option v-for="base in bases" :key="base.id" :value="base.id" :label="base.title">
          {{ base.title }}
        </a-select-option>
      </a-select>
    </div>
  </div>
</template>
