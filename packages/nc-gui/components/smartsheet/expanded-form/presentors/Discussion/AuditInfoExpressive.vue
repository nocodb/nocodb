<script setup lang="ts">
import type { AuditType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  audit: AuditType
}>()

const details = computed(() => {
  try {
    return JSON.parse(props.audit.details || '')
  } catch (e) {
    return {}
  }
})

const oldData = computed(() => {
  return details.value.old_data ?? {}
})

const newData = computed(() => {
  return details.value.data ?? {}
})

const meta = computed(() => {
  return details.value.column_meta ?? {}
})

const columnKeys = computed(() => {
  return Object.keys(newData.value)
})

/* attachment */

const { getPossibleAttachmentSrc } = useAttachment()

/* meta */

function normalizeMeta(meta: Record<string, any> | undefined) {
  return {
    ...(meta ?? {}),
    icon: meta?.icon
      ? {
          full: `mdi-${meta?.icon}`,
          empty: `mdi-${meta?.icon}`,
          checked: `mdi-${meta?.icon}`,
          unchecked: `mdi-${meta?.icon}`,
        }
      : undefined,
  }
}
</script>

<template>
  <div v-for="columnKey in columnKeys" :key="columnKey" class="relative mb-2">
    <GeneralIcon icon="ncLink" class="w-[12px] h-[12px] text-gray-500 absolute top-[6px] left-0 transform -translate-x-1/2" />
    <div class="mb-1 ml-6.5">
      <div
        class="text-sm"
        :class="{
          'inline-flex items-center': meta[columnKey]?.field_type !== 'LongText',
        }"
      >
        changed
        <span
          class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 bg-gray-200 inline-flex items-center gap-1 ml-2 mr-3"
        >
          <SmartsheetHeaderCellIcon :column-meta="{ uidt: meta[columnKey]?.field_type }" class="!w-[12px] !h-[12px] !m-0" />
          {{ columnKey }}
        </span>
        <template v-if="meta[columnKey]?.field_type === 'Attachment'">
          <span class="text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 inline-flex items-center gap-1 line-through">
            <template v-if="!oldData[columnKey]?.length"> 0 files </template>
            <template v-else>
              <div class="flex items-center gap-1">
                <template v-for="(item, i) of oldData[columnKey]" :key="item.url || item.title">
                  <div class="w-8 aspect-square">
                    <LazyCellAttachmentPreviewImage
                      v-if="isImage(item.title, item.mimetype ?? item.type)"
                      :alt="item.title || `#${i}`"
                      class="nc-attachment rounded-lg w-full h-full object-cover overflow-hidden"
                      :srcs="getPossibleAttachmentSrc(item, 'small')"
                    />
                    <div v-else class="nc-attachment h-full w-full flex items-center justify-center">
                      <CellAttachmentIconView :item="item" class="max-h-full max-w-full" />
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </span>
          <span class="ml-2 text-xs"> to </span>
          <span class="ml-2 text-xs border-1 border-gray-300 rounded-md px-1 py-0.25 inline-flex items-center gap-1">
            <template v-if="!newData[columnKey]?.length"> 0 files </template>
            <template v-else>
              <div class="flex items-center gap-1">
                <template v-for="(item, i) of newData[columnKey]" :key="item.url || item.title">
                  <div class="w-8 aspect-square">
                    <LazyCellAttachmentPreviewImage
                      v-if="isImage(item.title, item.mimetype ?? item.type)"
                      :alt="item.title || `#${i}`"
                      class="nc-attachment rounded-lg w-full h-full object-cover overflow-hidden"
                      :srcs="getPossibleAttachmentSrc(item, 'small')"
                    />
                    <div v-else class="nc-attachment h-full w-full flex items-center justify-center">
                      <CellAttachmentIconView :item="item" class="max-h-full max-w-full" />
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </span>
        </template>
        <template v-else-if="meta[columnKey]?.field_type === 'LongText'">
          <span class="line-through">
            {{ oldData[columnKey] ?? 'empty' }}
          </span>
          <span class="mx-2"> to </span>
          <span>
            {{ newData[columnKey] ?? 'empty' }}
          </span>
        </template>
        <template v-else>
          <span class="inline-flex items-center">
            <span class="line-through">
              <span v-if="!oldData[columnKey]"> empty </span>
              <SmartsheetCell
                v-else
                :column="{
                  uidt: meta[columnKey]?.field_type,
                  meta: normalizeMeta(meta[columnKey]?.meta),
                  colOptions: meta[columnKey]?.col_options,
                }"
                :model-value="oldData[columnKey]"
                :edit-enabled="false"
                :read-only="true"
                :class="{
                  'min-w-[100px]': meta[columnKey]?.field_type === 'Percent',
                }"
              />
            </span>
            <span class="mx-2"> to </span>
            <span>
              <span v-if="!newData[columnKey]"> empty </span>
              <SmartsheetCell
                v-else
                :column="{
                  uidt: meta[columnKey]?.field_type,
                  meta: normalizeMeta(meta[columnKey]?.meta),
                  colOptions: meta[columnKey]?.col_options,
                }"
                :model-value="newData[columnKey]"
                :edit-enabled="false"
                :read-only="true"
                :class="{
                  'min-w-[100px]': meta[columnKey]?.field_type === 'Percent',
                }"
              />
            </span>
          </span>
        </template>
      </div>
    </div>
  </div>
</template>
