<script lang="ts" setup>
import type { AttachmentType, ColumnType } from 'nocodb-sdk'
import { useAttachment } from '#imports'

interface Row {
  row: Record<string, any>
  oldRow: Record<string, any>
  rowMeta: {
    isNew?: boolean
    selected?: boolean
    [key: string]: any
  }
}

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

const coverImageRef = ref<HTMLDivElement>()

const getCoverImage = computed<AttachmentType | null>(() => {
  if (!props.coverImageField || !props.row?.row) return null
  const attachments = props.row.row[props.coverImageField]
  if (!attachments?.length) return null
  try {
    const parsed = typeof attachments === 'string' ? JSON.parse(attachments) : attachments
    return parsed?.[0] ?? null
  } catch {
    return null
  }
})

const displayField = computed(() => props.fields?.find((f) => (f as any).pv))

const nonPrimaryFields = computed(() => {
  return (
    props.fields?.filter(
      (f) =>
        !(f as any).pv &&
        f.title !== props.groupingField?.title,
    ) ?? []
  )
})

const rowHeight = computed(() => {
  // For compact mode, we don't show additional fields
  return props.compact ? 'compact' : 'normal'
})
</script>

<template>
  <div
    class="nc-kanban-item group relative flex flex-col w-full cursor-pointer border-1 border-gray-200 rounded-xl bg-white hover:border-primary transition-colors"
    :class="{
      'p-2': compact,
      'p-3': !compact,
    }"
    @click="emit('expand')"
  >
    <!-- Cover Image (only in non-compact mode) -->
    <template v-if="!compact">
      <div
        v-if="getCoverImage"
        ref="coverImageRef"
        class="nc-kanban-cover-img mb-3 h-48 w-full rounded-lg overflow-hidden"
      >
        <img
          :src="getPossibleAttachmentSrc(getCoverImage)"
          class="w-full h-full object-cover"
          alt="cover"
        />
      </div>
    </template>

    <!-- Card Content -->
    <div
      class="flex items-start justify-between"
      :class="{
        'gap-1': compact,
        'gap-2': !compact,
      }"
    >
      <!-- Title / Display Field -->
      <div
        class="flex-1 min-w-0"
        :class="{
          'text-sm font-medium text-gray-800 line-clamp-1': compact,
          'text-sm font-medium text-gray-800': !compact,
        }"
      >
        <LazySmartsheetVirtualCell
          v-if="displayField && row"
          :model-value="row.row[displayField.title!]"
          :row="row"
          :column="displayField"
          :read-only="true"
          class="nc-kanban-title"
        />
        <LazySmartsheetCell
          v-else-if="displayField && row"
          :model-value="row.row[displayField.title!]"
          :row="row"
          :column="displayField"
          :read-only="true"
          class="nc-kanban-title"
        />
      </div>

      <!-- Actions (only visible on hover) -->
      <div
        v-if="!readOnly && !isMobileMode"
        class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <NcDropdown placement="bottomRight" :trigger="['click']" @click.stop>
          <NcButton
            size="xsmall"
            type="text"
            class="nc-kanban-card-menu-button"
            @click.stop
          >
            <GeneralIcon icon="threeDotVertical" class="text-gray-500" />
          </NcButton>
          <template #overlay>
            <NcMenu>
              <NcMenuItem @click.stop="emit('expand')">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="expand" />
                  {{ t('activity.expandRow') }}
                </div>
              </NcMenuItem>
              <template v-if="isUIAllowed('dataEdit') && !isPublic">
                <NcDivider />
                <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click.stop="emit('deleteRecord')">
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

    <!-- Additional Fields (hidden in compact mode) -->
    <template v-if="!compact">
      <div
        v-if="nonPrimaryFields.length"
        class="nc-kanban-fields mt-2 flex flex-col gap-1"
      >
        <div
          v-for="field in nonPrimaryFields"
          :key="field.id"
          class="flex items-center gap-2 text-xs"
        >
          <div class="text-gray-500 w-24 flex-shrink-0 truncate">
            {{ field.title }}
          </div>
          <div class="flex-1 min-w-0 overflow-hidden">
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
