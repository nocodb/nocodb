<script setup lang="ts">
import type { Row } from '~/lib/types'
import {
  computed,
  inject,
  ref,
  useKanbanViewStoreOrThrow,
  useSmartsheetStoreOrThrow,
  useViewColumnsOrThrow,
} from '#imports'
import { FieldType } from 'nocodb-sdk'

// ── Props ──────────────────────────────────────────────────────────────────
const props = defineProps<{
  row: Row
  /** Stack/column index this card lives in */
  stackIndex: number
  /** Card index within the stack (used for drag-and-drop keys) */
  cardIndex: number
}>()

const emit = defineEmits<{
  (e: 'expand', row: Row): void
  (e: 'click', row: Row): void
}>()

// ── Store bindings ─────────────────────────────────────────────────────────
const { isCompactMode } = useKanbanViewStoreOrThrow()
const { meta } = useSmartsheetStoreOrThrow()
const { fields, coverImageField } = useViewColumnsOrThrow()

// ── Computed ───────────────────────────────────────────────────────────────

/** Fields visible on the card (excluding the cover image field) */
const visibleFields = computed(() =>
  (fields.value ?? []).filter(
    (f) => f.show && f.fk_column_id !== coverImageField.value?.fk_column_id,
  ),
)

/** The primary / title field */
const titleField = computed(() =>
  fields.value?.find((f) => {
    const col = meta.value?.columns?.find((c) => c.id === f.fk_column_id)
    return col?.pv
  }),
)

/** In compact mode we only show the title field */
const compactFields = computed(() =>
  titleField.value ? [titleField.value] : visibleFields.value.slice(0, 1),
)

/** Fields actually rendered */
const renderedFields = computed(() =>
  isCompactMode.value ? compactFields.value : visibleFields.value,
)

/** Cover image URL when NOT in compact mode */
const coverImageUrl = computed(() => {
  if (isCompactMode.value || !coverImageField.value) return null
  const attachments = props.row.row[coverImageField.value.title ?? '']
  if (!Array.isArray(attachments) || attachments.length === 0) return null
  return attachments[0]?.signedPath ?? attachments[0]?.path ?? null
})

// ── Expand ─────────────────────────────────────────────────────────────────
function onExpand() {
  emit('expand', props.row)
}
</script>

<template>
  <!-- ───────────────────────────────────────────────────────────────────────
       Root element receives 'compact' class when compact mode is on.
       This class drives the CSS overrides below.
       ─────────────────────────────────────────────────────────────────────── -->
  <div
    class="nc-kanban-card group relative cursor-pointer rounded-md border border-gray-200 bg-white shadow-sm
           hover:border-primary hover:shadow-md transition-all duration-150"
    :class="{
      'nc-kanban-card-compact': isCompactMode,
      'nc-kanban-card-normal': !isCompactMode,
    }"
    @click="emit('click', row)"
  >
    <!-- ── Cover Image (hidden in compact mode) ──────────────────────────── -->
    <div
      v-if="coverImageUrl && !isCompactMode"
      class="nc-kanban-card-cover w-full overflow-hidden rounded-t-md"
    >
      <img
        :src="coverImageUrl"
        alt="cover"
        class="h-[160px] w-full object-cover"
      />
    </div>

    <!-- ── Card Body ──────────────────────────────────────────────────────── -->
    <div
      class="nc-kanban-card-body"
      :class="isCompactMode ? 'px-2 py-1' : 'px-3 py-3'"
    >
      <!-- Compact layout: single row with title + expand icon -->
      <template v-if="isCompactMode">
        <div class="flex items-center justify-between gap-2 min-h-[28px]">
          <!-- Primary field value -->
          <div class="flex-1 truncate text-sm font-medium text-gray-800 leading-tight">
            <LazySmartsheetCell
              v-if="titleField"
              :model-value="row.row[titleField.title ?? '']"
              :column="
                meta?.columns?.find(
                  (c) => c.id === titleField!.fk_column_id,
                )
              "
              :row="row"
              :read-only="true"
              class="!p-0 truncate"
            />
            <span v-else class="text-gray-400 italic text-xs">{{ $t('labels.noTitle') }}</span>
          </div>

          <!-- Expand button (visible on hover) -->
          <NcTooltip placement="top">
            <template #title>{{ $t('tooltip.expand') }}</template>
            <NcButton
              size="xsmall"
              type="text"
              class="!h-5 !w-5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity"
              @click.stop="onExpand"
            >
              <MdiArrowExpandAll class="h-3 w-3 text-gray-500" />
            </NcButton>
          </NcTooltip>
        </div>
      </template>

      <!-- Normal layout: all visible fields stacked -->
      <template v-else>
        <div class="flex flex-col gap-1.5">
          <div
            v-for="field in renderedFields"
            :key="field.fk_column_id"
            class="nc-kanban-card-field flex flex-col gap-0.5"
          >
            <!-- Field label -->
            <span class="text-[11px] font-medium text-gray-400 uppercase tracking-wide leading-none">
              {{ field.title }}
            </span>
            <!-- Field value -->
            <LazySmartsheetCell
              :model-value="row.row[field.title ?? '']"
              :column="
                meta?.columns?.find((c) => c.id === field.fk_column_id)
              "
              :row="row"
              :read-only="true"
              class="!p-0 text-sm text-gray-800"
            />
          </div>
        </div>

        <!-- Expand row icon (bottom-right, on hover) -->
        <div
          class="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <NcTooltip placement="top">
            <template #title>{{ $t('tooltip.expand') }}</template>
            <NcButton
              size="xsmall"
              type="text"
              class="!h-6 !w-6"
              @click.stop="onExpand"
            >
              <MdiArrowExpandAll class="h-3.5 w-3.5 text-gray-500" />
            </NcButton>
          </NcTooltip>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
// ── Normal card ─────────────────────────────────────────────────────────────
.nc-kanban-card-normal {
  min-height: 56px;
}

// ── Compact card ────────────────────────────────────────────────────────────
.nc-kanban-card-compact {
  // Single-line height; no cover image, no extra padding
  min-height: 32px;

  .nc-kanban-card-body {
    display: flex;
    align-items: center;
  }
}

// ── Shared ──────────────────────────────────────────────────────────────────
.nc-kanban-card {
  &:hover {
    @apply border-primary;
  }
}
</style>
