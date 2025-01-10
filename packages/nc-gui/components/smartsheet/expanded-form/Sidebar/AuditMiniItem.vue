<script setup lang="ts">
import type { AuditType } from 'nocodb-sdk'

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

/* formatting */

function formatCurrency(value: string, currencyMeta: any) {
  if (!value) {
    return '"empty"'
  }

  return new Intl.NumberFormat(currencyMeta.currency_locale || 'en-US', {
    style: 'currency',
    currency: currencyMeta.currency_code || 'USD',
  }).format(Number(value))
}

/* attachment */

const { getPossibleAttachmentSrc } = useAttachment()

/* meta */

function normalizeMeta(meta: Record<string, any> | undefined) {
  return {
    ...(meta ?? {}),
    icon: meta?.icon
      ? {
          full: 'mdi-' + meta?.icon,
          empty: 'mdi-' + meta?.icon,
          checked: 'mdi-' + meta?.icon,
          unchecked: 'mdi-' + meta?.icon,
        }
      : undefined,
  }
}
</script>

<template>
  <div>
    <div v-for="columnKey of columnKeys" :key="columnKey" class="p-2">
      <div class="flex items-center gap-2">
        <SmartsheetHeaderCellIcon :column-meta="{ uidt: meta[columnKey]?.field_type }" />
        {{ columnKey }}
      </div>
      <div class="flex items-center gap-2 mt-2 flex-wrap">
        <template v-if="meta[columnKey]?.field_type === 'Attachment'">
          <div class="text-sm text-red-500 border-1 border-red-500 rounded-md px-1 py-1 bg-red-50 w-full">
            <template v-if="!oldData[columnKey]?.length"> 0 files </template>
            <template v-else>
              <div class="flex flex-col items-start gap-2">
                <template v-for="(item, i) of oldData[columnKey]" :key="item.url || item.title">
                  <div class="flex items-center gap-2 w-full">
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
                    <span class="w-0 flex-1 truncate text-xs">
                      {{ item.title }}
                    </span>
                  </div>
                </template>
              </div>
            </template>
          </div>
          <div class="text-sm text-green-700 border-1 border-green-500 rounded-md px-1 py-1 bg-green-50 w-full">
            <template v-if="!newData[columnKey]?.length"> 0 files </template>
            <template v-else>
              <div class="flex flex-col items-start gap-2">
                <template v-for="(item, i) of newData[columnKey]" :key="item.url || item.title">
                  <div class="flex items-center gap-2 w-full">
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
                    <span class="w-0 flex-1 truncate text-xs">
                      {{ item.title }}
                    </span>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </template>
        <template v-else-if="meta[columnKey]?.field_type === 'LongText'">
          <div class="text-sm text-red-500 border-1 border-red-500 rounded-md px-1 py-0.25 bg-red-50 line-through">
            {{ oldData[columnKey] ?? 'empty' }}
          </div>
          <div class="text-sm text-green-700 border-1 border-green-500 rounded-md px-1 py-0.25 bg-green-50">
            {{ newData[columnKey] ?? 'empty' }}
          </div>
        </template>
        <template v-else>
          <div class="nc-audit-mini-item-cell text-sm text-red-500 border-1 border-red-500 rounded-md px-1 py-0.25 bg-red-50 line-through">
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
          </div>
          <div class="nc-audit-mini-item-cell text-sm text-green-700 border-1 border-green-500 rounded-md px-1 py-0.25 bg-green-50">
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
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-audit-mini-item-cell :deep(.nc-cell-checkbox > div:first-child) {
  @apply pl-0;
}
.nc-audit-mini-item-cell :deep(.nc-cell-field.nc-multi-select > div) {
  @apply !gap-1 !flex;
  & > span {
    @apply !m-0;
  }
}
.nc-audit-mini-item-cell :deep(.nc-cell-field.nc-single-select > div) {
  & > span {
    @apply !m-0;
  }
}
</style>
