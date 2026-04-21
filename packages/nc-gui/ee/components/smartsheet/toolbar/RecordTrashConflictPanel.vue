<script setup lang="ts">
import type { ConflictState, RestoreConflict } from '~/composables/useRecordTrash'

interface Props {
  eventId: string
  rowCount: number
  state: ConflictState
}

const props = defineProps<Props>()

const { t } = useI18n()

const { partialRestoreEvent, forceRestoreEvent, dismissConflict } = useRecordTrash()

const groups = computed(() => {
  const link: RestoreConflict[] = []
  const validation: RestoreConflict[] = []
  const uniqueActive: RestoreConflict[] = []
  const uniqueIntra: RestoreConflict[] = []

  for (const c of props.state.conflicts) {
    switch (c.kind) {
      case 'link-v1':
      case 'link-v2':
        link.push(c)
        break
      case 'validation':
        validation.push(c)
        break
      case 'unique-active':
        uniqueActive.push(c)
        break
      case 'unique-intra':
        uniqueIntra.push(c)
        break
    }
  }

  return { link, validation, uniqueActive, uniqueIntra }
})

// Rows with any conflict vs rows that'd restore cleanly.
const conflictedRowCount = computed(() => {
  const ids = new Set<string>()
  for (const c of props.state.conflicts) ids.add(c.rowId)
  return ids.size
})

const cleanCount = computed(() => Math.max(0, props.rowCount - conflictedRowCount.value))
</script>

<template>
  <div class="nc-trash-conflict-panel border-t-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight">
    <div class="px-6 py-4 flex flex-col gap-3">
      <!-- Header -->
      <div class="flex items-start gap-2.5">
        <div
          class="w-5 h-5 rounded-full bg-nc-fill-red flex items-center justify-center shrink-0 mt-0.5"
        >
          <GeneralIcon icon="alertTriangle" class="w-3 h-3 text-white" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-bodyDefault font-semibold text-nc-content-gray-emphasis">
            {{ t('trash.conflict.panelTitle', { count: conflictedRowCount }, conflictedRowCount) }}
          </div>
          <div class="text-captionSm text-nc-content-gray-subtle mt-0.5">
            {{ t('trash.conflict.panelHelp') }}
          </div>
        </div>
      </div>

      <!-- Error banner -->
      <div
        v-if="state.error"
        class="text-captionSm text-nc-content-red-dark bg-nc-bg-red-light border-1 border-nc-border-red rounded px-3 py-2"
      >
        {{ state.error }}
      </div>

      <!-- Groups -->
      <div class="flex flex-col gap-2">
        <SmartsheetToolbarRecordTrashConflictGroup v-if="groups.link.length" kind="link" :conflicts="groups.link" />
        <SmartsheetToolbarRecordTrashConflictGroup
          v-if="groups.validation.length"
          kind="validation"
          :conflicts="groups.validation"
        />
        <SmartsheetToolbarRecordTrashConflictGroup
          v-if="groups.uniqueActive.length"
          kind="unique-active"
          :conflicts="groups.uniqueActive"
        />
        <SmartsheetToolbarRecordTrashConflictGroup
          v-if="groups.uniqueIntra.length"
          kind="unique-intra"
          :conflicts="groups.uniqueIntra"
        />
      </div>

      <!-- Clean-count hint -->
      <div v-if="cleanCount > 0" class="text-captionSm text-nc-content-gray-subtle flex items-center gap-1.5">
        <GeneralIcon icon="ncInfo" class="w-3.5 h-3.5 shrink-0" />
        {{ t('trash.conflict.cleanRemainder', { count: cleanCount }, cleanCount) }}
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-2 pt-1">
        <NcButton
          v-e="['c:trash:restore:cancel']"
          size="small"
          type="secondary"
          :disabled="state.isSubmitting"
          @click="dismissConflict(eventId)"
        >
          {{ t('trash.conflict.action.cancel') }}
        </NcButton>

        <NcButton
          v-if="cleanCount > 0"
          v-e="['c:trash:restore:partial']"
          size="small"
          type="secondary"
          :loading="state.isSubmitting"
          :disabled="state.isSubmitting"
          @click="partialRestoreEvent(eventId)"
        >
          {{ t('trash.conflict.action.partial', { count: cleanCount }) }}
        </NcButton>

        <NcButton
          v-e="['c:trash:restore:force']"
          size="small"
          type="danger"
          :loading="state.isSubmitting"
          :disabled="state.isSubmitting"
          @click="forceRestoreEvent(eventId)"
        >
          {{ t('trash.conflict.action.force') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-trash-conflict-panel {
  animation: panelOpen 180ms ease-out;
  box-shadow: inset 3px 0 0 var(--nc-fill-red-medium, #ef4444);
}
@keyframes panelOpen {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
