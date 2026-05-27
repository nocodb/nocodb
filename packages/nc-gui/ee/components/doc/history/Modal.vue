<script setup lang="ts">
import { DocRevisionSource } from 'nocodb-sdk'

interface Props {
  visible: boolean
  docId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const {
  selectedRevisionId,
  selectedRevisionContent,
  isLoadingSelected,
  isRestoring,
  comparisonContent,
  comparisonTitle,
  diffChangeCount,
  currentChangeIndex,
  revisions,
  restoreRevision,
  nextChange,
  prevChange,
  reset,
  retentionDays,
} = useDocRevisions()

const { t } = useI18n()

// Banner copy for the retention window. `null` retentionDays means
// unlimited (Enterprise / certain on-prem tiers) — render nothing.
const retentionLabel = computed(() => {
  if (retentionDays.value === null) return ''
  return t('labels.docHistory.retention', { count: retentionDays.value }, retentionDays.value)
})

interface TitleSeg {
  type: 'eq' | 'ins' | 'del'
  text: string
}

// Word-level LCS diff. Whitespace is preserved as its own token so renames
// like "Foo Bar" → "Foo" don't leave an orphaned space behind. Adjacent
// segments of the same type are coalesced into a single span so the
// insert / strikethrough decorations render continuously across word
// boundaries instead of breaking at every space.
function diffTitleSegments(prev: string, next: string): TitleSeg[] {
  const a = prev.split(/(\s+)/).filter((t) => t !== '')
  const b = next.split(/(\s+)/).filter((t) => t !== '')
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const raw: TitleSeg[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ type: 'eq', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: 'del', text: a[i] })
      i++
    } else {
      raw.push({ type: 'ins', text: b[j] })
      j++
    }
  }
  while (i < n) raw.push({ type: 'del', text: a[i++] })
  while (j < m) raw.push({ type: 'ins', text: b[j++] })

  // Coalesce runs. Also fold whitespace-only `eq` tokens that sit between
  // two same-type non-eq tokens into that surrounding type — keeps strike
  // / highlight continuous when only the inner words changed.
  const out: TitleSeg[] = []
  for (let k = 0; k < raw.length; k++) {
    const seg = raw[k]
    const isWhitespaceEq = seg.type === 'eq' && /^\s+$/.test(seg.text)
    const prev = out[out.length - 1]
    const nextSeg = raw[k + 1]
    if (isWhitespaceEq && prev && nextSeg && prev.type !== 'eq' && prev.type === nextSeg.type) {
      prev.text += seg.text
      continue
    }
    if (prev && prev.type === seg.type) {
      prev.text += seg.text
    } else {
      out.push({ ...seg })
    }
  }
  return out
}

// Header metadata for the viewer pane. Mirrors the doc-editor's title strip:
// title prominently, then a subtle line with "Current version · Author" or
// "Edited/Restored by Author on <date>".
const headerTitle = computed(() => selectedRevisionContent.value?.title || t('general.untitled'))

// When the prior revision's title differs from the selected revision's title,
// surface the rename inline so the user can see what changed at this step
// (parity with the body diff orientation: prior → selected).
const titleSegments = computed<TitleSeg[]>(() => {
  const prev = comparisonTitle.value
  const next = headerTitle.value
  if (!prev || prev === next) return [{ type: 'eq', text: next }]
  return diffTitleSegments(prev, next)
})

const headerSubtitle = computed(() => {
  const rev = selectedRevisionContent.value
  if (!rev) return ''
  const author = rev.created_by_display_name ?? rev.created_by_email ?? t('general.unknown')
  const isCurrent = revisions.value[0]?.id === rev.id
  if (isCurrent) return t('labels.docHistory.currentVersion', { author })

  const when = rev.created_at
    ? new Date(rev.created_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : ''
  const key =
    rev.source === DocRevisionSource.RESTORE
      ? 'labels.docHistory.savedBy.restored'
      : rev.source === DocRevisionSource.MANUAL
      ? 'labels.docHistory.savedBy.saved'
      : 'labels.docHistory.savedBy.edited'
  return t(key, { author, when })
})

const hasChanges = computed(() => diffChangeCount.value > 0)

const canPrev = computed(() => hasChanges.value && currentChangeIndex.value > 0)
const canNext = computed(() => hasChanges.value && currentChangeIndex.value < diffChangeCount.value - 1)

const changeLabel = computed(() => {
  if (!hasChanges.value) return ''
  return `${currentChangeIndex.value + 1} / ${diffChangeCount.value}`
})

const { isUIAllowed } = useRoles()
const { showWarningModal } = useNcConfirmModal()

const canRestore = computed(() => isUIAllowed('documentRevisionRestore'))

// Disable Restore when the selected revision IS the current version (the
// topmost row in the list). Restoring to the current version is a no-op for
// the user — it would only create a redundant RESTORE entry pointing at the
// same content. The "Current version" label already signals this to readers;
// the disabled button removes any ambiguity about whether the action does
// anything.
const isSelectedCurrentVersion = computed(() => !!selectedRevisionId.value && selectedRevisionId.value === revisions.value[0]?.id)

const previewContent = computed(() => selectedRevisionContent.value?.content ?? null)

// Reset the composable's state when the modal closes — without this, the
// next open would briefly flash the stale revision before the list refetches.
watch(
  () => props.visible,
  (visible) => {
    if (!visible) reset()
  },
)

function onClose() {
  emit('update:visible', false)
}

async function onRestore() {
  if (!selectedRevisionId.value) return
  showWarningModal({
    title: t('labels.docHistory.restoreConfirmTitle'),
    content: t('labels.docHistory.restoreConfirmContent'),
    okText: t('general.restore'),
    showCancelBtn: true,
    okCallback: async () => {
      const id = selectedRevisionId.value
      if (!id) return
      const ok = await restoreRevision(id)
      if (ok) {
        message.toast(t('labels.docHistory.restored'))
        emit('update:visible', false)
      }
    },
  })
}
</script>

<template>
  <NcModal
    :visible="props.visible"
    size="xl"
    :show-separator="false"
    nc-modal-class-name="!p-0"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    @cancel="onClose"
  >
    <!-- Two panes inside the modal body, no shared header bar. Each pane
         carries its own chrome — the LEFT pane is just the doc preview
         (which provides its own title), the RIGHT pane has its own
         "Version history" header and footer with action buttons. -->
    <div class="nc-doc-history-body flex h-full overflow-hidden" data-testid="nc-doc-history-modal">
      <!-- Viewer pane. Body is constrained to the live doc-editor's
           comfortable reading width (772px) and centred — matches what the
           user sees outside history mode. -->
      <div class="flex-1 overflow-y-auto bg-nc-bg-default">
        <div v-if="isLoadingSelected" class="flex items-center justify-center min-h-[400px]">
          <GeneralLoader size="xlarge" />
        </div>
        <div
          v-else-if="!selectedRevisionContent"
          class="flex flex-col items-center justify-center h-full min-h-[400px] px-6 text-center"
        >
          <div class="flex items-center justify-center w-14 h-14 rounded-full bg-nc-bg-gray-light mb-4">
            <GeneralIcon icon="ncHistory" class="text-nc-content-gray-subtle w-7 h-7" />
          </div>
          <span class="text-base font-medium text-nc-content-gray">{{ $t('labels.docHistory.previewEmptyTitle') }}</span>
          <span class="text-sm text-nc-content-gray-muted mt-2 leading-relaxed max-w-[380px]">
            {{ $t('labels.docHistory.previewEmptySubtitle') }}
          </span>
        </div>
        <div v-else class="max-w-[772px] mx-auto px-10 py-8">
          <!-- Document header — title + meta about the previewed version.
               If the title was renamed at this revision, render the diff
               inline using the same insert/delete classes as the body. -->
          <div class="mb-6">
            <h1 class="nc-doc-history-title text-3xl font-semibold text-nc-content-gray leading-tight m-0">
              <template v-for="(seg, i) in titleSegments" :key="i">
                <span v-if="seg.type === 'ins'" class="nc-doc-history-diff-insert">{{ seg.text }}</span>
                <span v-else-if="seg.type === 'del'" class="nc-doc-history-diff-delete">{{ seg.text }}</span>
                <template v-else>{{ seg.text }}</template>
              </template>
            </h1>
            <div class="text-sm text-nc-content-gray-muted mt-2">{{ headerSubtitle }}</div>
          </div>
          <DocHistoryViewer :content="previewContent" :comparison-content="comparisonContent" :highlight-changes="true" />
        </div>
      </div>

      <!-- Right pane: header → list → footer (column).
           Hard vertical divider separates this pane from the editor. -->
      <div class="nc-doc-history-pane w-80 flex-none flex flex-col border-l-1 border-nc-border-gray-medium bg-nc-bg-default">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b-1 border-nc-border-gray-medium flex-none">
          <span class="font-semibold text-base text-nc-content-gray">{{ $t('labels.docHistory.title') }}</span>
          <NcButton size="xsmall" type="text" data-testid="nc-doc-history-close-btn" @click="onClose">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>

        <!-- Plan-retention banner. Suppressed when retention is unlimited.
             Sits between the header and the list so users see it before
             scanning for an older revision that may have been pruned. -->
        <div
          v-if="retentionLabel"
          class="px-4 py-2 text-xs text-nc-content-gray-muted bg-nc-bg-gray-light border-b-1 border-nc-border-gray-medium flex-none"
          data-testid="nc-doc-history-retention-banner"
        >
          {{ retentionLabel }}
        </div>

        <!-- List (scrollable middle) -->
        <div class="flex-1 overflow-hidden">
          <DocHistoryList v-if="props.visible" :doc-id="props.docId" />
        </div>

        <!-- Footer with Restore + change navigation. -->
        <div class="flex items-center justify-between px-3 py-2.5 border-t-1 border-nc-border-gray-medium flex-none gap-2">
          <div
            v-if="hasChanges"
            class="flex items-center gap-1 text-xs text-nc-content-gray-subtle"
            data-testid="nc-doc-history-change-nav"
          >
            <NcButton size="xsmall" type="text" :disabled="!canPrev" data-testid="nc-doc-history-prev-change" @click="prevChange">
              <GeneralIcon icon="ncArrowUp" />
            </NcButton>
            <span class="tabular-nums">{{ changeLabel }}</span>
            <NcButton size="xsmall" type="text" :disabled="!canNext" data-testid="nc-doc-history-next-change" @click="nextChange">
              <GeneralIcon icon="ncArrowDown" />
            </NcButton>
          </div>
          <span v-else />

          <NcButton
            v-if="canRestore"
            v-e="['c:doc:history:restore']"
            size="small"
            type="primary"
            :loading="isRestoring"
            :disabled="!selectedRevisionId || isSelectedCurrentVersion"
            class="!px-5"
            data-testid="nc-doc-history-restore-btn"
            @click="onRestore"
          >
            {{ $t('general.restore') }}
          </NcButton>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
// Title-level diff treatment — mirrors the body-diff colours from Viewer.vue
// so a rename reads with the same visual language as content insertions and
// deletions. Padding is slightly looser to suit the 30px title type.
.nc-doc-history-title {
  .nc-doc-history-diff-insert {
    background-color: rgba(34, 197, 94, 0.18);
    border-radius: 3px;
    padding: 0 4px;
  }

  .nc-doc-history-diff-delete {
    background-color: rgba(239, 68, 68, 0.08);
    color: var(--nc-content-gray-muted);
    text-decoration: line-through;
    text-decoration-color: var(--nc-content-gray-disabled);
    border-radius: 3px;
    padding: 0 4px;
  }
}
</style>
