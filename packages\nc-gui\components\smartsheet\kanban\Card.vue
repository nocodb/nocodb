<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row as RowType } from '~/lib/types'

const props = defineProps<{
  row: RowType
  fields: ColumnType[]
  groupField?: ColumnType
  readOnly?: boolean
}>()

const emit = defineEmits(['expandRecord', 'deleteRecord'])

const { isCompactMode } = useKanbanViewStoreOrThrow()

const { isUIAllowed } = useRoles()

const { getPossibleAttachmentSrc } = useAttachment()

const attachmentField = computed(() =>
  props.fields.find((f) => f.uidt === UITypes.Attachment),
)

const displayField = computed(() => props.fields.find((f) => (f as any).pv))

const hiddenFields = computed(() =>
  props.fields.filter((f) => !(f as any).pv && (f as any).visible),
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
    class="nc-kanban-card group relative cursor-pointer rounded-md border-1 border-gray-200 bg-white hover:border-brand-500 dark:border-gray-700 dark:bg-gray-900"
    :class="[isCompactMode ? 'px-2 py-1' : 'px-3 py-3']"
    @click="onExpandRecord"
  >
    <!-- Compact mode layout -->
    <div v-if="isCompactMode" class="flex items-center gap-2 min-h-[24px] overflow-hidden">
      <div class="flex-1 overflow-hidden">
        <SmartsheetRow :row="row">
          <LazySmartsheetCell
            v-if="displayField"
            :column="displayField"
            :model-value="row.row[displayField.title!]"
            :row-index="0"
            :read-only="true"
            class="!text-sm !font-medium truncate pointer-events-none"
          />
          <span v-else class="text-gray-400 text-xs">-</span>
        </SmartsheetRow>
      </div>

      <div
        class="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        @click.stop
      >
        <NcTooltip v-if="!readOnly && isUIAllowed('dataEdit')" placement="bottom">
          <template #title>{{ $t('activity.deleteRow') }}</template>
          <NcButton
            size="xsmall"
            type="text"
            class="!h-5 !w-5 !text-gray-500 hover:!text-red-500 hover:!bg-red-50"
            @click.stop="onDeleteRecord"
          >
            <GeneralIcon icon="delete" class="h-3 w-3" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>

    <!-- Normal mode layout -->
    <template v-else>
      <SmartsheetRow :row="row">
        <div class="flex flex-col gap-2">
          <!-- Primary / display field -->
          <div v-if="displayField" class="text-sm font-medium text-gray-800 dark:text-gray-100">
            <LazySmartsheetCell
              :column="displayField"
              :model-value="row.row[displayField.title!]"
              :row-index="0"
              :read-only="true"
              class="pointer-events-none"
            />
          </div>

          <!-- Remaining visible fields -->
          <div
            v-for="field in hiddenFields"
            :key="field.id"
            class="flex items-start gap-2 text-xs"
          >
            <div class="text-gray-500 font-medium min-w-[48px] max-w-[80px] truncate pt-0.5 flex-shrink-0">
              {{ field.title }}
            </div>
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
        </div>
      </SmartsheetRow>

      <!-- Actions overlay (visible on hover) -->
      <div
        class="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        @click.stop
      >
        <NcTooltip v-if="!readOnly && isUIAllowed('dataEdit')" placement="bottom">
          <template #title>{{ $t('activity.deleteRow') }}</template>
          <NcButton
            size="xsmall"
            type="text"
            class="!h-5 !w-5 !text-gray-500 hover:!text-red-500 hover:!bg-red-50"
            @click.stop="onDeleteRecord"
          >
            <GeneralIcon icon="delete" class="h-3 w-3" />
          </NcButton>
        </NcTooltip>
      </div>
    </template>
  </div>
</template>
