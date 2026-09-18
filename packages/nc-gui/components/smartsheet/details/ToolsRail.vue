<script lang="ts" setup>
import type { PlanFeatureTypes, TableType } from 'nocodb-sdk'
import type { ViewPageType } from '~/lib/types'

export interface ToolRailItem {
  slug: ViewPageType
  icon: string
  title: string
  // When set, the row shows a plan-upgrade lock badge while the feature is blocked.
  feature?: PlanFeatureTypes
}

export interface ToolRailGroup {
  label: string
  items: ToolRailItem[]
}

interface Props {
  groups: ToolRailGroup[]
  active: ViewPageType
  // The table being configured — shown at the top of the rail so the modal
  // always states which table's tools these are.
  table?: TableType
}

const props = defineProps<Props>()

const emits = defineEmits<{
  select: [slug: ViewPageType]
}>()

const { isEEFeatureBlocked } = useEeConfig()

const search = ref('')

// Tools whose title matches the query; empty groups fall away with their headers.
const filteredGroups = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return props.groups

  return props.groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.title.toLowerCase().includes(query)) }))
    .filter((group) => group.items.length)
})

const hasMatches = computed(() => filteredGroups.value.some((group) => group.items.length))

const onSelect = (slug: ViewPageType) => {
  emits('select', slug)
}

// Enter jumps to the first match, so a search can be driven from the keyboard alone.
const onSearchEnter = () => {
  const first = filteredGroups.value[0]?.items[0]
  if (first) onSelect(first.slug)
}
</script>

<template>
  <div
    class="nc-tools-rail flex-none w-61 flex flex-col bg-nc-bg-gray-extralight border-r-1 border-nc-border-gray-medium"
    data-testid="nc-tools-rail"
  >
    <div class="flex-1 overflow-y-auto nc-scrollbar-thin px-3 pt-5 pb-4">
      <div v-if="table" class="nc-tools-rail-table" data-testid="nc-tools-rail-table">
        <GeneralTableIcon :meta="table" class="!h-4 !w-4 flex-none text-nc-content-gray-subtle2" />
        <NcTooltip show-on-truncate-only class="truncate">{{ table.title }}</NcTooltip>
      </div>

      <a-input
        v-model:value="search"
        class="nc-tools-rail-search !h-8 !rounded-lg mb-3"
        :placeholder="$t('placeholder.searchTools')"
        allow-clear
        data-testid="nc-tools-rail-search"
        @keydown.enter.prevent="onSearchEnter"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mx-1 h-3.5 w-3.5 text-nc-content-gray-muted" />
        </template>
      </a-input>

      <div v-if="!hasMatches" class="px-2.5 py-2 text-bodyDefaultSm text-nc-content-gray-muted">
        {{ $t('labels.noResults') }}
      </div>

      <template v-for="group in filteredGroups" :key="group.label">
        <div
          v-if="group.items.length"
          class="px-2 pt-2.5 pb-1.5 text-[10px] font-bold tracking-wide text-nc-content-gray-muted uppercase"
        >
          {{ group.label }}
        </div>
        <div
          v-for="item in group.items"
          :key="item.slug"
          v-e="[`c:table:tools-shell:${item.slug}`]"
          class="nc-tools-rail-item"
          :class="{ 'nc-tools-rail-item-active': active === item.slug }"
          :data-testid="`nc-tools-rail-item-${item.slug}`"
          @click="onSelect(item.slug)"
        >
          <GeneralIcon
            :icon="item.icon"
            class="!h-4 !w-4 flex-none"
            :class="active === item.slug ? 'text-nc-content-brand' : 'text-nc-content-gray-subtle2'"
          />
          <span class="truncate flex-1">{{ item.title }}</span>
          <LazyPaymentUpgradeBadge
            v-if="item.feature"
            :feature="item.feature"
            :feature-enabled-callback="() => !isEEFeatureBlocked"
            remove-click
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-tools-rail-table {
  @apply flex items-center gap-2 px-2.5 h-7 mb-3 text-base font-semibold text-nc-content-gray-extreme;
}

.nc-tools-rail-item {
  @apply flex items-center gap-2.5 px-2.5 py-2 mb-0.5 rounded-lg text-bodyDefaultSm font-normal text-nc-content-gray-emphasis cursor-pointer;

  &:hover {
    @apply bg-nc-bg-gray-light;
  }
}

.nc-tools-rail-item-active {
  @apply bg-nc-bg-brand text-nc-content-brand font-medium;

  &:hover {
    @apply bg-nc-bg-brand;
  }
}
</style>
