<script setup lang="ts">
import dayjs from 'dayjs'

interface ChangelogEntry {
  id: string
  event: string
  entity_title?: string
  parent_entity_title?: string
  description?: string
  created_by: string
  created_at: string
  merged_at?: string | null
}

interface UserInfo {
  display_name: string
  email: string
  avatar: string | null
}

interface Props {
  isLoading: boolean
  changelog: ChangelogEntry[]
  users: Record<string, UserInfo>
  isMerging: boolean
  mergeStatus: 'idle' | 'loading' | 'success' | 'error'
  mergeError?: string
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  changelog: () => [],
  users: () => ({}),
  isMerging: false,
  mergeStatus: 'idle',
  mergeError: '',
})

const emit = defineEmits<{
  apply: []
  close: []
  refresh: []
}>()

const { t } = useI18n()

const sortOrder = ref<'newest' | 'oldest'>('newest')
const expandedEntries = ref<Set<string>>(new Set())

const sortedChangelog = computed(() => {
  const entries = [...props.changelog]
  return sortOrder.value === 'newest' ? entries.reverse() : entries
})

const groupedChangelog = computed(() => {
  const groups: { label: string; entries: ChangelogEntry[] }[] = []
  const groupMap = new Map<string, ChangelogEntry[]>()

  for (const entry of sortedChangelog.value) {
    const d = dayjs(entry.created_at)
    const now = dayjs()
    let label: string

    if (d.isSame(now, 'day')) {
      label = t('labels.today')
    } else if (d.isSame(now.subtract(1, 'day'), 'day')) {
      label = t('labels.yesterday')
    } else if (d.isSame(now, 'week')) {
      label = d.format('dddd')
    } else if (d.isSame(now, 'year')) {
      label = d.format('MMM D')
    } else {
      label = d.format('MMM D, YYYY')
    }

    if (!groupMap.has(label)) {
      groupMap.set(label, [])
    }
    groupMap.get(label)!.push(entry)
  }

  for (const [label, entries] of groupMap) {
    groups.push({ label, entries })
  }

  return groups
})

const hasChanges = computed(() => props.changelog.length > 0)

function getUserInfo(userId: string): UserInfo {
  return props.users[userId] ?? { display_name: 'Unknown', email: '', avatar: null }
}

function formatEntryTime(dateStr: string): string {
  const d = dayjs(dateStr)
  return d.format('MMM D, h:mm A')
}

function toggleExpand(entryId: string) {
  if (expandedEntries.value.has(entryId)) {
    expandedEntries.value.delete(entryId)
  } else {
    expandedEntries.value.add(entryId)
  }
}

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
}
</script>

<template>
  <div class="nc-sandbox-changelog-panel flex flex-col h-full">
    <!-- Header -->
    <div
      class="h-[var(--topbar-height)] flex items-center justify-between gap-2 px-3 border-b-1 border-nc-border-gray-medium bg-nc-bg-default flex-none"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-bodyBold text-nc-content-gray truncate">
          {{ t('labels.sandboxChanges') }}
        </span>
        <span v-if="changelog.length > 0" class="nc-changelog-count-badge">
          {{ changelog.length }}
        </span>
      </div>
      <NcButton type="text" size="small" class="nc-sandbox-header-btn" @click="emit('close')">
        <GeneralIcon icon="ncChevronsRight" class="w-4 h-4 text-nc-content-gray-muted" />
      </NcButton>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center py-6">
      <GeneralLoader size="medium" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!hasChanges" class="flex-1 flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <div class="w-12 h-12 rounded-xl bg-nc-bg-gray-light flex items-center justify-center">
        <GeneralIcon icon="ncGitBranch" class="w-6 h-6 text-nc-content-gray-muted" />
      </div>
      <div>
        <div class="text-sm font-medium text-nc-content-gray-subtle mb-0.5">
          {{ t('labels.noSandboxChanges') }}
        </div>
        <div class="text-xs text-nc-content-gray-muted">
          {{ t('labels.sandboxNoChangesHint') }}
        </div>
      </div>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Description banner -->
      <div class="nc-changelog-banner">
        <GeneralIcon icon="ncInfo" class="w-4 h-4 text-nc-content-gray-subtle mt-px flex-none" />
        <span class="text-xs leading-4 text-nc-content-gray-subtle">
          {{ t('labels.sandboxChangesApplyDescription') }}
        </span>
      </div>

      <!-- Toolbar -->
      <div class="nc-changelog-toolbar">
        <NcTooltip :title="t('general.reload')">
          <NcButton type="text" size="xsmall" class="!px-1" @click="emit('refresh')">
            <GeneralIcon icon="ncRefreshCcw" class="w-3.5 h-3.5 text-nc-content-gray-subtle2" />
          </NcButton>
        </NcTooltip>

        <div class="flex-1" />

        <NcTooltip :title="sortOrder === 'newest' ? t('labels.oldestFirst') : t('labels.newestFirst')">
          <NcButton type="text" size="xsmall" class="!px-1" @click="toggleSortOrder">
            <GeneralIcon icon="ncArrowUpDown" class="w-3.5 h-3.5 text-nc-content-gray-subtle2" />
          </NcButton>
        </NcTooltip>
      </div>

      <NcDivider class="!my-0" />

      <!-- Grouped changelog list -->
      <div class="flex-1 overflow-y-auto nc-scrollbar-thin">
        <div v-for="group in groupedChangelog" :key="group.label" class="nc-changelog-group">
          <!-- Group header -->
          <div class="nc-changelog-group-label">
            {{ group.label }}
          </div>

          <!-- Entries -->
          <div
            v-for="entry in group.entries"
            :key="entry.id"
            class="nc-changelog-entry"
            :class="{ 'nc-changelog-entry-expanded': expandedEntries.has(entry.id) }"
            @click="toggleExpand(entry.id)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <GeneralUserIcon :user="getUserInfo(entry.created_by)" size="medium" class="flex-none" />
              <SandboxChangelogEntryText v-if="entry.description" :description="entry.description" />
              <span v-else class="nc-changelog-entry-text">{{ entry.event }}</span>
            </div>

            <!-- Expanded detail -->
            <Transition name="nc-expand">
              <div v-if="expandedEntries.has(entry.id)" class="nc-changelog-entry-detail">
                <div class="nc-changelog-entry-meta">
                  {{ formatEntryTime(entry.created_at) }}
                  <span class="mx-1">&middot;</span>
                  {{ getUserInfo(entry.created_by).display_name }}
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </template>

    <!-- Footer — apply button -->
    <div class="nc-changelog-footer">
      <!-- Merge in progress -->
      <template v-if="mergeStatus === 'loading'">
        <div class="nc-changelog-footer-status">
          <GeneralLoader size="small" />
          <span>{{ t('labels.publishing') }}…</span>
        </div>
      </template>

      <!-- Merge error -->
      <template v-else-if="mergeStatus === 'error'">
        <div class="text-xs text-red-600 mb-2 px-1">{{ mergeError }}</div>
        <NcButton size="small" class="w-full" type="primary" @click="emit('apply')">
          {{ t('labels.tryAgain') }}
        </NcButton>
      </template>

      <!-- Merge success -->
      <template v-else-if="mergeStatus === 'success'">
        <div class="nc-changelog-footer-success">
          <GeneralIcon icon="checkFill" class="w-4 h-4" />
          <span>{{ t('labels.sandboxChangesPublished') }}</span>
        </div>
      </template>

      <!-- Idle -->
      <template v-else>
        <NcTooltip :disabled="hasChanges" placement="top" class="w-full">
          <template #title>{{ t('tooltip.noSchemaChanges') }}</template>
          <NcButton size="small" class="w-full" type="primary" :disabled="!hasChanges || isMerging" @click="emit('apply')">
            <GeneralIcon icon="ncArrowUp" class="w-4 h-4 mr-1.5" />
            {{
              hasChanges
                ? t('labels.applyNChanges', { count: changelog.length }, changelog.length)
                : t('labels.applyChangesToMaster')
            }}
          </NcButton>
        </NcTooltip>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-sandbox-changelog-panel {
  @apply w-full;

  :deep(strong) {
    @apply font-semibold text-nc-content-gray-emphasis;
  }
}

.nc-changelog-count-badge {
  @apply inline-flex items-center justify-center min-w-5 h-5 px-1.5;
  @apply text-[11px] font-semibold rounded-full;
  @apply bg-orange-100 text-orange-600;
}

.nc-sandbox-header-btn {
  @apply !bg-transparent hover:!bg-transparent;

  :deep(svg) {
    @apply w-4 h-4;
    color: var(--nc-content-gray-muted);
    transition: color 150ms ease;
  }

  &:hover :deep(svg) {
    color: var(--nc-content-gray);
  }
}

.nc-changelog-banner {
  @apply flex items-start gap-2 mx-3 my-2.5 px-3 py-2.5 rounded-lg;
  @apply bg-nc-bg-gray-extralight;
}

.nc-changelog-toolbar {
  @apply flex items-center gap-1 px-3 py-1.5;
}

.nc-changelog-group {
  @apply pb-1;
}

.nc-changelog-group-label {
  @apply px-4 pt-3 pb-1.5 text-xs font-medium text-nc-content-gray-muted;
}

.nc-changelog-entry {
  @apply mx-2 px-2 py-2 rounded-lg cursor-pointer;
  @apply transition-all duration-100;

  &:hover:not(.nc-changelog-entry-expanded) {
    @apply bg-nc-bg-gray-light;
  }

  &.nc-changelog-entry-expanded {
    @apply bg-nc-bg-gray-extralight mt-1 mb-1;
    border: 1px solid var(--nc-border-gray-medium);
  }
}

.nc-changelog-entry-text {
  @apply flex-1 min-w-0 text-small leading-5 text-nc-content-gray;
  @apply truncate;

  .nc-changelog-entry-expanded & {
    @apply whitespace-normal;
  }
}

.nc-changelog-entry-detail {
  @apply pl-9 pt-1.5 pb-0.5;
}

.nc-changelog-entry-meta {
  @apply text-xs text-nc-content-gray-muted;
}

.nc-changelog-footer {
  @apply px-3 py-3 border-t-1 border-nc-border-gray-medium;
}

.nc-changelog-footer-status {
  @apply flex items-center justify-center gap-2 py-1 text-xs text-nc-content-gray-subtle;
}

.nc-changelog-footer-success {
  @apply flex items-center justify-center gap-1.5 py-1 text-xs text-green-600;
}

.nc-expand-enter-active,
.nc-expand-leave-active {
  transition: all 150ms ease;
  overflow: hidden;
}

.nc-expand-enter-from,
.nc-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.nc-expand-enter-to,
.nc-expand-leave-from {
  opacity: 1;
  max-height: 100px;
}
</style>
