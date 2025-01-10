<script setup lang="ts">
import type { AttachmentType, AuditType } from 'nocodb-sdk'

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

provide(RawReadonlyInj, ref(true));

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
  const icn = {
    'thumbs-up': 'thumb-up',
    'circle-filled': 'moon-full',
  }[opts.icon as string] ?? opts.icon;
  return {
    ...opts,
    ...mta,
    icon: !icn ? undefined : {
      full: 'mdi-' + icn,
      empty: 'mdi-' + icn,
      checked: 'mdi-' + icn,
      unchecked: 'mdi-' + icn,
    },
    duration: opts.duration_format ? durationOptions.find(it => it.title === opts.duration_format)?.id : undefined,
    is12hrFormat: opts['12hr_format'],
    isLocaleString: opts.locale_string,
  }
}

function processOldDataFor(key: string) {

  const odata = oldData.value[key];
  const ndata = newData.value[key];

  if (meta.value?.[key]?.type === 'Attachment') {
    return odata?.filter((it: AttachmentType) => !ndata?.some((t: AttachmentType) => t.title === it.title));
  }
  if (meta.value?.[key]?.type === 'MultiSelect') {
    return odata?.filter?.((it: string) => !ndata?.includes?.(it)) ?? odata;
  }

  return odata;

}

function processNewDataFor(key: string) {

  const odata = oldData.value[key];
  const ndata = newData.value[key];

  if (meta.value?.[key]?.type === 'Attachment') {
    return ndata?.filter((it: AttachmentType) => !odata?.some((t: AttachmentType) => t.title === it.title));
  }
  if (meta.value?.[key]?.type === 'MultiSelect') {
    return ndata?.filter?.((it: string) => !odata?.includes?.(it)) ?? ndata;
  }

  return ndata;

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
      <SmartsheetHeaderCellIcon :column-meta="{ uidt: meta[columnKey]?.type, dt: meta[columnKey]?.type === 'Number' ? 'bigint' : undefined }" class="!m-0" />
      {{ columnKey }}
    </div>
    <div class="flex items-center gap-2 mt-3 flex-wrap">
      <template v-if="meta[columnKey]?.type === 'Attachment'">
        <div v-if="processOldDataFor(columnKey)?.length > 0" class="border-1 border-red-500 rounded-md bg-red-50 w-full p-0.5">
          <div class="flex flex-col items-start gap-0.5">
            <div v-for="(item, i) of processOldDataFor(columnKey)" :key="item.url || item.title" class="border-1 border-gray-200 rounded-md bg-white w-full">
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
        <div v-if="processNewDataFor(columnKey)?.length > 0" class="border-1 border-green-500 rounded-md bg-green-50 w-full p-0.5">
          <div class="flex flex-col items-start gap-0.5">
            <div v-for="(item, i) of processNewDataFor(columnKey)" :key="item.url || item.title" class="border-1 border-gray-200 rounded-md bg-white w-full">
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
        <div v-if="isShowableValue(oldData[columnKey])" class="text-sm text-red-700 border-1 border-red-200 rounded-md px-1 bg-red-50 line-through break-all">
          {{ oldData[columnKey] }}
        </div>
        <div v-if="isShowableValue(newData[columnKey])" class="text-sm text-green-700 border-1 border-green-200 rounded-md px-1 bg-green-50 break-all">
          {{ newData[columnKey] }}
        </div>
      </template>
      <template v-else-if="meta[columnKey]?.type === 'JSON'">
        <div v-if="isShowableValue(oldData[columnKey])" class="text-sm text-red-700 border-1 border-red-200 rounded-md px-1 bg-red-50 line-through w-full">
          <pre class="!m-0 nc-scrollbar-thin">{{ oldData[columnKey] }}</pre>
        </div>
        <div v-if="isShowableValue(newData[columnKey])" class="text-sm text-green-700 border-1 border-green-200 rounded-md px-1 bg-green-50 w-full">
          <pre class="!m-0 nc-scrollbar-thin">{{ newData[columnKey] }}</pre>
        </div>
      </template>
      <template v-else>
        <div
          v-if="isShowableValue(processOldDataFor(columnKey))"
          class="nc-audit-mini-item-cell nc-audit-removal !text-red-700 border-1 border-red-200 rounded-md bg-red-50 line-through"
          :class="{
            'px-1 py-0.25': !['Checkbox', 'SingleSelect', 'MultiSelect'].includes(meta[columnKey]?.type) && !normalizeMeta(columnKey).is_progress,
            '!p-0.25': ['SingleSelect', 'MultiSelect'].includes(meta[columnKey]?.type),
          }">
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
            :class="{
              'min-w-[100px]': normalizeMeta(columnKey).is_progress,
            }"
            class="!text-red-700"
          />
        </div>
        <div
          v-if="isShowableValue(processNewDataFor(columnKey))"
          class="nc-audit-mini-item-cell nc-audit-addition border-1 border-green-200 rounded-md bg-green-50"
          :class="{
            'px-1 py-0.25': !['Checkbox', 'SingleSelect', 'MultiSelect'].includes(meta[columnKey]?.type) && !normalizeMeta(columnKey).is_progress,
            '!p-0.25': ['SingleSelect', 'MultiSelect'].includes(meta[columnKey]?.type),
          }">
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
    @apply !m-0 flex items-center h-[22px];
  }
}
.nc-audit-mini-item-cell :deep(.nc-cell-field.nc-single-select > div) {
  height: 20px !important;
  & > span {
    @apply !m-0;
  }
}
.nc-audit-mini-item-cell.nc-audit-removal :deep(.nc-cell-field.nc-multi-select > div) {
  span.ant-tag span.text-ellipsis {
    @apply line-through;
  }
}
.nc-audit-mini-item-cell.nc-audit-removal :deep(.nc-cell-field.nc-single-select > div) {
  span.ant-tag span.text-ellipsis {
    @apply line-through;
  }
}
.nc-audit-mini-item-cell :deep(.nc-cell-rating .ant-rate) {
  @apply !p-0 transform -translate-y-[2px];
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
.nc-audit-mini-item-cell :deep(.nc-cell-datetime) {
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
.nc-audit-mini-item-cell.nc-audit-removal :deep(.nc-cell-time) {
  .nc-time-picker span {
    text-decoration: line-through;
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
.nc-audit-mini-item-cell :deep(.nc-cell-user:has(.ant-tag + .ant-tag)) {
  .ant-tag {
    @apply !border-1 !border-gray-300 !py-0.5 !px-1 !bg-gray-100 !rounded-[6px];
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

<style lang="scss">
.nc-audit-mini-item-cell:has(.nc-cell-user .ant-tag + .ant-tag) {
  @apply !p-1;
  .nc-cell-field > div {
    @apply gap-1;
  }
}
.nc-audit-mini-item-cell.nc-audit-removal:has(.nc-cell-user) {
  text-decoration: none;
  .ant-tag div + div {
    text-decoration: line-through;
  }
}
</style>