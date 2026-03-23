<script lang="ts" setup>
import type { ColumnType, KanbanType } from 'nocodb-sdk'
import { type Row, isDrawerOrModalExist } from '#imports'

const props = defineProps<{
  row: Row
  fields: ColumnType[]
  kanbanMetaData?: KanbanType
  readOnly?: boolean
  isSortable?: boolean
  compactMode?: boolean
}>()

const emits = defineEmits(['expand', 'deleteRow', 'unGroupRow', 'reorder'])

const { row, fields, kanbanMetaData, readOnly, compactMode } = toRefs(props)

const { isMobileMode } = useGlobal()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const { isUIAllowed } = useRoles()

const { getPossibleAttachmentSrc, isImage } = useAttachment()

const { isSynced } = useNocoEe()

// Gather attachment fields
const attachmentField = computed(() =>
  fields.value?.find((f) => f.uidt === UITypes.Attachment && (!isSynced.value || f.meta?.ag !== 'count')),
)

const attachments = computed(() => {
  if (!attachmentField.value) return []
  const value = row.value?.row?.[attachmentField.value?.title as string]
  if (Array.isArray(value)) {
    return value.filter((attachment) => isImage(attachment.title, attachment.mimetype))
  }
  return []
})

const primaryField = computed(() => fields.value?.find((f) => f.pv))

const fieldsWithoutPrimary = computed(() => {
  if (compactMode.value) return []
  return fields.value?.filter((f) => !f.pv && f.uidt !== UITypes.Attachment)
})

const isCompact = computed(() => compactMode.value || isMobileMode.value)

function expandCard() {
  if (!isDrawerOrModalExist()) {
    emits('expand')
  }
}
</script>

<template>
  <div
    :class="[
      'nc-kanban-item group relative flex flex-col rounded-md border border-gray-200 bg-white shadow-sm',
      isCompact ? 'py-1.5 px-2 gap-0.5' : 'py-3 px-3 gap-2',
      { 'cursor-pointer': !readOnly },
    ]"
    @click="expandCard"
  >
    <!-- Compact Mode Row -->
    <template v-if="isCompact">
      <div class="flex items-center gap-1 w-full">
        <div class="flex-1 min-w-0 text-xs text-gray-800 font-medium truncate">
          <LazySmartsheetVirtualCell
            v-if="primaryField && row.row[primaryField.title!] !== undefined"
            :model-value="row.row[primaryField.title!]"
            :column="primaryField"
            :row="row"
            read-only
            class="!text-xs !font-medium truncate"
          />
          <LazySmartsheetCell
            v-else-if="primaryField"
            :model-value="row.row[primaryField.title!]"
            :column="primaryField"
            :row="row"
            read-only
            class="!text-xs !font-medium truncate"
          />
          <span v-else class="text-gray-400 italic">{{ $t('msg.noData') }}</span>
        </div>
        <!-- Actions -->
        <div
          v-if="!readOnly"
          class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop
        >
          <NcTooltip placement="bottom">
            <template #title>{{ $t('activity.expandRow') }}</template>
            <NcButton
              size="xsmall"
              type="text"
              class="!h-5 !w-5 !min-w-5"
              @click.stop="emits('expand')"
            >
              <component :is="iconMap.expand" class="h-3 w-3" />
            </NcButton>
          </NcTooltip>
        </div>
      </div>
    </template>

    <!-- Normal Mode -->
    <template v-else>
      <!-- Attachment preview -->
      <div v-if="attachments.length" class="overflow-hidden rounded-t-md -mt-3 -mx-3 mb-1">
        <img
          :src="getPossibleAttachmentSrc(attachments[0])"
          class="w-full object-cover max-h-40"
          alt="attachment"
        />
      </div>

      <!-- Primary field -->
      <div class="flex items-start gap-1">
        <div class="flex-1 min-w-0 font-medium text-sm text-gray-800">
          <LazySmartsheetVirtualCell
            v-if="primaryField && isVirtualCol(primaryField)"
            :model-value="row.row[primaryField.title!]"
            :column="primaryField"
            :row="row"
            read-only
          />
          <LazySmartsheetCell
            v-else-if="primaryField"
            :model-value="row.row[primaryField.title!]"
            :column="primaryField"
            :row="row"
            read-only
          />
        </div>
        <!-- Expand button -->
        <div
          v-if="!readOnly"
          class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          @click.stop
        >
          <NcTooltip placement="bottom">
            <template #title>{{ $t('activity.expandRow') }}</template>
            <NcButton
              size="xsmall"
              type="text"
              class="!h-6 !w-6 !min-w-6"
              @click.stop="emits('expand')"
            >
              <component :is="iconMap.expand" class="h-3.5 w-3.5" />
            </NcButton>
          </NcTooltip>
        </div>
      </div>

      <!-- Other fields -->
      <div
        v-for="field in fieldsWithoutPrimary"
        :key="field.id"
        class="flex items-start gap-1 text-xs"
      >
        <div class="text-gray-500 min-w-[80px] truncate flex-shrink-0">{{ field.title }}</div>
        <div class="flex-1 min-w-0 text-gray-700">
          <LazySmartsheetVirtualCell
            v-if="isVirtualCol(field)"
            :model-value="row.row[field.title!]"
            :column="field"
            :row="row"
            read-only
          />
          <LazySmartsheetCell
            v-else
            :model-value="row.row[field.title!]"
            :column="field"
            :row="row"
            read-only
          />
        </div>
      </div>
    </template>
  </div>
</template>
