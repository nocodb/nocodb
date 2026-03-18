<script setup lang="ts">
import { useStorage } from '@vueuse/core'

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const basesStore = useBases()

const { basesList } = storeToRefs(basesStore)

const searchQuery = ref('')

const viewMode = useStorage<'grid' | 'list'>('nc-ws-home-view-mode', 'grid')

const filterMode = ref<'all' | 'starred'>('all')

// localStorage-based "last opened" tracking
const lastOpenedMap = useStorage<Record<string, number>>('nc-base-last-opened', {})

const trackBaseOpened = (baseId: string) => {
  lastOpenedMap.value[baseId] = Date.now()
}

const getLastOpened = (baseId: string): number => {
  return lastOpenedMap.value[baseId] || 0
}

const filteredBases = computed(() => {
  let result = basesList.value

  if (filterMode.value === 'starred') {
    result = result.filter((b: any) => b.starred)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter((b: any) => b.title?.toLowerCase().includes(q))
  }

  // Sort by last opened (most recent first), fallback to updated_at
  return [...result].sort((a, b) => {
    const aTime = getLastOpened(a.id!) || new Date(a.updated_at || 0).getTime()
    const bTime = getLastOpened(b.id!) || new Date(b.updated_at || 0).getTime()
    return bTime - aTime
  })
})

// Group bases by time period
const now = Date.now()
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

const groupedBases = computed(() => {
  const groups: { label: string; bases: any[] }[] = []
  const past7: any[] = []
  const past30: any[] = []
  const earlier: any[] = []

  for (const base of filteredBases.value) {
    const lastTime = getLastOpened(base.id!) || new Date(base.updated_at || 0).getTime()
    const diff = now - lastTime

    if (diff <= SEVEN_DAYS) {
      past7.push(base)
    } else if (diff <= THIRTY_DAYS) {
      past30.push(base)
    } else {
      earlier.push(base)
    }
  }

  if (past7.length) groups.push({ label: t('labels.past7Days'), bases: past7 })
  if (past30.length) groups.push({ label: t('labels.past30Days'), bases: past30 })
  if (earlier.length) groups.push({ label: t('labels.earlier'), bases: earlier })

  // If no time groups (e.g. all bases have no timestamps), show all in one group
  if (!groups.length && filteredBases.value.length) {
    groups.push({ label: '', bases: filteredBases.value })
  }

  return groups
})

const openBase = (base: any) => {
  trackBaseOpened(base.id!)
  basesStore.navigateToProject({
    workspaceId: base.fk_workspace_id!,
    baseId: base.id!,
  })
}

const onToggleStar = async (base: NcProject, e: Event) => {
  e.stopPropagation()
  await basesStore.toggleStarred(base.id!)
}

const getBaseOpenedTimeAgo = (base: any): string => {
  const lastTime = getLastOpened(base.id!)
  if (lastTime) {
    return timeAgo(new Date(lastTime).toISOString())
  }
  if (base.updated_at) {
    return timeAgo(base.updated_at)
  }
  return ''
}
</script>

<template>
  <div class="h-full flex flex-col overflow-auto nc-workspace-home bg-nc-bg-default">
    <!-- Top bar with search -->
    <div class="flex items-center justify-between px-6 py-3 h-[var(--topbar-height)] border-b-1 border-nc-border-gray-medium flex-none">
      <div class="flex items-center gap-2">
        <GeneralOpenLeftSidebarBtn />
        <span class="text-sm font-semibold text-nc-content-gray capitalize truncate">
          {{ activeWorkspace?.title }}
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto nc-scrollbar-thin">
      <div class="max-w-[1200px] mx-auto w-full px-8 py-6">
        <!-- "Your bases" header -->
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-semibold text-nc-content-gray">
              {{ t('labels.yourBases') }}
            </h2>

            <!-- Filter dropdown -->
            <NcDropdown>
              <NcButton type="secondary" size="small">
                <div class="flex items-center gap-1.5">
                  <GeneralIcon icon="list" class="h-3.5 w-3.5" />
                  <span class="text-xs">{{ filterMode === 'starred' ? $t('general.starred') : $t('activity.allBases') }}</span>
                  <GeneralIcon icon="chevronDown" class="h-3 w-3" />
                </div>
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem @click="filterMode = 'all'">
                    <div class="flex items-center gap-2">
                      <GeneralIcon v-if="filterMode === 'all'" icon="check" class="h-4 w-4 text-primary" />
                      <span :class="{ 'pl-6': filterMode !== 'all' }">{{ $t('activity.allBases') }}</span>
                    </div>
                  </NcMenuItem>
                  <NcMenuItem @click="filterMode = 'starred'">
                    <div class="flex items-center gap-2">
                      <GeneralIcon v-if="filterMode === 'starred'" icon="check" class="h-4 w-4 text-primary" />
                      <span :class="{ 'pl-6': filterMode !== 'starred' }">{{ $t('general.starred') }}</span>
                    </div>
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>

          <div class="flex items-center gap-2">
            <!-- Search -->
            <a-input
              v-model:value="searchQuery"
              :placeholder="$t('placeholder.searchProjectTree')"
              class="!rounded-lg !h-8 !w-56 !text-xs"
              allow-clear
            >
              <template #prefix>
                <GeneralIcon icon="search" class="h-3.5 w-3.5 text-nc-content-gray-muted" />
              </template>
            </a-input>

            <!-- Grid/List toggle -->
            <div class="flex items-center border-1 border-nc-border-gray-medium rounded-lg overflow-hidden">
              <NcButton
                type="text"
                size="xxsmall"
                class="!rounded-none !px-1.5"
                :class="{ '!bg-nc-bg-gray-medium': viewMode === 'grid' }"
                @click="viewMode = 'grid'"
              >
                <GeneralIcon icon="grid" class="h-4 w-4" />
              </NcButton>
              <NcButton
                type="text"
                size="xxsmall"
                class="!rounded-none !px-1.5"
                :class="{ '!bg-nc-bg-gray-medium': viewMode === 'list' }"
                @click="viewMode = 'list'"
              >
                <GeneralIcon icon="list" class="h-4 w-4" />
              </NcButton>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!filteredBases.length" class="flex flex-col items-center justify-center py-16 text-nc-content-gray-subtle">
          <GeneralIcon icon="ncSearch" class="h-8 w-8 mb-3 text-nc-content-gray-muted" />
          <span v-if="searchQuery" class="text-sm">{{ $t('placeholder.noResultsFoundForYourSearch') }}</span>
          <span v-else class="text-sm">{{ $t('labels.noData') }}</span>
        </div>

        <!-- Grouped base cards -->
        <template v-else>
          <div v-for="group in groupedBases" :key="group.label" class="mb-6">
            <div v-if="group.label" class="text-xs font-semibold text-nc-content-gray-muted uppercase tracking-wide mb-3">
              {{ group.label }}
            </div>

            <!-- Grid view -->
            <div
              v-if="viewMode === 'grid'"
              class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
            >
              <div
                v-for="base in group.bases"
                :key="base.id"
                class="nc-base-card group flex items-center gap-3 px-4 py-3.5 rounded-xl border-1 border-nc-border-gray-medium bg-nc-bg-default hover:shadow-sm cursor-pointer transition-all"
                :data-testid="`nc-base-card-${base.id}`"
                @click="openBase(base)"
              >
                <GeneralProjectIcon :color="base.meta?.iconColor" class="flex-none" />
                <div class="flex-1 min-w-0">
                  <NcTooltip show-on-truncate-only class="text-sm font-medium text-nc-content-gray truncate block">
                    <template #title>{{ base.title }}</template>
                    {{ base.title }}
                  </NcTooltip>
                  <div class="text-xs text-nc-content-gray-muted mt-0.5">
                    {{ getBaseOpenedTimeAgo(base) }}
                  </div>
                </div>
                <GeneralIcon
                  :icon="base.starred ? 'star' : 'ncStar'"
                  class="flex-none h-4 w-4 transition-opacity"
                  :class="{
                    'text-yellow-500': base.starred,
                    'text-nc-content-gray-muted opacity-0 group-hover:opacity-100': !base.starred,
                  }"
                  @click="onToggleStar(base, $event)"
                />
              </div>
            </div>

            <!-- List view -->
            <div v-else class="flex flex-col gap-0.5">
              <div
                v-for="base in group.bases"
                :key="base.id"
                class="nc-base-list-row group flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-nc-bg-gray-light cursor-pointer transition-colors"
                :data-testid="`nc-base-list-${base.id}`"
                @click="openBase(base)"
              >
                <GeneralProjectIcon :color="base.meta?.iconColor" class="flex-none" />
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-medium text-nc-content-gray truncate">
                    {{ base.title }}
                  </span>
                </div>
                <span class="text-xs text-nc-content-gray-muted flex-none">
                  {{ getBaseOpenedTimeAgo(base) }}
                </span>
                <GeneralIcon
                  :icon="base.starred ? 'star' : 'ncStar'"
                  class="flex-none h-4 w-4 transition-opacity"
                  :class="{
                    'text-yellow-500': base.starred,
                    'text-nc-content-gray-muted opacity-0 group-hover:opacity-100': !base.starred,
                  }"
                  @click="onToggleStar(base, $event)"
                />
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-base-card {
  &:hover {
    @apply border-nc-border-gray-dark;
  }
}
</style>
