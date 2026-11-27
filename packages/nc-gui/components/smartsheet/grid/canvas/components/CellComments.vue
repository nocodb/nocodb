<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'

const props = defineProps<{
  row: Row
  column: ColumnType
}>()

const emits = defineEmits<{
  (e: 'close'): void
  (e: 'expand'): void
  (e: 'countsChanged'): void
}>()

const meta = inject(MetaInj, ref()) as Ref<TableType>

const row = computed(() => props.row)

const { loadComments, isCommentsLoading } = useProvideRowComments(meta, row)

const { $e } = useNuxtApp()

const showResolved = ref(false)

const displayValue = computed(() => {
  const pv = (meta.value?.columns ?? []).find((c) => c.pv)
  const value = pv ? props.row.row?.[pv.title!] : null
  return ncIsObject(value) || ncIsArray(value) ? '' : value ?? ''
})

watch(
  () => [props.row.rowMeta?.commentCount, props.row.rowMeta?.cellCommentCounts],
  () => emits('countsChanged'),
  { deep: true },
)

onMounted(() => {
  isCommentsLoading.value = true
  loadComments(undefined, false)
  $e('c:comment:cell:open')
})

// Capture phase: the comment editor stops Escape from bubbling. Escape while
// editing an existing comment still cancels that edit.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if ((e.target as HTMLElement | null)?.closest?.('.nc-comment-item')) return
  e.stopPropagation()
  emits('close')
}
</script>

<template>
  <div
    class="nc-cell-comments-popover flex flex-col w-[380px] max-h-[min(440px,70vh)] rounded-xl border-1 border-nc-border-gray-medium bg-nc-bg-elevated shadow-lg overflow-hidden"
    role="dialog"
    :aria-label="$t('activity.cellComments.title', { field: column.title })"
    data-testid="nc-cell-comments-popover"
    @keydown.capture="onKeydown"
    @mousedown.stop
    @wheel.stop
  >
    <div class="flex-none h-11 flex items-center gap-1.5 pl-3 pr-1.5 border-b-1 border-nc-border-gray-light">
      <SmartsheetHeaderIcon :column="column" class="!ml-0 !h-3.5 !w-3.5 flex-none" color="text-nc-content-gray-subtle" />
      <span class="truncate font-semibold text-small text-nc-content-gray">{{ column.title }}</span>
      <span v-if="displayValue" class="truncate text-captionSm text-nc-content-gray-muted min-w-0">{{ displayValue }}</span>
      <div class="flex-1" />
      <NcTooltip :title="$t('labels.showResolvedComments')" placement="top">
        <NcButton
          type="text"
          size="xsmall"
          icon-only
          :class="{ '!bg-nc-bg-brand !text-nc-content-brand': showResolved }"
          :aria-label="$t('labels.showResolvedComments')"
          data-testid="nc-cell-comments-show-resolved"
          @click="showResolved = !showResolved"
        >
          <template #icon>
            <GeneralIcon icon="check" class="h-4 w-4" />
          </template>
        </NcButton>
      </NcTooltip>
      <NcTooltip :title="$t('activity.cellComments.openRecord')" placement="top">
        <NcButton
          type="text"
          size="xsmall"
          icon-only
          :aria-label="$t('activity.cellComments.openRecord')"
          data-testid="nc-cell-comments-expand"
          @click="emits('expand')"
        >
          <template #icon>
            <GeneralIcon icon="maximize" class="h-3.5 w-3.5" />
          </template>
        </NcButton>
      </NcTooltip>
      <NcButton
        type="text"
        size="xsmall"
        icon-only
        :aria-label="$t('general.close')"
        data-testid="nc-cell-comments-close"
        @click="emits('close')"
      >
        <template #icon>
          <GeneralIcon icon="close" class="h-4 w-4" />
        </template>
      </NcButton>
    </div>
    <div class="flex flex-col min-h-0">
      <SmartsheetExpandedFormSidebarComments :field-id="column.id" :show-resolved="showResolved" hide-copy-url />
    </div>
  </div>
</template>
