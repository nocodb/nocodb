<script lang="ts" setup>
import { UITypes, isVirtualCol, parseStringDateTime } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    row: any
    fields: any[]
    attachment: any
    relatedTableDisplayValueProp: string
    displayValueTypeAndFormatProp: { type: string; format: string }
    isLoading: boolean
    isLinked: boolean
    isSelected?: boolean
  }>(),
  {
    isLoading: false,
    isSelected: false,
  },
)

defineEmits(['expand', 'linkOrUnlink'])

provide(IsExpandedFormOpenInj, ref(true))

provide(RowHeightInj, ref(1 as const))

provide(IsUnderLookupInj, ref(true))

const isForm = inject(IsFormInj, ref(false))

const row = useVModel(props, 'row')

const { isLinked, isLoading, isSelected } = toRefs(props)

const isPublic = inject(IsPublicInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const { getPossibleAttachmentSrc } = useAttachment()

interface Attachment {
  url: string
  title: string
  type: string
  mimetype: string
}

const attachments: ComputedRef<Attachment[]> = computed(() => {
  try {
    if (props.attachment && row.value[props.attachment.title]) {
      return typeof row.value[props.attachment.title] === 'string'
        ? JSON.parse(row.value[props.attachment.title])
        : row.value[props.attachment.title]
    }
    return []
  } catch (e) {
    return []
  }
})

const displayValue = computed(() => {
  if (
    row.value[props.relatedTableDisplayValueProp] &&
    props.displayValueTypeAndFormatProp.type &&
    props.displayValueTypeAndFormatProp.format
  ) {
    return parseStringDateTime(
      row.value[props.relatedTableDisplayValueProp],
      props.displayValueTypeAndFormatProp.format,
      !(props.displayValueTypeAndFormatProp.format === UITypes.Time),
    )
  }
  return row.value[props.relatedTableDisplayValueProp]
})
</script>

<template>
  <div class="nc-list-item-wrapper group px-[1px] hover:bg-gray-50 border-y-1 border-gray-200 border-t-transparent">
    <a-card
      tabindex="0"
      class="nc-list-item !outline-none transition-all relative group-hover:bg-gray-50 cursor-auto"
      :class="{
        '!bg-white': isLoading,
        '!hover:bg-white': readOnly,
        'nc-is-selected': isSelected,
      }"
      :body-style="{ padding: '6px 10px !important', borderRadius: 0 }"
      :hoverable="false"
    >
      <div class="flex items-center gap-3">
        <template v-if="attachment">
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
          <div class="flex justify-start">
            <span class="font-semibold text-brand-500 nc-display-value truncate leading-[20px]">
              {{ displayValue }}
            </span>
          </div>

          <div
            v-if="fields.length > 0 && !isPublic && !isForm"
            class="flex ml-[-0.25rem] sm:flex-row xs:(flex-col mt-2) gap-4 min-h-5"
          >
            <div v-for="field in fields" :key="field.id" class="sm:(w-1/3 max-w-1/3 overflow-hidden)">
              <div v-if="!isRowEmpty({ row }, field)" class="flex flex-col gap-[-1]">
                <NcTooltip class="z-10 flex" placement="bottomLeft" :arrow-point-at-center="false">
                  <template #title>
                    <LazySmartsheetHeaderVirtualCell
                      v-if="isVirtualCol(field)"
                      class="text-gray-100 !text-sm nc-link-record-cell-tooltip"
                      :column="field"
                      :hide-menu="true"
                    />
                    <LazySmartsheetHeaderCell
                      v-else
                      class="text-gray-100 !text-sm nc-link-record-cell-tooltip"
                      :column="field"
                      :hide-menu="true"
                    />
                  </template>
                  <div class="nc-link-record-cell flex w-full max-w-full">
                    <LazySmartsheetVirtualCell v-if="isVirtualCol(field)" v-model="row[field.title]" :row="row" :column="field" />
                    <LazySmartsheetCell
                      v-else
                      v-model="row[field.title]"
                      :column="field"
                      :edit-enabled="false"
                      :read-only="true"
                    />
                  </div>
                </NcTooltip>
              </div>
              <div v-else class="flex flex-row w-full max-w-72 h-5 pl-1 items-center justify-start">-</div>
            </div>
          </div>
        </div>
        <div v-if="!isForm && !isPublic && !readOnly" class="flex-none flex items-center w-7">
          <NcTooltip class="flex">
            <template #title>{{ $t('title.expand') }}</template>

            <button
              v-e="['c:row-expand:open']"
              :tabindex="-1"
              class="z-10 flex items-center justify-center nc-expand-item !group-hover:visible !invisible !h-7 !w-7 transition-all !hover:children:(w-4.5 h-4.5)"
              @click.stop="$emit('expand', row)"
            >
              <GeneralIcon icon="maximize" class="flex-none w-4 h-4 scale-125" />
            </button>
          </NcTooltip>
        </div>
        <template v-if="(!isPublic && !readOnly) || isForm">
          <NcTooltip class="z-10 flex">
            <template #title> {{ isLinked ? 'Unlink' : 'Link' }}</template>

            <button
              tabindex="-1"
              class="nc-list-item-link-unlink-btn p-1.5 flex rounded-lg transition-all"
              :class="{
                'bg-gray-200 text-gray-800 hover:(bg-red-100 text-red-500)': isLinked,
                'bg-green-[#D4F7E0] text-[#17803D] hover:bg-green-200': !isLinked,
              }"
              @click="$emit('linkOrUnlink')"
            >
              <div v-if="isLoading" class="flex">
                <MdiLoading class="flex-none w-4 h-4 !text-brand-500 animate-spin" />
              </div>
              <GeneralIcon v-else :icon="isLinked ? 'minus' : 'plus'" class="flex-none w-4 h-4 !font-extrabold" />
            </button>
          </NcTooltip>
        </template>
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
  @apply border-1 border-transparent rounded-md;

  &:focus-visible,
  &.nc-is-selected {
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
