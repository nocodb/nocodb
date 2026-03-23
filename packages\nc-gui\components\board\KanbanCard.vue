<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Row } from '#imports'
import {
  ActiveViewInj,
  FieldsInj,
  IsFormInj,
  IsPublicInj,
  MetaInj,
  ReloadViewDataHookInj,
  iconMap,
  inject,
  isDrawerOrModalExist,
  ref,
  useAttachment,
  useGlobal,
  useNocoEe,
  useRoles,
  useSmartsheetStoreOrThrow,
} from '#imports'

const props = defineProps<{
  row: Row
  fields: ColumnType[]
  readOnly?: boolean
  isSortable?: boolean
  compactMode?: boolean
}>()

const emits = defineEmits(['expand', 'deleteRow', 'unGroupRow', 'reorder'])

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { getPossibleAttachmentSrc, isImage } = useAttachment()

const { isSynced } = useNocoEe()

const isCompact = computed(() => props.compactMode)

const attachmentField = computed(() =>
  props.fields?.find((f) => f.uidt === UITypes.Attachment && (!isSynced.value || f.meta?.ag !== 'count')),
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

const primaryField = computed(() => props.fields?.find((f) => f.pv))

const fieldsExcludingPrimary = computed(() => fieldsWithoutCover.value?.filter((f) => !f.pv))

function expandCard() {
  if (!isDrawerOrModalExist()) {
    emits('expand')
  }
}
</script>

<template>
  <div
    :class="[
      'nc-kanban-item group relative flex flex-col rounded-md border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer',
      isCompact ? 'py-1 px-2' : 'py-3 px-3 gap-2',
    ]"
    @click="expandCard"
  >
    <template v-if="isCompact">
      <!-- Compact mode: single line with primary value -->
      <div class="flex items-center gap-1 min-h-[24px]">
        <div class="flex-1 min-w-0 text-xs text-gray-800 truncate leading-tight">
          <LazySmartsheetVirtualCell
            v-if="primaryField && isVirtualCol(primaryField)"
            :model-value="row.row[primaryField.title!]"
            :column="primaryField"
            :row="row"
            :read-only="true"
            class="!text-xs truncate"
          />
          <LazySmartsheetCell
            v-else-if="primaryField"
            :model-value="row.row[primaryField.title!]"
            :column="primaryField"
            :row="row"
            :read-only="true"
            class="!text-xs truncate"
          />
          <span v-else class="text-gray-400 italic text-xs">{{ $t('msg.noData') }}</span>
        </div>
        <div
          v-if="!readOnly"
          class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop
        >
          <NcButton
            size="xsmall"
            type="text"
            class="!h-5 !w-5 !min-w-5 !p-0"
            @click.stop="emits('expand')"
          >
            <component :is="iconMap.expand" class="h-3 w-3 text-gray-500" />
          </NcButton>
        </div>
      </div>
    </template>

    <template v-else>
      <!-- Cover image -->
      <div v-if="attachments.length" class="-mt-3 -mx-3 mb-2 overflow-hidden rounded-t-md">
        <img
          :src="getPossibleAttachmentSrc(attachments[0])"
          class="w-full h-32 object-cover"
          alt=""
        />
      </div>

      <!-- Fields -->
      <div class="flex items-start gap-1">
        <div class="flex-1 min-w-0">
          <template v-for="field in fieldsWithoutCover" :key="field.id">
            <div class="flex items-start gap-1 py-0.5">
              <div class="flex-1 min-w-0">
                <LazySmartsheetVirtualCell
                  v-if="isVirtualCol(field)"
                  :model-value="row.row[field.title!]"
                  :column="field"
                  :row="row"
                  :read-only="true"
                />
                <LazySmartsheetCell
                  v-else
                  :model-value="row.row[field.title!]"
                  :column="field"
                  :row="row"
                  :read-only="true"
                />
              </div>
            </div>
          </template>
        </div>

        <!-- Expand button -->
        <div
          v-if="!readOnly"
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
