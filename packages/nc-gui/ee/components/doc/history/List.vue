<script setup lang="ts">
import { DocRevisionSource } from 'nocodb-sdk'
import type { DocRevisionListItem } from '~/composables/useDocRevisions'

interface Props {
  docId: string
}

const props = defineProps<Props>()

const { docId } = toRefs(props)

const {
  revisions,
  isLoading,
  hasMore,
  selectedRevisionId,
  loadRevisions,
  loadMore,
  selectRevision,
} = useDocRevisions()

// On mount / docId change: load revisions and auto-select the most recent
// one so the viewer pane lands in a useful state immediately.
async function loadAndAutoSelect(id: string) {
  await loadRevisions(id)
  if (!selectedRevisionId.value && revisions.value[0]) {
    selectRevision(revisions.value[0].id)
  }
}

onMounted(() => {
  loadAndAutoSelect(docId.value)
})

watch(docId, (next) => {
  if (next) loadAndAutoSelect(next)
})

// Format like "May 19th, 7:10 AM" — matches the Outline reference. We avoid
// pulling a date-fns dependency: vanilla Intl handles the time, and the
// ordinal day suffix is one tiny helper.
function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const month = d.toLocaleString(undefined, { month: 'long' })
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${month} ${ordinal(d.getDate())}, ${time}`
}

function sourceVerb(source: DocRevisionSource): string {
  if (source === DocRevisionSource.RESTORE) return 'restored'
  if (source === DocRevisionSource.MANUAL) return 'saved'
  return 'edited'
}

function userTile(rev: DocRevisionListItem) {
  return {
    id: rev.created_by,
    email: rev.created_by_email,
    display_name: rev.created_by_display_name,
    meta: rev.created_by_meta ?? null,
  }
}

function authorLabel(rev: DocRevisionListItem): string {
  return rev.created_by_display_name ?? rev.created_by_email ?? 'Someone'
}

function onSelect(rev: DocRevisionListItem) {
  selectRevision(rev.id)
}
</script>

<template>
  <div class="nc-doc-history-list flex flex-col h-full overflow-hidden" data-testid="nc-doc-history-list">
    <!-- Loading -->
    <div v-if="isLoading && !revisions.length" class="flex flex-col items-center justify-center flex-1">
      <GeneralLoader size="xlarge" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="!revisions.length"
      class="flex flex-col items-center justify-center flex-1 px-6 text-center"
    >
      <div
        class="flex items-center justify-center w-12 h-12 rounded-full bg-nc-bg-gray-light mb-3"
      >
        <GeneralIcon icon="ncHistory" class="text-nc-content-gray-subtle w-6 h-6" />
      </div>
      <span class="text-sm font-medium text-nc-content-gray">No versions saved yet</span>
      <span class="text-xs text-nc-content-gray-muted mt-1.5 leading-relaxed max-w-[240px]">
        A version is recorded each time the page is saved. Saves made within 2 minutes by the same author are merged into one.
      </span>
    </div>

    <!-- List — flat, no day-group headers. The topmost row is the current
         version (most recent revision); every other row is a prior edit. -->
    <div v-else class="flex-1 overflow-y-auto px-3 py-3">
      <div
        v-for="(rev, idx) in revisions"
        :key="rev.id"
        class="nc-doc-history-row"
        :class="{
          'nc-doc-history-row-active': selectedRevisionId === rev.id,
          'nc-doc-history-row-first-in-day': idx === 0,
          'nc-doc-history-row-last-in-day': idx === revisions.length - 1,
        }"
        :data-testid="`nc-doc-history-item-${rev.id}`"
        @click="onSelect(rev)"
      >
        <div class="nc-doc-history-avatar">
          <GeneralUserIcon size="medium" :user="userTile(rev)" />
        </div>
        <div class="nc-doc-history-content">
          <div class="text-xs font-medium text-nc-content-gray">{{ formatTimestamp(rev.created_at) }}</div>
          <div class="text-xs text-nc-content-gray-muted mt-0.5">
            <template v-if="idx === 0">
              Current version · {{ authorLabel(rev) }}
            </template>
            <template v-else>
              {{ authorLabel(rev) }} {{ sourceVerb(rev.source) }}
            </template>
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
.nc-doc-history-list {
  width: 100%;
}

.nc-doc-history-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 8px 8px 10px;
  margin-left: 4px; // align the timeline line with the avatar centre
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.12s ease;

  // Two-piece timeline connector: a top half (row top → avatar centre) and a
  // bottom half (avatar centre → row bottom). Splitting them lets us hide
  // each side independently for the first / last row in a day — and the
  // single-item-day case (both hidden) falls out for free.
  // The line sits at avatar centre x = 10px (row padding-left) + 12px
  // (half of the 24px medium avatar) = 22px from the row's padding edge.
  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 22px;
    width: 1px;
    background: var(--nc-border-gray-medium);
    z-index: 0;
  }

  // Avatar centre y = 8px row padding-top + 5px avatar margin-top + 1px
  // avatar padding + 12px (half of the 24px avatar) = 24px from row top.
  // The `margin-top: 5px` on the avatar pulls it down to align with the
  // cap height of the timestamp text — these offsets follow that shift.
  &::before {
    top: 0;
    height: 24px;
  }

  &::after {
    top: 24px;
    bottom: 0;
  }

  &.nc-doc-history-row-first-in-day::before { display: none; }
  &.nc-doc-history-row-last-in-day::after { display: none; }

  &:hover {
    background-color: var(--nc-bg-gray-light);
  }

  &.nc-doc-history-row-active {
    background-color: var(--nc-bg-brand-light, rgba(59, 130, 246, 0.08));
  }
}

.nc-doc-history-avatar {
  position: relative;
  z-index: 1; // sit on top of the timeline line
  background: var(--nc-bg-default);
  border-radius: 50%;
  padding: 1px;
  flex: 0 0 auto;
  // Drop the avatar so its top edge aligns with the cap height of the
  // timestamp text on the same row (text-sm @ ~1.5 line-height leaves
  // ~5px of leading above the cap). Without this, the avatar visually
  // floats above the text baseline.
  margin-top: 5px;
}

.nc-doc-history-content {
  min-width: 0;
  flex: 1;
}
</style>
