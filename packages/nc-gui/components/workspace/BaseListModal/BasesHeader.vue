<script lang="ts" setup>
type FilterType = 'all' | 'starred' | 'private' | 'owned' | 'managed'

const props = defineProps<{
  baseCount: number
  activeFilter: FilterType
  isCompactView?: boolean
  searchQuery?: string
}>()

const emit = defineEmits<{
  'update:activeFilter': [filter: FilterType]
  'update:searchQuery': [query: string]
}>()

const vSearchQuery = useVModel(props, 'searchQuery', emit)

const { t } = useI18n()

const { isMobileMode } = useGlobal()

const isFilterDropdownOpen = ref(false)
const isSearchFocused = ref(false)

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

// Get icon for active filter (for compact display)
const activeFilterIcon = computed(() => {
  return selectedFilter.value?.icon || 'ncList'
})

const onFilterChange = (value: string) => {
  emit('update:activeFilter', value as FilterType)
}
</script>

<template>
  <div class="nc-bases-header flex items-center gap-2 px-4 py-2 border-b border-nc-border-gray-medium">
    <!-- Desktop: Show "Bases in {workspace}" -->
    <template v-if="!isCompactView">
      <div class="flex-1 flex items-center gap-2 text-bodyDefaultSm font-medium">
        <slot name="baseListHeader"> </slot>
        <span class="font-normal text-nc-content-gray-muted">({{ baseCount }})</span>
      </div>

      <!-- Filter Dropdown - Desktop -->
      <NcListDropdown v-model:is-open="isFilterDropdownOpen" :default-slot-wrapper="false" placement="bottomRight">
        <NcButton size="small" type="secondary">
          <div class="flex items-center gap-1">
            <GeneralIcon :icon="activeFilterIcon" class="w-4 h-4" />
            <span class="text-bodyDefaultSm">{{ selectedFilter?.label }}</span>
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
            :min-items-for-search="10"
            @update:value="onFilterChange"
            @escape="onEsc"
          >
            <template #listItemExtraLeft="{ option }">
              <GeneralIcon :icon="option.icon" class="w-4 h-4 text-nc-content-gray-muted" />
            </template>
          </NcList>
        </template>
      </NcListDropdown>
    </template>

    <!-- Compact: Search + Filter -->
    <template v-else>
      <!-- Search Input -->
      <a-input
        v-model:value="vSearchQuery"
        class="nc-bases-search nc-input-sm flex-1"
        :placeholder="$t('activity.searchProject')"
        allow-clear
        @focus="isSearchFocused = true"
        @blur="isSearchFocused = false"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="text-nc-content-gray-muted" />
        </template>
      </a-input>

      <!-- Filter Dropdown - Compact (shows icon only when search focused) -->
      <NcListDropdown v-model:is-open="isFilterDropdownOpen" :default-slot-wrapper="false" placement="bottomRight">
        <NcButton size="small" type="secondary" class="flex-none">
          <div class="flex items-center gap-1">
            <GeneralIcon :icon="activeFilterIcon" class="w-4 h-4" />
            <template v-if="(!isSearchFocused && !vSearchQuery) || !isMobileMode">
              <span class="max-w-20 truncate">{{ selectedFilter?.label }}</span>
              <GeneralIcon
                icon="chevronDown"
                class="w-4 h-4 transition-transform"
                :class="{ 'transform rotate-180': isFilterDropdownOpen }"
              />
            </template>
          </div>
        </NcButton>
        <template #overlay="{ onEsc }">
          <NcList
            v-model:open="isFilterDropdownOpen"
            :value="activeFilter"
            :list="filterOptions"
            variant="medium"
            class="!w-auto min-w-[190px]"
            :min-items-for-search="10"
            @update:value="onFilterChange"
            @escape="onEsc"
          >
            <template #listItemExtraLeft="{ option }">
              <GeneralIcon :icon="option.icon" class="w-4 h-4 text-nc-content-gray-muted" />
            </template>
          </NcList>
        </template>
      </NcListDropdown>
    </template>
  </div>
</template>
