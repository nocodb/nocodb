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

/* attachment */

const { getPossibleAttachmentSrc } = useAttachment()

/* meta */

function normalizeColOptions(key: string) {
  return {
    ...(meta.value?.[key]?.options ?? {}),
    options: meta.value?.[key]?.options?.choices,
  };
}

function normalizeMeta(key: string) {
  const mta = meta.value?.[key] ?? {};
  const opts = normalizeColOptions(key);
  return {
    ...opts,
    ...mta,
    icon: !opts.icon ? undefined : {
      full: 'mdi-' + opts.icon,
      empty: 'mdi-' + opts.icon,
      checked: 'mdi-' + opts.icon,
      unchecked: 'mdi-' + opts.icon,
    },
    duration: opts.duration_format ? durationOptions.find(it => it.title === opts.duration_format)?.id : undefined,
  }
}

/* visibility */

function isShowableValue(value: any) {
  return ![ undefined, null, '' ].includes(value);
}

function shouldShowRaw(key: string) {
  return [ 'SingleLineText', 'LongText', 'URL', 'PhoneNumber', 'Email' ].includes(meta.value?.[key]?.type);
}

</script>

<template>
  <div v-for="columnKey of columnKeys" :key="columnKey" class="py-2 px-3">
    <div class="flex items-center gap-2 !text-gray-600 text-xs nc-audit-mini-item-header">
      <SmartsheetHeaderCellIcon :column-meta="{ uidt: meta[columnKey]?.type }" class="!m-0" />
      {{ columnKey }}
    </div>
    <!-- <pre v-if="meta[columnKey]?.type !== 'Duration'">{{ [ normalizeColOptions(columnKey), normalizeMeta(columnKey) ] }}</pre> -->
    <div class="flex items-center gap-2 mt-3 flex-wrap">
      <template v-if="meta[columnKey]?.type === 'Attachment'">
        <div v-if="oldData[columnKey]?.length > 0" class="border-1 border-red-500 rounded-md bg-red-50 w-full p-0.5">
          <div class="flex flex-col items-start gap-0.5">
            <div v-for="(item, i) of oldData[columnKey]" :key="item.url || item.title" class="border-1 border-gray-200 rounded-md bg-white w-full">
              <div class="flex items-center gap-2 w-full">
                <div class="aspect-square">
                  <LazyCellAttachmentPreviewImage
                    v-if="isImage(item.title, item.mimetype ?? item.type)"
                    :alt="item.title || `#${i}`"
                    class="nc-attachment rounded-lg w-full h-full object-cover overflow-hidden"
                    :srcs="getPossibleAttachmentSrc(item, 'small')"
                  />
                  <div v-else class="nc-attachment flex items-center justify-center">
                    <CellAttachmentIconView :item="item" class="!w-8 !h-8" />
                  </div>
                </div>
                <span class="w-0 flex-1 truncate text-sm font-weight-500 text-gray-600">
                  {{ item.title }}
                </span>
                <span class="text-xs font-weight-500 p-2 text-gray-500">
                  {{ getReadableFileSize(item.size) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="newData[columnKey]?.length > 0" class="border-1 border-green-500 rounded-md bg-green-50 w-full p-0.5">
          <div class="flex flex-col items-start gap-0.5">
            <div v-for="(item, i) of newData[columnKey]" :key="item.url || item.title" class="border-1 border-gray-200 rounded-md bg-white w-full">
              <div class="flex items-center gap-2 w-full">
                <div class="flex items-center justify-center w-8 aspect-square">
                  <LazyCellAttachmentPreviewImage
                    v-if="isImage(item.title, item.mimetype ?? item.type)"
                    :alt="item.title || `#${i}`"
                    class="nc-attachment rounded !w-5.5 !h-5.5 object-cover overflow-hidden"
                    :srcs="getPossibleAttachmentSrc(item, 'small')"
                  />
                  <div v-else class="nc-attachment h-full w-full flex items-center justify-center">
                    <CellAttachmentIconView :item="item" class="!w-8 !h-8" />
                  </div>
                </div>
                <span class="w-0 flex-1 truncate text-sm font-weight-500 text-gray-600">
                  {{ item.title }}
                </span>
                <span class="text-xs font-weight-500 p-2 text-gray-500">
                  {{ getReadableFileSize(item.size) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="shouldShowRaw(columnKey)">
        <div v-if="isShowableValue(oldData[columnKey])" class="text-sm text-red-700 border-1 border-red-200 rounded-md px-1 bg-red-50 line-through">
          {{ oldData[columnKey] }}
        </div>
        <div v-if="isShowableValue(newData[columnKey])" class="text-sm text-green-700 border-1 border-green-200 rounded-md px-1 bg-green-50">
          {{ newData[columnKey] }}
        </div>
      </template>
      <template v-else-if="meta[columnKey]?.type === 'JSON'">
        <div v-if="isShowableValue(oldData[columnKey])" class="text-sm text-red-700 border-1 border-red-200 rounded-md px-1 bg-red-50 line-through w-full">
          <pre class="!m-0">{{ oldData[columnKey] }}</pre>
        </div>
        <div v-if="isShowableValue(newData[columnKey])" class="text-sm text-green-700 border-1 border-green-200 rounded-md px-1 bg-green-50 w-full">
          <pre class="!m-0">{{ newData[columnKey] }}</pre>
        </div>
      </template>
      <template v-else>
        <div
          v-if="isShowableValue(oldData[columnKey])"
          class="nc-audit-mini-item-cell nc-audit-removal !text-red-700 border-1 border-red-200 rounded-md bg-red-50 line-through"
          :class="{
            'px-1 py-0.25': !['Checkbox', 'SingleSelect', 'MultiSelect'].includes(meta[columnKey]?.type) && !normalizeMeta(columnKey).is_progress,
            '!p-0.25': ['SingleSelect'].includes(meta[columnKey]?.type),
            '!p-0.75 w-full': ['MultiSelect'].includes(meta[columnKey]?.type),
          }">
          <SmartsheetCell
            :column="{
              uidt: meta[columnKey]?.type,
              meta: normalizeMeta(columnKey),
              colOptions: normalizeColOptions(columnKey),
            }"
            :model-value="oldData[columnKey]"
            :edit-enabled="false"
            :read-only="true"
            :class="{
              'min-w-[100px]': normalizeMeta(columnKey).is_progress,
            }"
            class="!text-red-700"
          />
        </div>
        <div
          v-if="isShowableValue(newData[columnKey])"
          class="nc-audit-mini-item-cell nc-audit-addition border-1 border-green-200 rounded-md bg-green-50"
          :class="{
            'px-1 py-0.25': !['Checkbox', 'SingleSelect', 'MultiSelect'].includes(meta[columnKey]?.type) && !normalizeMeta(columnKey).is_progress,
            '!p-0.25': ['SingleSelect'].includes(meta[columnKey]?.type),
            '!p-0.75 w-full': ['MultiSelect'].includes(meta[columnKey]?.type),
          }">
          <SmartsheetCell
            :column="{
              uidt: meta[columnKey]?.type,
              meta: normalizeMeta(columnKey),
              colOptions: normalizeColOptions(columnKey),
            }"
            :model-value="newData[columnKey]"
            :edit-enabled="false"
            :read-only="true"
            :class="{
              'min-w-[100px]': normalizeMeta(columnKey).is_progress,
            }"
            class="!text-green-700"
          />
        </div>
      </template>
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
    @apply !m-0 h-[22px] flex items-center;
  }
}
.nc-audit-mini-item-cell :deep(.nc-cell-field.nc-single-select > div) {
  height: 19.4px;
  & > span {
    @apply !m-0;
  }
}
.nc-audit-mini-item-cell :deep(.nc-cell-rating .ant-rate) {
  @apply !p-0;
}
.nc-audit-mini-item-cell :deep(.nc-cell-percent) {
  & > div > div {
    @apply !p-0;
    &, & * {
      height: 6px !important;
    }
    .ant-progress-inner {
      transform: translateY(-9px) !important;
    }
  }
}
.nc-audit-mini-item-cell :deep(.nc-cell-user) {
  .nc-cell-field > div {
    display: flex !important;
    & > .ant-tag {
      @apply !m-0 !p-0 !bg-transparent !text-inherit;
      & > span > div + div {
        @apply flex items-center !text-sm font-weight-500;
      }
      & > span {
        @apply gap-1;
      }
    }
    .nc-user-avatar {
      @apply border-1 border-nc-gray-medium;
      height: 24px !important;
      width: 24px !important;
    }
  }
}
.nc-audit-mini-item-cell.nc-audit-removal :deep(.nc-cell-user) {
  .ant-tag > span > div + div {
    @apply !text-red-700;
  }
}
.nc-audit-mini-item-cell.nc-audit-addition :deep(.nc-cell-user) {
  .ant-tag > span > div + div {
    @apply !text-green-700;
  }
}
:deep(.nc-audit-mini-item-header) {
  svg {
    height: 12px;
  }
}
</style>
