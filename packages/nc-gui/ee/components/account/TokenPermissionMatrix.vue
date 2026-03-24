<script lang="ts" setup>
import {
  ApiTokenPermissionCategory,
  ApiTokenPermissionLevel,
  API_TOKEN_PERMISSION_GROUPS,
  API_TOKEN_PERMISSION_PRESETS,
} from 'nocodb-sdk'

const props = defineProps<{
  modelValue: Record<string, string>
}>()

const emit = defineEmits(['update:modelValue'])

const permissions = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const groups = computed(() => {
  return API_TOKEN_PERMISSION_GROUPS
})

const levels = [
  { value: ApiTokenPermissionLevel.NONE, label: 'None' },
  { value: ApiTokenPermissionLevel.READ, label: 'Read' },
  { value: ApiTokenPermissionLevel.WRITE, label: 'Write' },
]

const categoryLabels: Record<string, { label: string; desc: string }> = {
  [ApiTokenPermissionCategory.RECORDS]: { label: 'Records', desc: 'List, read, create, update, and delete records' },
  [ApiTokenPermissionCategory.COMMENTS]: { label: 'Comments', desc: 'View and post comments on records' },
  [ApiTokenPermissionCategory.TABLES]: { label: 'Tables', desc: 'List, create, update, and delete tables' },
  [ApiTokenPermissionCategory.FIELDS]: { label: 'Fields', desc: 'List, create, update, and delete columns' },
  [ApiTokenPermissionCategory.VIEWS]: { label: 'Views', desc: 'Manage views, sorts, filters, and sharing' },
  [ApiTokenPermissionCategory.WEBHOOKS]: { label: 'Webhooks', desc: 'Manage webhook triggers and logs' },
  [ApiTokenPermissionCategory.BASE]: { label: 'Base', desc: 'Base settings, sources, and jobs' },
  [ApiTokenPermissionCategory.USERS]: { label: 'Users', desc: 'Base members, workspace members, and invitations' },
}

const setLevel = (category: string, level: string) => {
  permissions.value = {
    ...permissions.value,
    [category]: level,
  }
}

const matchesPreset = (p: Record<string, string>, preset: Record<string, string>) => {
  return Object.values(ApiTokenPermissionCategory).every(
    (c) => (p[c] || ApiTokenPermissionLevel.NONE) === (preset[c] || ApiTokenPermissionLevel.NONE),
  )
}

const activePreset = computed(() => {
  const p = permissions.value
  const cats = Object.values(ApiTokenPermissionCategory)

  const allWrite = cats.every((c) => p[c] === ApiTokenPermissionLevel.WRITE)
  if (allWrite) return 'allWrite'

  if (matchesPreset(p, API_TOKEN_PERMISSION_PRESETS.readOnly as Record<string, string>)) return 'readOnly'
  if (matchesPreset(p, API_TOKEN_PERMISSION_PRESETS.fullDataAccess as Record<string, string>)) return 'fullData'

  return null
})

const applyPreset = (preset: 'readOnly' | 'fullData' | 'allWrite') => {
  const categories = Object.values(ApiTokenPermissionCategory)

  if (preset === 'readOnly') {
    permissions.value = { ...API_TOKEN_PERMISSION_PRESETS.readOnly } as Record<string, string>
  } else if (preset === 'fullData') {
    permissions.value = { ...API_TOKEN_PERMISSION_PRESETS.fullDataAccess } as Record<string, string>
  } else if (preset === 'allWrite') {
    const newPerms: Record<string, string> = {}
    for (const cat of categories) {
      newPerms[cat] = ApiTokenPermissionLevel.WRITE
    }
    permissions.value = newPerms
  }
}
</script>

<template>
  <div class="nc-token-permission-matrix">
    <!-- Presets -->
    <div class="flex gap-2 mb-4">
      <NcButton
        size="xs"
        :type="activePreset === 'readOnly' ? 'primary' : 'secondary'"
        data-testid="nc-token-perm-preset-readonly"
        @click="applyPreset('readOnly')"
      >
        Read-only
      </NcButton>
      <NcButton
        size="xs"
        :type="activePreset === 'fullData' ? 'primary' : 'secondary'"
        data-testid="nc-token-perm-preset-fulldata"
        @click="applyPreset('fullData')"
      >
        Full data access
      </NcButton>
      <NcButton
        size="xs"
        :type="activePreset === 'allWrite' ? 'primary' : 'secondary'"
        data-testid="nc-token-perm-preset-allwrite"
        @click="applyPreset('allWrite')"
      >
        Full access
      </NcButton>
    </div>

    <!-- Matrix table -->
    <div class="border-1 rounded-md overflow-hidden">
      <!-- Header -->
      <div class="flex items-center bg-nc-bg-gray-extralight px-4 py-2.5">
        <div class="w-[44%] text-3.5 font-medium text-nc-content-gray-muted">Category</div>
        <div
          v-for="level in levels"
          :key="level.value"
          class="flex-1 text-center text-3.5 font-medium text-nc-content-gray-muted"
        >
          {{ level.label }}
        </div>
      </div>

      <!-- Groups -->
      <template v-for="(categories, groupName) in groups" :key="groupName">
        <!-- Group header -->
        <div class="flex items-center gap-2 px-4 py-2 bg-nc-bg-gray-extralight/60 border-t-1">
          <span class="text-xs font-bold uppercase tracking-wider text-nc-content-gray-muted">{{ groupName }}</span>
        </div>

        <!-- Category rows -->
        <div
          v-for="category in categories"
          :key="category"
          class="flex items-center px-4 py-2.5 border-t-1 border-nc-border-gray-light"
        >
          <div class="w-[44%]">
            <div class="text-sm text-nc-content-gray-extreme font-medium">
              {{ categoryLabels[category]?.label || category }}
            </div>
            <div v-if="categoryLabels[category]?.desc" class="text-[11px] leading-3.5 text-nc-content-gray-subtle2 mt-0.5">
              {{ categoryLabels[category].desc }}
            </div>
          </div>
          <div v-for="level in levels" :key="level.value" class="flex-1 flex justify-center">
            <button
              class="nc-perm-radio"
              :class="{
                'nc-perm-radio-active': (permissions[category] || ApiTokenPermissionLevel.NONE) === level.value,
                'nc-perm-radio-write': level.value === ApiTokenPermissionLevel.WRITE && (permissions[category] || ApiTokenPermissionLevel.NONE) === level.value,
                'nc-perm-radio-read': level.value === ApiTokenPermissionLevel.READ && (permissions[category] || ApiTokenPermissionLevel.NONE) === level.value,
                'nc-perm-radio-none': level.value === ApiTokenPermissionLevel.NONE && (permissions[category] || ApiTokenPermissionLevel.NONE) === level.value,
              }"
              :data-testid="`nc-token-perm-${category}-${level.value}`"
              @click="setLevel(category, level.value)"
            >
              <div class="nc-perm-radio-dot" />
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-perm-radio {
  @apply w-5 h-5 rounded-full border-2 border-gray-300
    flex items-center justify-center cursor-pointer transition-all;

  &:hover {
    @apply border-gray-400;
  }

  .nc-perm-radio-dot {
    @apply w-0 h-0 rounded-full transition-all;
  }

  &.nc-perm-radio-active {
    .nc-perm-radio-dot {
      @apply w-2.5 h-2.5;
    }
  }

  &.nc-perm-radio-write {
    @apply border-brand-500;
    .nc-perm-radio-dot {
      @apply bg-brand-500;
    }
  }
  &.nc-perm-radio-read {
    @apply border-green-500;
    .nc-perm-radio-dot {
      @apply bg-green-500;
    }
  }
  &.nc-perm-radio-none {
    @apply border-gray-400;
    .nc-perm-radio-dot {
      @apply bg-gray-400;
    }
  }
}
</style>
