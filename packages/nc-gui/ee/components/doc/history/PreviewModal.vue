<script setup lang="ts">
import { DocRevisionSource } from 'nocodb-sdk'

interface Props {
  visible: boolean
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
  comparisonBasis,
  comparisonContent,
  highlightChanges,
  selectRevision,
  restoreRevision,
  setComparisonBasis,
} = useDocRevisions()

const { isUIAllowed } = useRoles()
const { showWarningModal } = useNcConfirmModal()

const canRestore = computed(() => isUIAllowed('documentRevisionRestore'))

const formattedTimestamp = computed(() => {
  const iso = selectedRevisionContent.value?.created_at
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
})

const author = computed(() => {
  const rev = selectedRevisionContent.value
  return rev?.created_by_display_name ?? rev?.created_by_email ?? 'Unknown'
})

const sourceLabel = computed(() => {
  const src = selectedRevisionContent.value?.source
  if (src === DocRevisionSource.RESTORE) return 'Restored'
  if (src === DocRevisionSource.MANUAL) return 'Saved'
  return 'Auto-saved'
})

const previewContent = computed(() => selectedRevisionContent.value?.content ?? null)

function onClose() {
  emit('update:visible', false)
  selectRevision(null)
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
    size="md"
    :show-separator="false"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    @cancel="onClose"
  >
    <template #header>
      <div class="flex items-center justify-between w-full pr-2 gap-3">
        <div class="flex flex-col min-w-0 flex-1">
          <span class="font-semibold text-base text-nc-content-gray truncate">
            {{ selectedRevisionContent?.title || 'Untitled' }}
          </span>
          <span class="text-xs text-nc-content-gray-subtle mt-0.5">
            {{ sourceLabel }} by {{ author }} · {{ formattedTimestamp }}
          </span>
        </div>
        <div class="flex items-center gap-2 flex-none">
          <!-- Highlight changes toggle -->
          <NcTooltip placement="bottom">
            <template #title>Highlight changes</template>
            <a-switch
              v-model:checked="highlightChanges"
              v-e="['c:doc:history:toggle-highlight', { enabled: highlightChanges }]"
              size="small"
              data-testid="nc-doc-history-highlight-toggle"
            />
          </NcTooltip>
          <!-- Compare-basis selector -->
          <NcSelect
            :value="comparisonBasis"
            size="small"
            class="!w-36"
            :options="[
              { value: 'previous', label: 'vs Previous' },
              { value: 'current', label: 'vs Current' },
            ]"
            data-testid="nc-doc-history-compare-select"
            @change="(v: any) => setComparisonBasis(v)"
          />
          <NcButton
            v-if="canRestore"
            v-e="['c:doc:history:restore']"
            size="small"
            type="primary"
            :loading="isRestoring"
            data-testid="nc-doc-history-restore-btn"
            @click="onRestore"
          >
            <GeneralIcon icon="ncRefreshCw" />
            Restore
          </NcButton>
        </div>
      </div>
    </template>

    <div class="nc-doc-history-preview-body min-h-[400px] max-h-[60vh] overflow-y-auto">
      <div v-if="isLoadingSelected" class="flex items-center justify-center min-h-[400px]">
        <GeneralLoader size="xlarge" />
      </div>
      <div v-else-if="!selectedRevisionContent" class="flex items-center justify-center min-h-[400px] text-nc-content-gray-subtle">
        Select a revision to preview
      </div>
      <div v-else class="px-4 py-3">
        <DocHistoryViewer
          :content="previewContent"
          :comparison-content="comparisonContent"
          :highlight-changes="highlightChanges"
        />
      </div>
    </div>
  </NcModal>
</template>
