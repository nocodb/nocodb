<script setup lang="ts">
import type { AttachmentType, AuditType } from 'nocodb-sdk'

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

/* provides */

provide(RawReadonlyInj, ref(true))

/* attachment */

const { getPossibleAttachmentSrc } = useAttachment()

/* meta processing */

function normalizeColOptions(key: string) {
  return {
    ...(meta.value?.[key]?.options ?? {}),
    options: meta.value?.[key]?.options?.choices,
  }
}

function normalizeMeta(key: string) {
  const mta = meta.value?.[key] ?? {}
  const opts = normalizeColOptions(key)
  const icn =
    {
      'thumbs-up': 'thumb-up',
      'circle-filled': 'moon-full',
      'circle-check': 'check-circle-outline',
    }[opts.icon as string] ??
    (opts.icon || (mta.type === 'Rating' ? 'star' : 'check-circle'))
  return {
    ...opts,
    ...mta,
    icon: !icn
      ? undefined
      : {
          full: `mdi-${icn}`,
          empty: `mdi-${icn}`,
          checked: `mdi-${icn}`,
          unchecked: `mdi-${icn}`,
        },
    duration: opts.duration_format ? durationOptions.find((it) => it.title === opts.duration_format)?.id : undefined,
    is12hrFormat: opts['12hr_format'],
    isLocaleString: opts.locale_string,
  }
}

function processOldDataFor(key: string) {
  const odata = oldData.value[key]
  const ndata = newData.value[key]

  if (meta.value?.[key]?.type === 'Attachment') {
    return odata?.filter((it: AttachmentType) => !ndata?.some((t: AttachmentType) => t.title === it.title))
  }
  if (meta.value?.[key]?.type === 'MultiSelect') {
    return odata?.filter?.((it: string) => !ndata?.includes?.(it)) ?? odata
  }

  return odata
}

function processNewDataFor(key: string) {
  const odata = oldData.value[key]
  const ndata = newData.value[key]

  if (meta.value?.[key]?.type === 'Attachment') {
    return ndata?.filter((it: AttachmentType) => !odata?.some((t: AttachmentType) => t.title === it.title))
  }
  if (meta.value?.[key]?.type === 'MultiSelect') {
    return ndata?.filter?.((it: string) => !odata?.includes?.(it)) ?? ndata
  }

  return ndata
}

function shouldUseNormalizedPadding(key: string) {
  return !['Checkbox', 'SingleSelect', 'MultiSelect', 'User'].includes(meta.value?.[key]?.type) && !normalizeMeta(key).is_progress
}

function shouldUseUniformPadding(key: string) {
  return ['SingleSelect', 'MultiSelect', 'User'].includes(meta.value?.[key]?.type)
}

/* visibility */

function isShowableValue(value: any) {
  return ![undefined, null, ''].includes(value)
}
</script>

<template>
  <div v-for="columnKey in columnKeys" :key="columnKey" class="relative not-last:mb-4">
    <GeneralIcon
      icon="ncNode"
      class="w-[16px] h-[16px] text-gray-500 bg-white absolute left-0 transform -translate-x-1/2"
      :class="[
        ['JSON', 'Attachment', 'SingleLineText', 'LongText'].includes(meta[columnKey]?.type)
          ? 'top-1'
          : 'top-1/2 -translate-y-2/5',
      ]"
    />
    <div class="ml-6.5">
      <div class="text-[13px] font-weight-500 inline-flex items-center flex-wrap">
        <span class="text-gray-600 text-xs"> changed </span>
        <span class="rounded-md px-1 !h-[20px] bg-gray-200 inline-flex items-center gap-1 mx-1">
          <SmartsheetHeaderCellIcon
            :column-meta="{ uidt: meta[columnKey]?.type, dt: meta[columnKey]?.type === 'Number' ? 'bigint' : undefined }"
            class="!w-[16px] !h-[16px] !m-0 !text-gray-600"
          />
          <span class="text-[13px] font-weight-500 text-gray-600">
            {{ columnKey }}
          </span>
        </span>
        <template v-if="meta[columnKey]?.type === 'Attachment'">
          <div v-if="processOldDataFor(columnKey)?.length > 0" class="w-full mt-1">
            <div class="border-1 border-red-200 rounded-md bg-red-50 p-0.5 flex flex-col items-start gap-0.5 w-[284px]">
              <div
                v-for="(item, i) of processOldDataFor(columnKey)"
                :key="item.url || item.title"
                class="border-1 border-gray-200 rounded-md bg-white w-full"
              >
                <div class="flex items-center gap-2 w-full">
                  <div class="flex items-center justify-center w-8 aspect-square">
                    <LazyCellAttachmentPreviewImage
                      v-if="isImage(item.title, item.mimetype ?? item.type)"
                      :alt="item.title || `#${i}`"
                      class="nc-attachment rounded !w-5.5 !h-5.5 object-cover overflow-hidden"
                      :srcs="getPossibleAttachmentSrc(item, 'small')"
                    />
                    <div v-else class="nc-attachment flex items-center justify-center">
                      <CellAttachmentIconView :item="item" class="!w-8 !h-8" />
                    </div>
                  </div>
                  <span class="w-0 flex-1 truncate text-[13px] font-weight-500 text-gray-600">
                    {{ item.title }}
                  </span>
                  <span class="text-xs font-weight-500 p-2 text-gray-500">
                    {{ getReadableFileSize(item.size) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="processNewDataFor(columnKey)?.length > 0" class="w-full mt-1">
            <div class="border-1 border-green-200 rounded-md bg-green-50 p-0.5 flex flex-col items-start gap-0.5 w-[284px]">
              <div
                v-for="(item, i) of processNewDataFor(columnKey)"
                :key="item.url || item.title"
                class="border-1 border-gray-200 rounded-md bg-white w-full"
              >
                <div class="flex items-center gap-2 w-full">
                  <div class="flex items-center justify-center w-8 aspect-square">
                    <LazyCellAttachmentPreviewImage
                      v-if="isImage(item.title, item.mimetype ?? item.type)"
                      :alt="item.title || `#${i}`"
                      class="nc-attachment rounded !w-5.5 !h-5.5 object-cover overflow-hidden"
                      :srcs="getPossibleAttachmentSrc(item, 'small')"
                    />
                    <div v-else class="nc-attachment flex items-center justify-center">
                      <CellAttachmentIconView :item="item" class="!w-8 !h-8" />
                    </div>
                  </div>
                  <span class="w-0 flex-1 truncate text-[13px] font-weight-500 text-gray-600">
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
        <template v-else-if="['SingleLineText', 'LongText'].includes(meta[columnKey]?.type)">
          <template v-for="(block, i) of diffTextBlocks(oldData[columnKey] || '', newData[columnKey] || '')" :key="i">
            <span
              v-if="block.op === 'removed'"
              class="text-red-700 border-1 border-red-200 rounded-md px-1 mr-1 bg-red-50 line-through decoration-clone !leading-[18px] my-0.5"
            >
              {{ block.text }}
            </span>
            <span
              v-else-if="block.op === 'added'"
              class="text-green-700 border-1 border-green-200 rounded-md px-1 mr-1 bg-green-50 decoration-clone !leading-[18px] my-0.5"
            >
              {{ block.text }}
            </span>
            <span v-else class="mr-1 !leading-[18px] my-0.5">
              {{ block.text }}
            </span>
          </template>
        </template>
        <template v-else-if="meta[columnKey]?.type === 'JSON'">
          <div class="w-full flex justify-start">
            <pre
              v-if="isShowableValue(processOldDataFor(columnKey))"
              class="!text-red-700 border-1 border-red-200 rounded-md bg-red-50 line-through !mb-0 mt-1 p-1 max-w-2/5"
              >{{ processOldDataFor(columnKey) }}</pre
            >
          </div>
          <div class="w-full flex justify-start">
            <pre
              v-if="isShowableValue(processNewDataFor(columnKey))"
              class="!text-green-700 border-1 border-green-200 rounded-md bg-green-50 !mb-0 mt-1 p-1 max-w-2/5"
              >{{ processNewDataFor(columnKey) }}</pre
            >
          </div>
        </template>
        <template v-else>
          <div
            v-if="isShowableValue(processOldDataFor(columnKey))"
            class="nc-expressive-mini-item-cell nc-audit-removal !text-red-700 border-1 mr-1 border-red-200 rounded-md bg-red-50 line-through"
            :class="{
              'px-1 py-0': shouldUseNormalizedPadding(columnKey),
              '!px-0.25 !py-0.25': shouldUseUniformPadding(columnKey),
            }"
          >
            <SmartsheetCell
              :column="{
                uidt: meta[columnKey]?.type,
                dt: meta[columnKey]?.type === 'Number' ? 'bigint' : undefined,
                meta: normalizeMeta(columnKey),
                colOptions: normalizeColOptions(columnKey),
              }"
              :model-value="processOldDataFor(columnKey)"
              :edit-enabled="false"
              :read-only="true"
              class="!text-red-700"
              :class="{
                'min-w-[100px]': normalizeMeta(columnKey).is_progress,
              }"
            />
          </div>
          <div
            v-if="isShowableValue(processNewDataFor(columnKey))"
            class="nc-expressive-mini-item-cell nc-audit-addition border-1 border-green-200 rounded-md bg-green-50"
            :class="{
              'px-1 py-0': shouldUseNormalizedPadding(columnKey),
              '!px-0.25 !py-0.25': shouldUseUniformPadding(columnKey),
            }"
          >
            <SmartsheetCell
              :column="{
                uidt: meta[columnKey]?.type,
                dt: meta[columnKey]?.type === 'Number' ? 'bigint' : undefined,
                meta: normalizeMeta(columnKey),
                colOptions: normalizeColOptions(columnKey),
              }"
              :model-value="processNewDataFor(columnKey)"
              :edit-enabled="false"
              :read-only="true"
              class="!text-green-700"
              :class="{
                'min-w-[100px]': normalizeMeta(columnKey).is_progress,
              }"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-expressive-mini-item-cell :deep(.nc-cell-checkbox > div:first-child) {
  @apply pl-0;
}
.nc-expressive-mini-item-cell :deep(.nc-cell-field.nc-multi-select > div) {
  @apply !gap-1 !flex;
  & > span {
    @apply !m-0 flex items-center h-[18px];
  }
}
.nc-expressive-mini-item-cell :deep(.nc-cell-field.nc-single-select > div) {
  height: 20px !important;
  .ant-tag {
    height: 20px !important;
    @apply !m-0;
  }
}
.nc-expressive-mini-item-cell.nc-audit-removal :deep(.nc-cell-field.nc-multi-select > div) {
  span.ant-tag span.text-ellipsis {
    @apply line-through;
  }
}
.nc-expressive-mini-item-cell.nc-audit-removal :deep(.nc-cell-field.nc-single-select > div) {
  span.ant-tag span.text-ellipsis {
    @apply line-through;
  }
}
.nc-expressive-mini-item-cell :deep(.nc-cell-rating .ant-rate) {
  @apply !p-0 transform -translate-y-[1px];
}
.nc-expressive-mini-item-cell :deep(.nc-cell-percent) {
  & > div > div {
    @apply !p-0;
    &,
    & * {
      height: 6px !important;
    }
    .ant-progress-inner {
      transform: translateY(-9px) !important;
    }
  }
}
.nc-expressive-mini-item-cell :deep(.nc-cell-datetime) {
  .nc-date-picker {
    @apply !inline;
    & > div {
      @apply !inline;
    }
    & > div + div {
      @apply !ml-1;
    }
  }
}
.nc-expressive-mini-item-cell.nc-audit-removal :deep(.nc-cell-time) {
  .nc-time-picker span {
    text-decoration: line-through;
  }
}
.nc-expressive-mini-item-cell.nc-audit-removal :deep(.nc-cell-year) {
  .nc-year-picker span {
    text-decoration: line-through;
  }
}
.nc-expressive-mini-item-cell.nc-audit-removal :deep(.nc-cell-date) {
  .nc-date-picker span {
    text-decoration: line-through;
  }
}
.nc-expressive-mini-item-cell :deep(.nc-cell-user) {
  .nc-cell-field > div {
    display: flex !important;
    & > .ant-tag {
      @apply !m-0 !text-inherit !border-1 !border-gray-300 !pr-1 !pl-0.5 !bg-gray-100 !rounded-[17px];
      & > span > div + div {
        @apply flex items-center !text-[13px] font-weight-500 !leading-[16px];
      }
      & > span {
        @apply gap-1;
      }
    }
    .nc-user-avatar {
      @apply border-1 border-nc-gray-medium;
      height: 16px !important;
      width: 16px !important;
    }
  }
}
.nc-expressive-mini-item-cell.nc-audit-removal :deep(.nc-cell-user) {
  .ant-tag > span > div + div {
    @apply !text-red-700;
  }
}
.nc-expressive-mini-item-cell.nc-audit-addition :deep(.nc-cell-user) {
  .ant-tag > span > div + div {
    @apply !text-green-700;
  }
}
</style>

<style lang="scss">
.nc-expressive-mini-item-header {
  svg {
    height: 12px;
  }
}
.nc-expressive-mini-item-cell:has(.nc-cell-user .ant-tag) {
  @apply !p-0.25;
  .nc-cell-field > div {
    @apply gap-1;
  }
}
.nc-expressive-mini-item-cell.nc-audit-removal:has(.nc-cell-user) {
  text-decoration: none;
  .ant-tag div + div {
    text-decoration: line-through;
  }
}
.nc-expressive-mini-item-cell :where(.nc-cell-email, .nc-cell-url, .nc-cell-phonenumber) a {
  @apply text-inherit !no-underline !p-0;
}
.nc-expressive-mini-item-cell :where(.nc-cell-email, .nc-cell-url, .nc-cell-phonenumber) {
  @apply !h-[20px];
}
.nc-expressive-mini-item-cell :where(.nc-cell-email, .nc-cell-url, .nc-cell-phonenumber) span {
  @apply !text-[13px] !leading-[16px];
}
.nc-expressive-mini-item-cell .nc-cell-url > div > span {
  width: auto !important;
}
.nc-expressive-mini-item-cell.nc-audit-removal :where(.nc-cell-email, .nc-cell-url, .nc-cell-phonenumber) a {
  @apply !line-through !p-0;
}
.nc-expressive-mini-item-cell.nc-audit-removal :where(.nc-year-picker, .nc-time-picker, .nc-date-picker) {
  @apply !line-through;
}
.nc-expressive-mini-item-cell :where(.nc-cell-year, .nc-cell-time, .nc-cell-datetime, .nc-cell-date) span {
  @apply !text-[13px] !leading-[16px];
}
.nc-expressive-mini-item-cell.nc-expressive-mini-item-cell.nc-expressive-mini-item-cell.nc-expressive-mini-item-cell
  :where(
    .nc-cell.nc-cell-percent .nc-cell-field,
    .nc-cell.nc-cell-duration .nc-cell-field,
    .nc-cell.nc-cell-currency .nc-cell-field,
    .nc-cell.nc-cell-decimal .nc-cell-field,
    .nc-cell.nc-cell-geometry .nc-cell-field,
    .nc-cell.nc-cell-number .nc-cell-field
  ) {
  font-size: 13px !important;
  line-height: 16px !important;
}
.nc-expressive-mini-item-cell .nc-cell-field:not(.nc-single-select, .nc-multi-select),
.nc-expressive-mini-item-cell .nc-cell:not(.nc-cell-singleselect, .nc-cell-multiselect) {
  @apply flex items-center h-[20px];
}
.nc-expressive-mini-item-cell
  .nc-cell
  :where(.nc-cell-field, input, textarea, .nc-cell-field-link):not(.ant-select-selection-search-input) {
  font-size: unset;
  line-height: unset;
}
</style>
