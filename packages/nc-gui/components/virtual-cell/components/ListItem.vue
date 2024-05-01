<script lang="ts" setup>
import { UITypes, isVirtualCol, parseStringDateTime } from 'nocodb-sdk'
import {
  type ComputedRef,
  IsExpandedFormOpenInj,
  IsFormInj,
  IsPublicInj,
  ReadonlyInj,
  RowHeightInj,
  computed,
  inject,
  isImage,
  provide,
  ref,
  useAttachment,
  useVModel,
} from '#imports'
import MaximizeIcon from '~icons/nc-icons/maximize'

const props = defineProps<{
  row: any
  fields: any[]
  attachment: any
  relatedTableDisplayValueProp: string
  displayValueTypeAndFormatProp: { type: string; format: string }
  isLoading: boolean
  isLinked: boolean
}>()

defineEmits(['expand', 'linkOrUnlink'])

provide(IsExpandedFormOpenInj, ref(true))

provide(RowHeightInj, ref(1 as const))

const isForm = inject(IsFormInj, ref(false))

const row = useVModel(props, 'row')

const isPublic = inject(IsPublicInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const { getPossibleAttachmentSrc } = useAttachment()

interface Attachment {
  url: string
  title: string
  type: string
  mimetype: string
}

const isRowEmpty = (row: any, col: any) => {
  const val = row[col.title]
  if (!val) return true

  return Array.isArray(val) && val.length === 0
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
  <div class="nc-list-item-wrapper group p-[2px] hover:bg-gray-50 border-b-1 border-b border-gray-200">
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
        <div v-if="isLoading" class="flex">
          <MdiLoading class="flex-none w-7 h-7 !text-brand-500 animate-spin" />
        </div>

        <NcTooltip v-else class="z-10 flex">
          <template #title> {{ isLinked ? 'Unlink' : 'Link' }}</template>

          <button
            tabindex="-1"
            class="nc-list-item-link-unlink-btn p-1.5 flex rounded-lg transition-all"
            :class="{
              'bg-red-100 text-red-500 hover:bg-red-200': isLinked,
              'bg-green-100 text-green-500 hover:bg-green-200': !isLinked,
            }"
            @click="$emit('linkOrUnlink')"
          >
            <GeneralIcon :icon="isLinked ? 'minus' : 'plus'" class="flex-none w-4 h-4 !font-extrabold" />
          </button>
        </NcTooltip>
        <template v-if="attachment">
          <div v-if="attachments && attachments.length">
            <a-carousel autoplay class="!w-11 !h-11 !max-h-11 !max-w-11">
              <template #customPaging> </template>
              <template v-for="(attachmentObj, index) in attachments">
                <LazyCellAttachmentImage
                  v-if="isImage(attachmentObj.title, attachmentObj.mimetype ?? attachmentObj.type)"
                  :key="`carousel-${attachmentObj.title}-${index}`"
                  class="!w-11 !h-11 !max-h-11 !max-w-11object-cover !rounded-l-xl"
                  :srcs="getPossibleAttachmentSrc(attachmentObj)"
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
            <div v-for="field in fields" :key="field.id" :class="attachment ? 'sm:w-1/3' : 'sm:w-1/3'">
              <div v-if="!isRowEmpty(row, field)" class="flex flex-col gap-[-1] w-full max-w-72">
                <NcTooltip class="z-10 flex" placement="bottom">
                  <template #title>
                    <LazySmartsheetHeaderVirtualCell
                      v-if="isVirtualCol(field)"
                      class="!scale-60 text-gray-100 !text-sm"
                      :column="field"
                      :hide-menu="true"
                    />
                    <LazySmartsheetHeaderCell v-else class="!scale-70 text-gray-100 !text-sm" :column="field" :hide-menu="true" />
                  </template>
                  <div class="nc-link-record-cell flex max-w-full">
                    <LazySmartsheetVirtualCell
                      v-if="isVirtualCol(field)"
                      v-model="row[field.title]"
                      :row="row"
                      :column="field"
                      class="text-gray-500"
                    />
                    <LazySmartsheetCell
                      v-else
                      v-model="row[field.title]"
                      class="!text-gray-500 ml-1"
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
          <button
            v-e="['c:row-expand:open']"
            :tabindex="-1"
            class="z-10 flex items-center justify-center nc-expand-item !group-hover:visible !invisible !h-7 !w-7 transition-all !hover:children:(w-4.5 h-4.5)"
            @click.stop="$emit('expand', row)"
          >
            <MaximizeIcon class="flex-none w-4 h-4 scale-125" />
          </button>
        </div>
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
    @apply !text-small;

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
      .ant-select-arrow {
        @apply right-[3px];
      }
    }
  }
}
</style>

<style lang="scss">
.nc-list-item {
  @apply border-1 border-transparent rounded-md;

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
      @apply !min-h-6 !max-h-6;
    }
    .nc-rich-text-embed {
      .nc-textarea-rich-editor {
        @apply !overflow-hidden;
        .ProseMirror {
          @apply !overflow-hidden line-clamp-1;
        }
      }
    }
  }
}
</style>
