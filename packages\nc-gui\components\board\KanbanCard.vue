<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  row: Row
  fields: ColumnType[]
  readOnly?: boolean
  isSortable?: boolean
  compactMode?: boolean
}>()

const emits = defineEmits(['expand', 'deleteRow', 'unGroupRow', 'reorder'])

const { isMobileMode } = useGlobal()
const { getPossibleAttachmentSrc, isImage } = useAttachment()
const { isSynced } = useNocoEe()
const { isUIAllowed } = useRoles()

const isCompact = computed(() => !!props.compactMode)

const attachmentField = computed(() =>
  props.fields?.find(
    (f) => f.uidt === UITypes.Attachment && (!isSynced.value || f.meta?.ag !== 'count'),
  ),
)

const attachments = computed(() => {
  if (!attachmentField.value) return []
  const value = props.row?.row?.[attachmentField.value?.title as string]
  if (Array.isArray(value)) {
    return value.filter((attachment) => isImage(attachment.title, attachment.mimetype))
  }
  return []
})

const fieldsWithoutCover = computed(() =>
  props.fields?.filter((f) => f.uidt !== UITypes.Attachment),
)

const primaryField = computed(() => fieldsWithoutCover.value?.find((f) => f.pv))

function expandCard() {
  if (!isDrawerOrModalExist()) {
    emits('expand')
  }
}
</script>

<template>
  <div
    :class="[
      'nc-kanban-item group relative flex flex-col rounded-md border border-gray-200 bg-white shadow-sm transition-shadow cursor-pointer',
      isCompact ? 'py-1 px-2 gap-0' : 'pt-2 pb-3 px-3 gap-2',
      { 'hover:shadow-md': !readOnly },
    ]"
    @click="expandCard"
  >
    <!-- Compact view -->
    <template v-if="isCompact">
      <div class="flex items-center gap-1 min-h-[22px]">
        <div class="flex-1 min-w-0 text-[11px] text-gray-800 leading-snug truncate">
          <template v-if="primaryField">
            <LazySmartsheetVirtualCell
              v-if="isVirtualCol(primaryField)"
              :model-value="row.row[primaryField.title!]"
              :column="primaryField"
              :row="row"
              :read-only="true"
              class="!text-[11px] !leading-snug truncate"
            />
            <LazySmartsheetCell
              v-else
              :model-value="row.row[primaryField.title!]"
              :column="primaryField"
              :row="row"
              :read-only="true"
              class="!text-[11px] !leading-snug truncate"
            />
          </template>
          <span v-else class="text-gray-400 italic text-[11px]">
            {{ $t('msg.noData') }}
          </span>
        </div>
        <div
          v-if="!readOnly && isUIAllowed('dataEdit')"
          class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
          @click.stop
        >
          <NcButton
            size="xsmall"
            type="text"
            class="!h-5 !w-5 !min-w-5 !p-0"
            @click.stop="emits('expand')"
          >
            <component :is="iconMap.expand" class="h-2.5 w-2.5 text-gray-500" />
          </NcButton>
        </div>
      </div>
    </template>

    <!-- Normal view -->
    <template v-else>
      <!-- Cover image -->
      <div
        v-if="attachments.length"
        class="-mt-2 -mx-3 mb-1 overflow-hidden rounded-t-md"
      >
        <img
          :src="getPossibleAttachmentSrc(attachments[0])"
          class="w-full h-40 object-cover"
          alt=""
        />
      </div>

      <div class="flex items-start gap-1.5 w-full">
        <div class="flex-1 min-w-0 flex flex-col gap-1.5">
          <template v-for="field in fieldsWithoutCover" :key="field.id">
            <div class="flex items-start gap-1 text-sm min-w-0">
              <LazySmartsheetVirtualCell
                v-if="isVirtualCol(field)"
                :model-value="row.row[field.title!]"
                :column="field"
                :row="row"
                :read-only="true"
                class="min-w-0 flex-1"
              />
              <LazySmartsheetCell
                v-else
                :model-value="row.row[field.title!]"
                :column="field"
                :row="row"
                :read-only="true"
                class="min-w-0 flex-1"
              />
            </div>
          </template>
        </div>

        <div
          v-if="!readOnly && isUIAllowed('dataEdit')"
          class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop
        >
          <NcButton
            size="xsmall"
            type="text"
            class="!h-6 !w-6 !min-w-6 !p-0"
            @click.stop="emits('expand')"
          >
            <component :is="iconMap.expand" class="h-3.5 w-3.5 text-gray-500" />
          </NcButton>
        </div>
      </div>
    </template>
  </div>
</template>
