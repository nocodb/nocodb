<script lang="ts" setup>
import type { Row as RowType } from '#imports'
import {
  IsKanbanInj,
  MetaInj,
  computed,
  inject,
  isPrimary,
  ref,
  useAttachment,
  useKanbanViewStoreOrThrow,
  useLTARStoreOrThrow,
  useSmartsheetRowStoreOrThrow,
} from '#imports'

const props = defineProps<{
  row: RowType
  fields: any[]
  groupField?: any
  readOnly?: boolean
}>()

const emit = defineEmits(['expandRecord', 'deleteRecord'])

const meta = inject(MetaInj, ref())

const isKanban = inject(IsKanbanInj, ref(false))

const { isCompactMode } = useKanbanViewStoreOrThrow()

const { getPossibleAttachmentSrc } = useAttachment()

const displayField = computed(() => props.fields?.find((f: any) => f.pv))

const remainingFields = computed(() =>
  props.fields?.filter((f: any) => !f.pv && f.visible)
)

function onExpandRecord() {
  emit('expandRecord', props.row)
}

function onDeleteRecord() {
  emit('deleteRecord', props.row)
}
</script>

<template>
  <div
    class="nc-kanban-card group relative cursor-pointer rounded-md border-1 border-gray-200 bg-white px-3 hover:border-brand-400 dark:border-gray-600 dark:bg-gray-900"
    :class="[
      isCompactMode
        ? 'py-1.5 min-h-[32px]'
        : 'py-3 min-h-[52px]'
    ]"
    @click="onExpandRecord"
  >
    <!-- Compact mode: single line with display field -->
    <template v-if="isCompactMode">
      <div class="flex items-center gap-2 w-full overflow-hidden">
        <div class="flex-1 overflow-hidden">
          <SmartsheetRow :row="row">
            <div class="flex items-center overflow-hidden">
              <template v-if="displayField">
                <SmartsheetCell
                  :column="displayField"
                  :model-value="row.row[displayField.title]"
                  :row-index="0"
                  :read-only="true"
                  class="!text-sm font-medium text-gray-800 dark:text-gray-100 truncate pointer-events-none"
                />
              </template>
              <span v-else class="text-gray-400 text-xs italic">
                {{ $t('msg.noData') }}
              </span>
            </div>
          </SmartsheetRow>
        </div>

        <!-- Row actions in compact mode -->
        <div
          class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          @click.stop
        >
          <NcTooltip v-if="!readOnly">
            <template #title>{{ $t('activity.deleteRow') }}</template>
            <NcButton
              size="xsmall"
              type="text"
              class="!text-gray-500 hover:!text-red-500"
              @click.stop="onDeleteRecord"
            >
              <GeneralIcon icon="delete" class="h-3 w-3" />
            </NcButton>
          </NcTooltip>
        </div>
      </div>
    </template>

    <!-- Normal mode: full card with all fields -->
    <template v-else>
      <SmartsheetRow :row="row">
        <div class="flex flex-col gap-2 w-full">
          <!-- Display field (primary value) -->
          <template v-if="displayField">
            <div class="font-medium text-gray-800 dark:text-gray-100 text-sm">
              <SmartsheetCell
                :column="displayField"
                :model-value="row.row[displayField.title]"
                :row-index="0"
                :read-only="true"
                class="pointer-events-none"
              />
            </div>
          </template>

          <!-- Remaining visible fields -->
          <template v-if="remainingFields && remainingFields.length > 0">
            <div
              v-for="field in remainingFields"
              :key="field.id"
              class="flex items-start gap-1 text-xs"
            >
              <span class="text-gray-500 font-medium min-w-[60px] pt-0.5 truncate">
                {{ field.title }}
              </span>
              <SmartsheetCell
                :column="field"
                :model-value="row.row[field.title]"
                :row-index="0"
                :read-only="true"
                class="flex-1 pointer-events-none"
              />
            </div>
          </template>
        </div>
      </SmartsheetRow>

      <!-- Row actions overlay -->
      <div
        class="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        @click.stop
      >
        <NcTooltip v-if="!readOnly">
          <template #title>{{ $t('activity.deleteRow') }}</template>
          <NcButton
            size="xsmall"
            type="text"
            class="!text-gray-500 hover:!text-red-500"
            @click.stop="onDeleteRecord"
          >
            <GeneralIcon icon="delete" class="h-3 w-3" />
          </NcButton>
        </NcTooltip>
      </div>
    </template>
  </div>
</template>
