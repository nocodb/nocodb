<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'

type FilterType = 'all' | 'starred' | 'private' | 'owned'

const props = defineProps<{
  workspace: WorkspaceType | undefined
  baseCount: number
  activeFilter: FilterType
}>()

const emit = defineEmits<{
  'update:activeFilter': [filter: FilterType]
}>()

const { t } = useI18n()

const filterLabel = computed(() => {
  switch (props.activeFilter) {
    case 'starred':
      return t('general.starred')
    case 'private':
      return t('general.private')
    case 'owned':
      return t('activity.ownedByMe')
    default:
      return t('activity.allBases')
  }
})

const onFilterChange = (filter: FilterType) => {
  emit('update:activeFilter', filter)
}
</script>

<template>
  <div class="nc-bases-header flex items-center justify-between px-4 py-2 border-b border-nc-border-gray-medium">
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-nc-content-gray-subtle">
        {{ $t('activity.basesIn') }}
      </span>
      <span class="text-sm font-semibold text-nc-content-gray-extreme capitalize">
        {{ workspace?.title }}
      </span>
      <span class="text-xs text-nc-content-gray-muted">({{ baseCount }})</span>
    </div>

    <!-- Filter Dropdown -->
    <NcDropdown placement="bottomRight">
      <NcButton size="small" type="secondary">
        <div class="flex items-center gap-1">
          <GeneralIcon icon="filter" class="w-4 h-4" />
          <span>{{ filterLabel }}</span>
          <GeneralIcon icon="chevronDown" class="w-4 h-4" />
        </div>
      </NcButton>
      <template #overlay>
        <NcMenu>
          <NcMenuItem @click="onFilterChange('all')">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="list" />
              <span>{{ $t('activity.allBases') }}</span>
            </div>
          </NcMenuItem>
          <NcMenuItem @click="onFilterChange('starred')">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="star" />
              <span>{{ $t('general.starred') }}</span>
            </div>
          </NcMenuItem>
          <NcMenuItem @click="onFilterChange('private')">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="lock" />
              <span>{{ $t('general.private') }}</span>
            </div>
          </NcMenuItem>
          <NcMenuItem @click="onFilterChange('owned')">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="account" />
              <span>{{ $t('activity.ownedByMe') }}</span>
            </div>
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
</template>
