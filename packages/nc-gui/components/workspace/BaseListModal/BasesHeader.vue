<script lang="ts" setup>
import { OrgUserRoles } from 'nocodb-sdk'

type FilterType = 'all' | 'starred' | 'private' | 'owned' | 'managed'

const props = defineProps<{
  baseCount: number
  activeFilter: FilterType
  isCompactView?: boolean
  searchQuery?: string
  selectedWorkspaceId?: string
}>()

const emit = defineEmits<{
  'update:activeFilter': [filter: FilterType]
  'update:searchQuery': [query: string]
}>()

const vSearchQuery = useVModel(props, 'searchQuery', emit)

const { selectedWorkspaceId } = toRefs(props)

const { t } = useI18n()

const { isMobileMode } = useGlobal()

const { orgRoles } = useRoles()

const isFilterDropdownOpen = ref(false)
const isSearchFocused = ref(false)

const isSuperAdmin = computed(() => !!orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

// Filter options in priority order: Starred → Private → Managed → Owned
const filterOptions = computed<NcListItemType[]>(() => [
  { value: 'all', label: t('activity.allBases'), icon: 'ncList' },
  ...(isEeUI
    ? [
        { value: 'starred', label: t('general.starred'), icon: 'star' },
        { value: 'private', label: t('general.private'), icon: 'ncLock' },
        { value: 'managed', label: t('labels.managed'), icon: 'ncBox' },
      ]
    : []),
  ...(!isSuperAdmin.value ? [{ value: 'owned', label: t('activity.ownedByMe'), icon: 'ncUser' }] : []),
])

const selectedFilter = computed(() => {
  return filterOptions.value.find((option) => option.value === props.activeFilter)
})

// Get icon for active filter (for compact display)
const activeFilterIcon = computed(() => {
  return selectedFilter.value?.icon || 'ncList'
})

const isFilterActive = computed(() => props.activeFilter !== 'all')

const onFilterChange = (value: string) => {
  emit('update:activeFilter', value as FilterType)
}

const clearFilter = () => {
  emit('update:activeFilter', 'all')
}
</script>

<template>
  <div class="nc-bases-header flex items-center gap-2 px-4 py-2 border-b border-nc-border-gray-medium">
    <!-- Desktop: Show "Bases in {workspace}" -->
    <template v-if="!isCompactView">
      <div class="flex-1 flex items-center gap-2 text-xs font-medium tracking-wide">
        <slot name="baseListHeader"> </slot>
        <span class="font-normal text-nc-content-gray-muted">({{ baseCount }})</span>
      </div>

      <!-- Active filter pill -->
      <div v-if="isFilterActive" class="nc-filter-pill" @click.stop>
        <GeneralIcon :icon="activeFilterIcon" class="w-3.5 h-3.5" />
        <span class="text-bodyDefaultSm font-medium">{{ selectedFilter?.label }}</span>
        <GeneralIcon icon="close" class="nc-filter-pill-close w-3.5 h-3.5 cursor-pointer" @click="clearFilter" />
      </div>

      <!-- Filter Dropdown - Desktop -->
      <NcListDropdown
        v-if="!isFilterActive"
        v-model:is-open="isFilterDropdownOpen"
        :default-slot-wrapper="false"
        placement="bottomRight"
      >
        <NcButton size="small" type="secondary">
          <div class="flex items-center gap-1">
            <GeneralIcon icon="ncList" class="w-4 h-4" />
            <span class="text-bodyDefaultSm">{{ $t('activity.allBases') }}</span>
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
            wrapper-class-name="!h-auto"
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
      <WorkspaceCreateProjectBtn :workspace-id="selectedWorkspaceId ?? undefined" type="primary" placement="bottomRight">
        <div class="flex items-center gap-1.5">
          <GeneralIcon icon="plus" />
          {{ $t('title.newProj') }}
        </div>
      </WorkspaceCreateProjectBtn>
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

      <!-- Active filter pill - Compact -->
      <div v-if="isFilterActive" class="nc-filter-pill flex-none" @click.stop>
        <GeneralIcon :icon="activeFilterIcon" class="w-3.5 h-3.5" />
        <span class="text-bodyDefaultSm font-medium max-w-20 truncate">{{ selectedFilter?.label }}</span>
        <GeneralIcon icon="close" class="nc-filter-pill-close w-3.5 h-3.5 cursor-pointer" @click="clearFilter" />
      </div>

      <!-- Filter Dropdown - Compact -->
      <NcListDropdown
        v-if="!isFilterActive"
        v-model:is-open="isFilterDropdownOpen"
        :default-slot-wrapper="false"
        placement="bottomRight"
      >
        <NcButton size="small" type="secondary" class="flex-none">
          <div class="flex items-center gap-1">
            <GeneralIcon icon="ncList" class="w-4 h-4" />
            <template v-if="(!isSearchFocused && !vSearchQuery) || !isMobileMode">
              <span class="max-w-20 truncate">{{ $t('activity.allBases') }}</span>
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
            wrapper-class-name="!h-auto"
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

<style scoped lang="scss">
.nc-filter-pill {
  @apply flex items-center gap-1.5 px-2 py-1 rounded-full
    bg-nc-bg-brand-soft text-nc-content-brand text-xs font-medium
    border-1 border-nc-border-brand;

  .nc-filter-pill-close {
    @apply rounded-full opacity-70 transition-opacity;

    &:hover {
      @apply opacity-100;
    }
  }
}
</style>
