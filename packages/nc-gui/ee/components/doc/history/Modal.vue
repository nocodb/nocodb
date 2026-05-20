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
  diffChangeCount,
  currentChangeIndex,
  revisions,
  restoreRevision,
  nextChange,
  prevChange,
  reset,
} = useDocRevisions()

// Header metadata for the viewer pane. Mirrors the doc-editor's title strip:
// title prominently, then a subtle line with "Current version · Author" or
// "Edited/Restored by Author on <date>".
const headerTitle = computed(() => selectedRevisionContent.value?.title || 'Untitled')

const headerSubtitle = computed(() => {
  const rev = selectedRevisionContent.value
  if (!rev) return ''
  const author = rev.created_by_display_name ?? rev.created_by_email ?? 'Unknown'
  const isCurrent = revisions.value[0]?.id === rev.id
  if (isCurrent) return `Current version · ${author}`

  const when = rev.created_at
    ? new Date(rev.created_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : ''
  const verb =
    rev.source === DocRevisionSource.RESTORE
      ? 'Restored'
      : rev.source === DocRevisionSource.MANUAL
      ? 'Saved'
      : 'Edited'
  return `${verb} by ${author} · ${when}`
})

const hasChanges = computed(() => diffChangeCount.value > 0)

const canPrev = computed(() => hasChanges.value && currentChangeIndex.value > 0)
const canNext = computed(
  () => hasChanges.value && currentChangeIndex.value < diffChangeCount.value - 1,
)

const changeLabel = computed(() => {
  if (!hasChanges.value) return ''
  return `${currentChangeIndex.value + 1} / ${diffChangeCount.value}`
})

const { isUIAllowed } = useRoles()
const { showWarningModal } = useNcConfirmModal()

const canRestore = computed(() => isUIAllowed('documentRevisionRestore'))

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
    title: 'Restore this version?',
    content: 'Your current version will be saved in history before restoring.',
    okText: 'Restore',
    showCancelBtn: true,
    okCallback: async () => {
      const id = selectedRevisionId.value
      if (!id) return
      const ok = await restoreRevision(id)
      if (ok) {
        message.success('Restored to selected version')
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
    data-testid="nc-doc-history-modal"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    @cancel="onClose"
  >
    <!-- Notion-style: two panes inside the modal body, no shared header bar.
         Each pane carries its own chrome — the LEFT pane is just the doc
         preview (which provides its own title), the RIGHT pane has its own
         "Version history" header and footer with action buttons. -->
    <div class="nc-doc-history-body flex h-full overflow-hidden">
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
          <div
            class="flex items-center justify-center w-14 h-14 rounded-full bg-nc-bg-gray-light mb-4"
          >
            <GeneralIcon icon="ncHistory" class="text-nc-content-gray-subtle w-7 h-7" />
          </div>
          <span class="text-base font-medium text-nc-content-gray">Select a version to preview</span>
          <span class="text-sm text-nc-content-gray-muted mt-2 leading-relaxed max-w-[380px]">
            Pick one from the list on the right to see the page as it was at that point. Changes against the current version are highlighted inline.
          </span>
        </div>
        <div v-else class="max-w-[772px] mx-auto px-10 py-8">
          <!-- Document header — title + meta about the previewed version. -->
          <div class="mb-6">
            <h1 class="text-3xl font-semibold text-nc-content-gray leading-tight m-0">
              {{ headerTitle }}
            </h1>
            <div class="text-sm text-nc-content-gray-muted mt-2">{{ headerSubtitle }}</div>
          </div>
          <DocHistoryViewer
            :content="previewContent"
            :comparison-content="comparisonContent"
            :highlight-changes="true"
          />
        </div>
      </div>

      <!-- Right pane: header → list → footer (column).
           Hard vertical divider separates this pane from the editor. -->
      <div class="nc-doc-history-pane w-80 flex-none flex flex-col border-l-1 border-nc-border-gray-medium bg-nc-bg-default">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b-1 border-nc-border-gray-medium flex-none">
          <span class="font-semibold text-base text-nc-content-gray">Version history</span>
          <NcButton
            size="xsmall"
            type="text"
            data-testid="nc-doc-history-close-btn"
            @click="onClose"
          >
            <GeneralIcon icon="close" />
          </NcButton>
        </div>

        <!-- List (scrollable middle) -->
        <div class="flex-1 overflow-hidden">
          <DocHistoryList v-if="props.visible" :doc-id="props.docId" />
        </div>

        <!-- Footer with Restore + change navigation. -->
        <div
          class="flex items-center justify-between px-3 py-2.5 border-t-1 border-nc-border-gray-medium flex-none gap-2"
        >
          <div
            v-if="hasChanges"
            class="flex items-center gap-1 text-xs text-nc-content-gray-subtle"
            data-testid="nc-doc-history-change-nav"
          >
            <NcButton
              size="xsmall"
              type="text"
              :disabled="!canPrev"
              data-testid="nc-doc-history-prev-change"
              @click="prevChange"
            >
              <GeneralIcon icon="ncArrowUp" />
            </NcButton>
            <span class="tabular-nums">{{ changeLabel }}</span>
            <NcButton
              size="xsmall"
              type="text"
              :disabled="!canNext"
              data-testid="nc-doc-history-next-change"
              @click="nextChange"
            >
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
            :disabled="!selectedRevisionId"
            class="!px-5"
            data-testid="nc-doc-history-restore-btn"
            @click="onRestore"
          >
            Restore
          </NcButton>
        </div>
      </div>
    </div>
  </NcModal>
</template>
