<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row as RowType } from '~/lib/types'
import { useKanbanViewStoreOrThrow } from '~/store/kanban'

interface Props {
  row: RowType
  fields: ColumnType[]
  groupField?: ColumnType
  readOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readOnly: false,
})

const emit = defineEmits(['expandRecord', 'deleteRecord'])

const { isCompactMode } = useKanbanViewStoreOrThrow()

const { isUIAllowed } = useRoles()

const { getPossibleAttachmentSrc } = useAttachment()

const displayField = computed(() =>
  props.fields.find((f) => (f as any).pv),
)

const remainingFields = computed(() =>
  props.fields.filter((f) => !(f as any).pv && (f as any).visible),
)

function expandRecord() {
  emit('expandRecord', props.row)
}

function deleteRecord() {
  emit('deleteRecord', props.row)
}
</script>

<template>
  <div
    class="nc-kanban-card group relative bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-brand-500 hover:shadow-sm transition-all"
    :class="{
      'px-3 py-3': !isCompactMode,
      'px-2.5 py-1.5': isCompactMode,
    }"
    data-testid="nc-kanban-card"
    @click="expandRecord"
  >
    <!-- Compact Mode: Single line view -->
    <div
      v-if="isCompactMode"
      class="flex items-center justify-between gap-2 min-h-[22px]"
    >
      <div class="flex-1 overflow-hidden">
        <SmartsheetRow :row="row">
          <div class="flex items-center gap-1.5 overflow-hidden">
            <LazySmartsheetCell
              v-if="displayField"
              :column="displayField"
              :model-value="row.row[displayField.title!]"
              :row-index="0"
              :read-only="true"
              class="!text-sm !text-gray-800 dark:!text-gray-100 truncate pointer-events-none !leading-tight"
            />
            <span
              v-else
              class="text-gray-400 text-xs italic"
            >
              {{ $t('msg.noData') }}
            </span>
          </div>
        </SmartsheetRow>
      </div>

      <!-- Compact actions -->
      <div
        v-if="!readOnly && isUIAllowed('dataEdit')"
        class="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity"
        @click.stop
      >
        <NcButton
          size="xsmall"
          type="text"
          class="!h-5 !w-5 !p-0 !text-gray-400 hover:!text-red-500"
          @click.stop="deleteRecord"
        >
          <GeneralIcon icon="delete" class="h-3 w-3" />
        </NcButton>
      </div>
    </div>

    <!-- Normal Mode: Full card view -->
    <template v-else>
      <SmartsheetRow :row="row">
        <div class="flex flex-col gap-1.5">
          <!-- Primary field -->
          <div
            v-if="displayField"
            class="text-sm font-medium text-gray-800 dark:text-gray-100"
          >
            <LazySmartsheetCell
              :column="displayField"
              :model-value="row.row[displayField.title!]"
              :row-index="0"
              :read-only="true"
              class="pointer-events-none"
            />
          </div>

          <!-- Additional fields -->
          <template v-for="field in remainingFields" :key="field.id">
            <div class="flex items-start gap-1.5 text-xs">
              <span class="text-gray-500 font-medium flex-shrink-0 max-w-[96px] truncate pt-0.5">
                {{ field.title }}
              </span>
              <div class="flex-1 overflow-hidden">
                <LazySmartsheetCell
                  :column="field"
                  :model-value="row.row[field.title!]"
                  :row-index="0"
                  :read-only="true"
                  class="pointer-events-none"
                />
              </div>
            </div>
          </template>
        </div>
      </SmartsheetRow>

      <!-- Action buttons (on hover) -->
      <div
        v-if="!readOnly && isUIAllowed('dataEdit')"
        class="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        @click.stop
      >
        <NcButton
          size="xsmall"
          type="text"
          class="!h-5 !w-5 !p-0 !text-gray-400 hover:!text-red-500"
          @click.stop="deleteRecord"
        >
          <GeneralIcon icon="delete" class="h-3 w-3" />
        </NcButton>
      </div>
    </template>
  </div>
</template>
