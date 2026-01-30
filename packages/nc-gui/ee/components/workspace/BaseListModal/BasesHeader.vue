<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'

type FilterType = 'all' | 'starred' | 'private' | 'owned' | 'managed'

const props = defineProps<{
  workspace: WorkspaceType | undefined
  baseCount: number
  activeFilter: FilterType
}>()

const emit = defineEmits<{
  'update:activeFilter': [filter: FilterType]
}>()

const { workspace } = toRefs(props)

const { t } = useI18n()

const isFilterDropdownOpen = ref(false)

// Filter options in priority order: Starred → Private → Managed → Owned
const filterOptions = computed<NcListItemType[]>(() => [
  { value: 'all', label: t('activity.allBases'), icon: 'ncList' },
  { value: 'starred', label: t('general.starred'), icon: 'star' },
  { value: 'private', label: t('general.private'), icon: 'ncLock' },
  { value: 'managed', label: t('labels.managed'), icon: 'ncBox' },
  { value: 'owned', label: t('activity.ownedByMe'), icon: 'ncUser' },
])

const selectedFilter = computed(() => {
  return filterOptions.value.find((option) => option.value === props.activeFilter)
})

const onFilterChange = (value: string) => {
  emit('update:activeFilter', value as FilterType)
}
</script>

<template>
  <div class="nc-bases-header flex items-center justify-between px-4 py-2 border-b border-nc-border-gray-medium">
    <div class="flex items-center gap-2 text-bodyDefaultSm font-medium">
      <span class="text-nc-content-gray-subtle">
        {{ $t('activity.basesIn') }}
      </span>
      <span class="text-nc-content-gray-extreme capitalize">
        {{ workspace?.title }}
      </span>
      <span class="font-normal text-nc-content-gray-muted">({{ baseCount }})</span>
    </div>

    <!-- Filter Dropdown -->
    <NcListDropdown v-model:is-open="isFilterDropdownOpen" :default-slot-wrapper="false" placement="bottomRight">
      <NcButton size="small" type="secondary">
        <div class="flex items-center gap-1">
          <GeneralIcon icon="filter" class="w-4 h-4" />
          <span>{{ selectedFilter?.label }}</span>
          <GeneralIcon
            icon="chevronDown"
            class="w-4 h-4 transition-transform"
            :class="{ 'transform rotate-180': isFilterDropdownOpen }"
          />
        </div>
      </NcButton>
      <template #overlay="{ onEsc }">
        <NcList
          v-model:open="isFilterDropdownOpen"
          :value="activeFilter"
          :list="filterOptions"
          variant="medium"
          class="!w-auto min-w-[190px]"
          :show-search-always="false"
          @update:value="onFilterChange"
          @escape="onEsc"
        >
          <template #listItemExtraLeft="{ option }">
            <GeneralIcon :icon="option.icon" class="w-4 h-4 text-nc-content-gray-muted" />
          </template>
        </NcList>
      </template>
    </NcListDropdown>
  </div>
</template>
