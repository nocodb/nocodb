<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row } from '#imports'

const props = defineProps<{
  row: Row
  fields: ColumnType[]
  coverImageField?: string
  groupingField?: ColumnType
  isPublic?: boolean
  readOnly?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'expand'): void
  (e: 'deleteRecord'): void
}>()

const { isMobileMode } = useGlobal()
const { isUIAllowed } = useRoles()
const { t } = useI18n()
const { getPossibleAttachmentSrc } = useAttachment()

const coverImageSrc = computed<string | null>(() => {
  if (!props.coverImageField || !props.row?.row) return null
  const attachments = props.row.row[props.coverImageField]
  if (!attachments?.length) return null
  try {
    const parsed = typeof attachments === 'string' ? JSON.parse(attachments) : attachments
    const first = parsed?.[0]
    if (!first) return null
    return getPossibleAttachmentSrc(first)
  } catch {
    return null
  }
})

const displayField = computed(() => props.fields?.find((f) => (f as any).pv))

const nonPrimaryFields = computed(() =>
  props.fields?.filter(
    (f) => !(f as any).pv && f.title !== props.groupingField?.title,
  ) ?? [],
)
</script>

<template>
  <div
    class="group relative nc-kanban-item rounded-xl bg-white border-1 border-gray-200 hover:border-brand-500 transition-all cursor-pointer overflow-hidden"
    :class="{
      'p-3': !compact,
      'px-3 py-2': compact,
    }"
    @click="emit('expand')"
  >
    <!-- Cover Image: only in normal mode -->
    <div
      v-if="!compact && coverImageSrc"
      class="nc-kanban-cover mb-3 -mx-3 -mt-3 h-48 overflow-hidden"
    >
      <img
        :src="coverImageSrc"
        class="w-full h-full object-cover"
        alt=""
      />
    </div>

    <div class="flex items-start gap-1">
      <!-- Primary/Title Field -->
      <div class="flex-1 min-w-0">
        <LazySmartsheetVirtualCell
          v-if="displayField && isVirtualCol(displayField)"
          :model-value="row.row[displayField.title!]"
          :row="row"
          :column="displayField"
          :read-only="true"
          class="nc-kanban-title text-sm font-medium text-gray-800"
          :class="{ 'line-clamp-1': compact }"
        />
        <LazySmartsheetCell
          v-else-if="displayField"
          :model-value="row.row[displayField.title!]"
          :row="row"
          :column="displayField"
          :read-only="true"
          class="nc-kanban-title text-sm font-medium text-gray-800"
          :class="{ 'line-clamp-1': compact }"
        />
      </div>

      <!-- Options Menu -->
      <div
        v-if="!readOnly && !isMobileMode"
        class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        @click.stop
      >
        <NcDropdown placement="bottomRight" :trigger="['click']">
          <NcButton size="xsmall" type="text">
            <GeneralIcon icon="threeDotVertical" class="text-gray-500 h-4 w-4" />
          </NcButton>
          <template #overlay>
            <NcMenu>
              <NcMenuItem @click="emit('expand')">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="expand" />
                  {{ t('activity.expandRow') }}
                </div>
              </NcMenuItem>
              <template v-if="isUIAllowed('dataEdit') && !isPublic">
                <NcDivider />
                <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="emit('deleteRecord')">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="delete" />
                    {{ t('activity.deleteRow') }}
                  </div>
                </NcMenuItem>
              </template>
            </NcMenu>
          </template>
        </NcDropdown>
      </div>
    </div>

    <!-- Additional Fields: only in normal mode -->
    <template v-if="!compact && nonPrimaryFields.length">
      <div class="nc-kanban-fields mt-2 flex flex-col gap-1">
        <div
          v-for="field in nonPrimaryFields"
          :key="field.id"
          class="flex items-center gap-2"
        >
          <div class="text-gray-500 text-xs w-24 flex-shrink-0 truncate">
            {{ field.title }}
          </div>
          <div class="flex-1 min-w-0 text-xs overflow-hidden">
            <LazySmartsheetVirtualCell
              v-if="isVirtualCol(field)"
              :model-value="row.row[field.title!]"
              :row="row"
              :column="field"
              :read-only="true"
            />
            <LazySmartsheetCell
              v-else
              :model-value="row.row[field.title!]"
              :row="row"
              :column="field"
              :read-only="true"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
