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
    }[opts.icon as string] ?? opts.icon
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
</script>

<template>
  <div v-for="columnKey in columnKeys" :key="columnKey" class="relative mb-2">
    <GeneralIcon icon="ncNode" class="w-[16px] h-[16px] text-gray-500 bg-white absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2" />
    <div class="mb-1 ml-6.5">
      <div
        class="text-sm font-weight-500"
        :class="{
          'inline-flex items-center flex-wrap': meta[columnKey]?.type !== 'LongText',
        }"
      >
        <span class="text-gray-600">
          changed
        </span>
        <span
          class="border-1 border-gray-300 rounded-md px-1 !h-[20px] bg-gray-200 inline-flex items-center gap-1 mx-3"
        >
          <SmartsheetHeaderCellIcon
            :column-meta="{ uidt: meta[columnKey]?.type, dt: meta[columnKey]?.type === 'Number' ? 'bigint' : undefined }"
            class="!w-[16px] !h-[16px] !m-0"
          />
          <span class="text-sm font-weight-500 text-gray-600">
            {{ columnKey }}
          </span>
        </span>
        <template v-if="meta[columnKey]?.type === 'Attachment'">
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
        <template v-else-if="['SingleLineText', 'LongText'].includes(meta[columnKey]?.type)">
          <template v-for="(block, i) of diffTextBlocks(oldData[columnKey] || '', newData[columnKey] || '')" :key="i">
            <span
              v-if="block.op === 'removed'"
              class="text-red-700 border-1 border-red-200 rounded-md px-1 bg-red-50 line-through decoration-clone"
            >
              {{ block.text }}
            </span>
            <span
              v-else-if="block.op === 'added'"
              class="text-green-700 border-1 border-green-200 rounded-md px-1 bg-green-50 decoration-clone"
            >
              {{ block.text }}
            </span>
            <span v-else>
              {{ block.text }}
            </span>
          </template>
        </template>
        <template v-else>
          <span class="nc-expressive-mini-item-cell cell-removal line-through">
            <span v-if="!oldData[columnKey]"> empty </span>
            <SmartsheetCell
              v-else
              :column="{
                uidt: meta[columnKey]?.type,
                dt: meta[columnKey]?.type === 'Number' ? 'bigint' : undefined,
                meta: normalizeMeta(columnKey),
                colOptions: normalizeColOptions(columnKey),
              }"
              :model-value="oldData[columnKey]"
              :edit-enabled="false"
              :read-only="true"
              :class="{
                'min-w-[100px]': normalizeMeta(columnKey).is_progress,
              }"
            />
          </span>
          <span class="nc-expressive-mini-item-cell ml-2">
            <span v-if="!newData[columnKey]"> empty </span>
            <SmartsheetCell
              v-else
              :column="{
                uidt: meta[columnKey]?.type,
                dt: meta[columnKey]?.type === 'Number' ? 'bigint' : undefined,
                meta: normalizeMeta(columnKey),
                colOptions: normalizeColOptions(columnKey),
              }"
              :model-value="newData[columnKey]"
              :edit-enabled="false"
              :read-only="true"
              :class="{
                'min-w-[100px]': normalizeMeta(columnKey).is_progress,
              }"
            />
          </span>
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
    @apply !m-0 flex items-center h-[22px];
  }
}
.nc-expressive-mini-item-cell :deep(.nc-cell-field.nc-single-select > div) {
  height: 20px !important;
  & > span {
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
  @apply !p-0 transform -translate-y-[2px];
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
</style>

<style lang="scss">
.nc-audit-mini-item-header {
  svg {
    height: 12px;
  }
}
.nc-expressive-mini-item-cell :where(.nc-cell-email, .nc-cell-url, .nc-cell-phonenumber) a {
  @apply !text-gray-800 no-underline;
}
.nc-expressive-mini-item-cell.cell-removal :where(.nc-cell-email, .nc-cell-url, .nc-cell-phonenumber) a {
  @apply !line-through;
}
.nc-expressive-mini-item-cell.cell-removal :where(.nc-year-picker, .nc-time-picker, .nc-date-picker) {
  @apply !line-through;
}
</style>