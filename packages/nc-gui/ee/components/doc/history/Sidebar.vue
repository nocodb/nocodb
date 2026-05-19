<script setup lang="ts">
import { DocRevisionSource } from 'nocodb-sdk'
import type { DocRevisionListItem } from '~/composables/useDocRevisions'

interface Props {
  docId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'previewRevision', revisionId: string | null): void
}>()

const { docId } = toRefs(props)

const { isMobileMode } = useGlobal()

const {
  revisions,
  isLoading,
  hasMore,
  selectedRevisionId,
  loadRevisions,
  loadMore,
  selectRevision,
} = useDocRevisions()

onMounted(() => {
  loadRevisions(docId.value)
})

watch(docId, (next) => {
  if (next) loadRevisions(next)
})

// Group revisions by day for "Today / Yesterday / Mon, May 12" headers.
const dayGrouped = computed(() => {
  const groups = new Map<string, DocRevisionListItem[]>()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 24 * 60 * 60 * 1000

  for (const rev of revisions.value) {
    const d = new Date(rev.created_at)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    let label: string
    if (dayStart === today) label = 'Today'
    else if (dayStart === yesterday) label = 'Yesterday'
    else
      label = d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })

    const arr = groups.get(label) ?? []
    arr.push(rev)
    groups.set(label, arr)
  }
  return Array.from(groups.entries())
})

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function sourceLabel(source: DocRevisionSource): string {
  if (source === DocRevisionSource.RESTORE) return 'restored'
  if (source === DocRevisionSource.MANUAL) return 'saved'
  return 'edited'
}

function onSelect(rev: DocRevisionListItem, isCurrent: boolean) {
  if (isCurrent) {
    selectRevision(null)
    emit('previewRevision', null)
    return
  }
  selectRevision(rev.id)
  emit('previewRevision', rev.id)
}
</script>

<template>
  <div
    class="nc-doc-history-sidebar flex flex-col border-l-1 border-nc-border-gray-medium bg-nc-bg-default overflow-hidden"
    data-testid="nc-doc-history-sidebar"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between sm:h-[var(--topbar-height)] px-3 py-2.5 border-b-1 border-nc-border-gray-medium flex-none"
    >
      <span class="font-semibold text-sm text-nc-content-gray">{{ $t('labels.history') }}</span>
      <NcButton
        v-if="!isMobileMode"
        size="xsmall"
        type="text"
        data-testid="nc-doc-history-close-btn"
        @click="emit('close')"
      >
        <GeneralIcon icon="close" />
      </NcButton>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && !revisions.length" class="flex flex-col items-center justify-center flex-1">
      <GeneralLoader size="xlarge" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="!revisions.length"
      class="flex flex-col items-center justify-center flex-1 px-6 text-center"
    >
      <GeneralIcon icon="ncHistory" class="text-nc-content-gray-muted w-8 h-8 mb-2" />
      <span class="text-sm text-nc-content-gray-subtle">No revisions yet</span>
      <span class="text-xs text-nc-content-gray-muted mt-1">
        Edits will appear here once you save the document.
      </span>
    </div>

    <!-- List -->
    <div v-else class="flex-1 overflow-y-auto px-1.5 py-2">
      <div v-for="[dayLabel, items] in dayGrouped" :key="dayLabel" class="mb-3">
        <div class="px-2 py-1 text-xs text-nc-content-gray-subtle font-medium">{{ dayLabel }}</div>
        <div
          v-for="(rev, idx) in items"
          :key="rev.id"
          class="nc-doc-history-item flex items-start gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-nc-bg-gray-light"
          :class="{
            'bg-nc-bg-brand': selectedRevisionId === rev.id,
            'nc-doc-history-current': dayLabel === dayGrouped[0]?.[0] && idx === 0 && !selectedRevisionId,
          }"
          :data-testid="`nc-doc-history-item-${rev.id}`"
          @click="onSelect(rev, dayLabel === dayGrouped[0]?.[0] && idx === 0 && !selectedRevisionId)"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1 text-sm text-nc-content-gray">
              <span class="font-medium truncate">
                {{ rev.created_by_display_name ?? rev.created_by_email ?? 'Someone' }}
              </span>
              <span class="text-nc-content-gray-subtle">{{ sourceLabel(rev.source) }}</span>
            </div>
            <div class="text-xs text-nc-content-gray-subtle mt-0.5">
              {{ formatTime(rev.created_at) }}
            </div>
          </div>
        </div>
      </div>

      <NcButton
        v-if="hasMore"
        size="small"
        type="text"
        class="w-full mt-2"
        :loading="isLoading"
        @click="loadMore"
      >
        Load older
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-history-sidebar {
  width: 360px;
  flex: 0 0 360px;
}
</style>
