<script lang="ts" setup>
import { Empty } from 'ant-design-vue'
import { ProjectRoles } from 'nocodb-sdk'

provide(IsWsBaseListModalInj, readonly(ref(true)))

const basesStore = useBases()

const { basesList, isProjectsLoading } = storeToRefs(basesStore)

const { t } = useI18n()

// Actions provider
const { dialogState } = useProvideWsBaseListActions(() => {})

// Search — shared with sidebar
const searchQuery = useState<string>('ws-home-search', () => '')

// Filter state — CE only has 'all' | 'owned'
type FilterType = 'all' | 'owned'
const activeFilter = ref<FilterType>('all')

const workspaceBases = computed(() => basesList.value)

const baseCount = computed(() => workspaceBases.value.length)

// Base attribute checkers
const baseCheckers = {
  starred: (base: NcProject) => !!base.starred,
  private: (base: NcProject) => base.default_role === ProjectRoles.NO_ACCESS,
  managed: (base: NcProject) => !!base.managed_app_id,
  owned: (base: NcProject) => base.project_role === ProjectRoles.OWNER,
}

const filterWithSearch = (bases: NcProject[]) => {
  if (!searchQuery.value) return bases
  return bases.filter((base) => searchCompare(base.title, searchQuery.value))
}

// CE categorization: owned + default only
const categorizedBases = computed(() => {
  const bases = workspaceBases.value
  const { starred, private: isPrivate, managed, owned } = baseCheckers

  const ownedBases = bases.filter((b) => owned(b))
  const defaultBases = bases.filter((b) => !starred(b) && !isPrivate(b) && !managed(b) && !owned(b))

  return { owned: ownedBases, default: defaultBases }
})

const allFilteredBases = computed(() => {
  const bases = workspaceBases.value
  return {
    owned: bases.filter(baseCheckers.owned),
  }
})

type SectionType = 'owned' | 'default'
const sectionOrder: SectionType[] = ['owned', 'default']

const displayedSections = computed(() => {
  const filter = activeFilter.value

  if (filter === 'all') {
    return sectionOrder
      .map((type) => ({
        type,
        bases: filterWithSearch(categorizedBases.value[type]),
      }))
      .filter((section) => section.bases.length > 0)
  }

  const bases = filterWithSearch(allFilteredBases.value[filter] || [])
  return [{ type: filter, bases }]
})

const emptyFilterResult = computed(() => {
  return displayedSections.value.every((section) => section.bases.length === 0) && !searchQuery.value
})

const hasNoSearchResults = computed(() => {
  if (workspaceBases.value.length === 0) return false
  return displayedSections.value.length === 0 && searchQuery.value.length > 0
})

const isFilterActive = computed(() => activeFilter.value !== 'all')

const filterOptions = computed<{ value: string; label: string; icon: string }[]>(() => [
  { value: 'all', label: t('activity.allBases'), icon: 'ncList' },
  { value: 'owned', label: t('activity.ownedByMe'), icon: 'ncUser' },
])

const selectedFilter = computed(() => filterOptions.value.find((o) => o.value === activeFilter.value))
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar: Filter (left) + New Base (right) -->
    <div class="flex items-center justify-between gap-2 w-full nc-content-max-w mx-auto px-4 pt-4 md:(px-6 pt-6) pb-2 flex-none">
      <div class="flex items-center gap-2">
        <!-- Active filter pill -->
        <div v-if="isFilterActive" class="nc-filter-pill" @click.stop>
          <GeneralIcon :icon="selectedFilter?.icon || 'ncList'" class="w-3.5 h-3.5" />
          <span class="text-bodyDefaultSm font-medium">{{ selectedFilter?.label }}</span>
          <GeneralIcon icon="close" class="nc-filter-pill-close w-3.5 h-3.5 cursor-pointer" @click="activeFilter = 'all'" />
        </div>

        <!-- Filter Dropdown -->
        <NcDropdown v-if="!isFilterActive">
          <NcButton size="small" type="secondary">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="ncList" class="w-4 h-4" />
              <span class="text-bodyDefaultSm">{{ $t('activity.allBases') }}</span>
              <GeneralIcon icon="chevronDown" class="w-3.5 h-3.5" />
            </div>
          </NcButton>
          <template #overlay>
            <NcMenu>
              <NcMenuItem v-for="opt in filterOptions" :key="opt.value" @click="activeFilter = opt.value as FilterType">
                <GeneralIcon :icon="opt.icon" class="w-4 h-4" />
                {{ opt.label }}
                <GeneralIcon v-if="activeFilter === opt.value" icon="check" class="w-4 h-4 text-primary ml-auto" />
              </NcMenuItem>
            </NcMenu>
          </template>
        </NcDropdown>
      </div>

      <WorkspaceCreateProjectBtn
        type="primary"
        placement="bottomRight"
        centered
        inner-class="children:justify-center"
      >
        <div class="flex items-center gap-1.5">
          <GeneralIcon icon="plus" />
          <span class="hidden sm:inline">{{ $t('title.newProj') }}</span>
        </div>
      </WorkspaceCreateProjectBtn>
    </div>

    <!-- Bases Content — scrollbar at extreme edge -->
    <div class="flex-1 overflow-y-auto nc-scrollbar-thin w-full">
      <div class="nc-content-max-w mx-auto px-4 md:px-6 py-4 flex flex-col relative">
        <!-- Categorized sections -->
        <WorkspaceBaseListModalBasesSection
          v-for="section in displayedSections"
          :key="section.type"
          :type="section.type"
          :bases="section.bases"
          :is-filter-applied="activeFilter !== 'all'"
          :is-base-starred="baseCheckers.starred"
          :is-base-private="baseCheckers.private"
        />

        <!-- Loading -->
        <GeneralOverlay
          v-if="isProjectsLoading && emptyFilterResult"
          :model-value="true"
          inline
          transition
          class="!bg-opacity-15"
          data-testid="nc-base-list-loading"
        >
          <div class="flex flex-col items-center justify-center h-full w-full">
            <a-spin size="large" />
          </div>
        </GeneralOverlay>

        <!-- Empty State -->
        <div
          v-else-if="emptyFilterResult"
          class="flex flex-col items-center justify-center h-full text-nc-content-gray-muted"
        >
          <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('activity.noBases')" />
        </div>

        <!-- No Search Results -->
        <div
          v-else-if="hasNoSearchResults"
          class="h-full px-2 py-6 text-nc-content-gray-muted flex flex-col items-center justify-center gap-6 text-center"
        >
          <img
            src="~assets/img/placeholder/no-search-result-found.png"
            class="!w-[164px] flex-none"
            alt="No search results found"
          />
          {{ $t('title.noResultsMatchedYourSearch') }}
        </div>
      </div>
    </div>

    <!-- Dialogs -->
    <DlgBaseDuplicate v-if="dialogState.duplicate.base" v-model="dialogState.duplicate.isOpen" :base="dialogState.duplicate.base" />
    <DlgBaseDelete
      v-if="dialogState.delete.base"
      v-model:visible="dialogState.delete.isOpen"
      :base-id="dialogState.delete.base?.id"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-filter-pill {
  @apply flex items-center gap-1.5 px-2.5 py-1 rounded-full
    bg-primary-selected text-nc-content-brand border-1 border-primary/20
    text-bodyDefaultSm font-medium;
}

.nc-filter-pill-close {
  @apply opacity-70 hover:opacity-100 transition-opacity;
}
</style>
