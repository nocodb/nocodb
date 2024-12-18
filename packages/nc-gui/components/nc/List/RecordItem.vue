<script lang="ts" setup>
import { type ColumnType, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    row: Row
    columns: (ColumnType & { [key: string]: any })[]
    attachmentColumn?: ColumnType
    displayValueColumn?: ColumnType
    isLoading?: boolean
    isSelected?: boolean
    displayValueClassName?: string
  }>(),
  {
    isLoading: false,
    isSelected: false,
    displayValueClassName: '',
  },
)

provide(IsExpandedFormOpenInj, ref(true))

provide(RowHeightInj, ref(1 as const))

provide(IsFormInj, ref(false))

const { row: currentRow, columns: allColumns, isSelected, isLoading } = toRefs(props)

useProvideSmartsheetRowStore(currentRow)

const readOnly = inject(ReadonlyInj, ref(false))

const { isMobileMode } = useGlobal()

const { getPossibleAttachmentSrc } = useAttachment()

interface Attachment {
  url: string
  title: string
  type: string
  mimetype: string
}

const displayValueColumn = computed(() => {
  return props.displayValueColumn || (allColumns.value || []).find((c) => c?.pv ?? null) || (allColumns.value || [])?.[0]
})

const displayValue = computed(() => {
  return displayValueColumn.value?.title ? currentRow.value.row[displayValueColumn.value?.title] : null
})

const attachmentColumn = computed(() => {
  return props.attachmentColumn || (allColumns.value || []).find((c) => isAttachment(c))
})

const attachments: ComputedRef<Attachment[]> = computed(() => {
  try {
    if (attachmentColumn.value?.title && currentRow.value.row[attachmentColumn.value.title]) {
      return typeof currentRow.value.row[attachmentColumn.value.title] === 'string'
        ? JSON.parse(currentRow.value.row[attachmentColumn.value.title])
        : currentRow.value.row[attachmentColumn.value.title]
    }
    return []
  } catch (e) {
    return []
  }
})

const columnsToRender = computed(() => {
  return allColumns.value
    .filter((c) => {
      const isDisplayValueColumn = c.id === displayValueColumn.value?.id

      return (
        !isDisplayValueColumn && !isSystemColumn(c) && !isPrimary(c) && !isLinksOrLTAR(c) && !isAiButton(c) && !isAttachment(c)
      )
    })
    .sort((a, b) => {
      return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
    })
    .slice(0, isMobileMode.value ? 1 : 3)
})
</script>

<template>
  <div class="nc-list-item-wrapper group px-[1px] hover:bg-gray-50 border-y-1 border-gray-200 border-t-transparent w-full">
    <a-card
      tabindex="0"
      class="nc-list-item !outline-none transition-all relative group-hover:bg-gray-50 cursor-auto"
      :class="{
        '!bg-white': isLoading,
        '!hover:bg-white': readOnly,
      }"
      :body-style="{ padding: '6px 10px !important', borderRadius: 0 }"
      :hoverable="false"
    >
      <div class="flex items-center gap-3">
        <template v-if="attachmentColumn">
          <div v-if="attachments && attachments.length">
            <a-carousel autoplay class="!w-11 !h-11 !max-h-11 !max-w-11">
              <template #customPaging> </template>
              <template v-for="(attachmentObj, index) in attachments">
                <LazyCellAttachmentPreviewImage
                  v-if="isImage(attachmentObj.title, attachmentObj.mimetype ?? attachmentObj.type)"
                  :key="`carousel-${attachmentObj.title}-${index}`"
                  class="!w-11 !h-11 !max-h-11 !max-w-11object-cover !rounded-l-xl"
                  :srcs="getPossibleAttachmentSrc(attachmentObj, 'tiny')"
                />
              </template>
            </a-carousel>
          </div>
          <div
            v-else
            class="h-11 w-11 !min-h-11 !min-w-11 !max-h-11 !max-w-11 !flex flex-row items-center !rounded-l-xl justify-center"
          >
            <GeneralIcon class="w-full h-full !text-6xl !leading-10 !text-transparent rounded-lg" icon="fileImage" />
          </div>
        </template>

        <div class="flex-1 flex flex-col gap-1 justify-center overflow-hidden">
          <div
            v-if="displayValueColumn && displayValue"
            class="flex justify-start font-semibold text-brand-500 nc-display-value"
            :class="displayValueClassName"
          >
            <NcTooltip class="truncate leading-[20px]" show-on-truncate-only>
              <template #title>
                <LazySmartsheetPlainCell
                  v-model="displayValue"
                  :column="displayValueColumn"
                  class="field-config-plain-cell-value"
                />
              </template>

              <LazySmartsheetPlainCell
                v-model="displayValue"
                :column="displayValueColumn"
                class="field-config-plain-cell-value"
              />
            </NcTooltip>
          </div>

          <div v-if="columnsToRender.length > 0" class="flex ml-[-0.25rem] sm:flex-row xs:(flex-col mt-2) gap-4 min-h-5">
            <div v-for="column in columnsToRender" :key="column.id" class="sm:(w-1/3 max-w-1/3 overflow-hidden)">
              <div v-if="!isRowEmpty(currentRow, column)" class="flex flex-col gap-[-1]">
                <NcTooltip class="z-10 flex" placement="bottomLeft" :arrow-point-at-center="false">
                  <template #title>
                    <LazySmartsheetHeaderVirtualCell
                      v-if="isVirtualCol(column)"
                      class="text-gray-100 !text-sm nc-link-record-cell-tooltip"
                      :column="column"
                      hide-menu
                    />
                    <LazySmartsheetHeaderCell
                      v-else
                      class="text-gray-100 !text-sm nc-link-record-cell-tooltip"
                      :column="column"
                      hide-menu
                    />
                  </template>
                  <div class="nc-link-record-cell flex w-full max-w-full">
                    <LazySmartsheetVirtualCell
                      v-if="isVirtualCol(column)"
                      :model-value="currentRow.row[column.title!]"
                      :row="currentRow"
                      :column="column"
                    />
                    <LazySmartsheetCell
                      v-else
                      :model-value="currentRow.row[column.title!]"
                      :column="column"
                      :edit-enabled="false"
                      read-only
                    />
                  </div>
                </NcTooltip>
              </div>
              <div v-else class="flex flex-row w-full max-w-72 h-5 pl-1 items-center justify-start">-</div>
            </div>
          </div>
        </div>
        <slot name="extraRight">
          <div class="min-w-5 flex-none">
            <Transition>
              <GeneralIcon v-if="isSelected" icon="circleCheckSolid" class="flex-none text-primary w-5 h-5" />
            </Transition>
          </div>
        </slot>
      </div>
    </a-card>
  </div>
</template>

<style lang="scss" scoped>
:deep(.slick-list) {
  @apply rounded-lg;
}
.nc-list-item-link-unlink-btn {
  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
}

.nc-link-record-cell {
  :deep(.nc-cell),
  :deep(.nc-virtual-cell) {
    @apply !text-small !text-gray-600 ml-1;

    .nc-cell-field,
    .nc-cell-field-link,
    input,
    textarea {
      @apply !text-small !p-0 m-0;
    }

    &:not(.nc-display-value-cell) {
      @apply text-gray-600;
      font-weight: 500;

      .nc-cell-field,
      input,
      textarea {
        @apply text-gray-600;
        font-weight: 500;
      }
    }

    .nc-cell-field,
    a.nc-cell-field-link,
    input,
    textarea {
      @apply !p-0 m-0;
    }

    &.nc-cell-longtext {
      @apply leading-[18px];

      textarea {
        @apply pr-2;
      }

      .long-text-wrapper {
        @apply !min-h-4;

        .nc-rich-text-grid {
          @apply pl-0 -ml-1;
        }
      }
    }

    .ant-picker-input {
      @apply text-small leading-4;
      font-weight: 500;

      input {
        @apply text-small leading-4;
        font-weight: 500;
      }
    }

    .ant-select:not(.ant-select-customize-input) {
      .ant-select-selector {
        @apply !border-none flex-nowrap pr-4.5;
      }
      .ant-select-arrow,
      .ant-select-clear {
        @apply right-[3px];
      }
    }
  }
}
.nc-link-record-cell-tooltip {
  @apply !bg-transparent !hover:bg-transparent;

  :deep(.nc-cell-icon) {
    @apply !ml-0;
  }
  :deep(.name) {
    @apply !text-small;
  }
}
</style>

<style lang="scss">
.nc-list-item {
  @apply border-1 border-transparent;

  &:focus-visible {
    @apply border-brand-500;
    box-shadow: 0 0 0 1px #3366ff;
  }
  &:hover {
    .nc-text-area-expand-btn {
      @apply !hidden;
    }
  }
  .long-text-wrapper {
    @apply select-none pointer-events-none;
    .nc-readonly-rich-text-wrapper {
      @apply !min-h-5 !max-h-5;
    }
    .nc-rich-text-embed {
      @apply -mt-0.5;
      .nc-textarea-rich-editor {
        @apply !overflow-hidden;
        .ProseMirror {
          @apply !overflow-hidden line-clamp-1 h-[18px] pt-0.4;
        }
      }
    }
  }
}
</style>
