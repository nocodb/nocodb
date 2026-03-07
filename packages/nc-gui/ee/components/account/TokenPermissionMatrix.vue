<script lang="ts" setup>
import {
  ApiTokenPermissionCategory,
  ApiTokenPermissionLevel,
  API_TOKEN_PERMISSION_GROUPS,
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

const categoryLabels: Record<string, string> = {
  [ApiTokenPermissionCategory.RECORDS]: 'Records',
  [ApiTokenPermissionCategory.COMMENTS]: 'Comments',
  [ApiTokenPermissionCategory.TABLES]: 'Tables',
  [ApiTokenPermissionCategory.FIELDS]: 'Fields',
  [ApiTokenPermissionCategory.VIEWS]: 'Views',
  [ApiTokenPermissionCategory.WEBHOOKS]: 'Webhooks',
  [ApiTokenPermissionCategory.EXTENSIONS]: 'Extensions',
  [ApiTokenPermissionCategory.BASE]: 'Base Admin',
}

const setLevel = (category: string, level: string) => {
  permissions.value = {
    ...permissions.value,
    [category]: level,
  }
}

const applyPreset = (preset: 'readOnly' | 'fullData' | 'allWrite') => {
  const newPerms = { ...permissions.value }
  const categories = Object.values(ApiTokenPermissionCategory).filter(
    (c) => !['bases', 'integrations', 'users'].includes(c),
  )

  for (const cat of categories) {
    if (preset === 'readOnly') {
      newPerms[cat] = ['records', 'comments', 'tables', 'fields', 'views'].includes(cat)
        ? ApiTokenPermissionLevel.READ
        : ApiTokenPermissionLevel.NONE
    } else if (preset === 'fullData') {
      newPerms[cat] = ['records', 'comments'].includes(cat)
        ? ApiTokenPermissionLevel.WRITE
        : ['tables', 'fields', 'views'].includes(cat)
          ? ApiTokenPermissionLevel.READ
          : ApiTokenPermissionLevel.NONE
    } else if (preset === 'allWrite') {
      newPerms[cat] = ApiTokenPermissionLevel.WRITE
    }
  }

  permissions.value = newPerms
}
</script>

<template>
  <div class="nc-token-permission-matrix">
    <div class="flex gap-2 mb-4">
      <NcButton size="xs" type="secondary" @click="applyPreset('readOnly')"> Read-only data </NcButton>
      <NcButton size="xs" type="secondary" @click="applyPreset('fullData')"> Full data access </NcButton>
      <NcButton size="xs" type="secondary" @click="applyPreset('allWrite')"> Full access </NcButton>
    </div>

    <div class="border rounded-lg overflow-hidden">
      <!-- Header -->
      <div class="flex bg-nc-bg-gray-extralight border-b px-4 py-2.5">
        <div class="w-1/3 text-nc-content-gray-muted font-medium text-sm">Permission</div>
        <div v-for="level in levels" :key="level.value" class="flex-1 text-center text-nc-content-gray-muted font-medium text-sm">
          {{ level.label }}
        </div>
      </div>

      <!-- Groups -->
      <template v-for="(categories, groupName) in groups" :key="groupName">
        <div class="px-4 py-2 bg-nc-bg-gray-extralight/50 border-b">
          <span class="text-xs font-semibold uppercase tracking-wider text-nc-content-gray-muted">{{ groupName }}</span>
        </div>

        <div v-for="category in categories" :key="category" class="flex items-center px-4 py-2.5 border-b last:border-b-0 hover:bg-nc-bg-gray-extralight/30">
          <div class="w-1/3 text-sm text-nc-content-gray-extreme">
            {{ categoryLabels[category] || category }}
          </div>
          <div v-for="level in levels" :key="level.value" class="flex-1 flex justify-center">
            <a-radio
              :checked="(permissions[category] || ApiTokenPermissionLevel.NONE) === level.value"
              @change="setLevel(category, level.value)"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
