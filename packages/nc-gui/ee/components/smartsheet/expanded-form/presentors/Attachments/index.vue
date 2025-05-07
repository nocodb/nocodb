<script setup lang="ts">
import { type ColumnType, UITypes, type ViewType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  fields: ColumnType[]
  view?: ViewType
  isUnsavedDuplicatedRecordExist: boolean
}>()

const fields = toRef(props, 'fields')
const isUnsavedDuplicatedRecordExist = toRef(props, 'isUnsavedDuplicatedRecordExist')

const isPublic = inject(IsPublicInj, ref(false))

/* stores */

const { commentsDrawer, changedColumns, isNew, loadRow: _loadRow, row: _row } = useExpandedFormStoreOrThrow()

const { isUIAllowed } = useRoles()

const viewsStore = useViewsStore()

/* flags */

const showRightSections = computed(() => !isNew.value && commentsDrawer.value && isUIAllowed('commentList'))

const readOnly = computed(() => !isUIAllowed('dataEdit') || isPublic.value)

/* attachments */

const attachmentFields = computed(() => fields.value.filter((field) => field.uidt === UITypes.Attachment))

const selectedFieldId = ref(props.view?.attachment_mode_column_id ?? attachmentFields.value[0]?.id)

const selectedField = computed(() => attachmentFields.value.find((field) => field.id === selectedFieldId.value)!)

const selectedFieldValue = computed(() => _row.value.row[selectedField.value?.title || ''])

const activeAttachmentIndex = ref(0)

const activeAttachment = computed(() => selectedFieldValue.value?.[activeAttachmentIndex.value])

watch(selectedFieldId, () => {
  activeAttachmentIndex.value = 0
  const viewId = props.view?.id

  if (viewId) {
    viewsStore.setCurrentViewExpandedFormAttachmentColumn(viewId, selectedFieldId.value)
  }
})

watch(
  selectedFieldValue,
  () => {
    let isUpdated = false
    if (ncIsArray(selectedFieldValue.value) && selectedFieldValue.value.length) {
      for (let i = 0; i < selectedFieldValue.value.length; i++) {
        const att = selectedFieldValue.value[i]

        if (isPreviewSupportedFile(att?.title ?? '', att?.mimetype ?? '')) {
          activeAttachmentIndex.value = i
          isUpdated = true
          break
        }
      }
    }

    if (!isUpdated) {
      activeAttachmentIndex.value = Math.min(activeAttachmentIndex.value, Math.max(0, selectedFieldValue.value?.length - 1))
    }
  },
  {
    immediate: true,
  },
)

watch(activeAttachmentIndex, () => {
  if (activeAttachmentIndex.value === null || isNaN(activeAttachmentIndex.value)) {
    activeAttachmentIndex.value = 0
  }
})

watch(attachmentFields, () => {
  if (!attachmentFields.value.find((field) => field.id === selectedFieldId.value)) {
    selectedFieldId.value = attachmentFields.value[0]?.id
  }
})

const hasAnyAttachmentFields = computed(() => attachmentFields.value.length > 0)

const hasAnyValueInAttachment = computed(() => selectedFieldValue.value?.length > 0)

/* attachment interface */

provide(ColumnInj, selectedField)

const { currentRow } = useSmartsheetRowStoreOrThrow()

const attachmentVModel = computed({
  get: () => {
    return _row.value.row[selectedField.value!.title!]
  },
  set: (val) => {
    if (val !== attachmentVModel.value) {
      currentRow.value.rowMeta.changed = true
      _row.value.row[selectedField.value!.title!] = val
      changedColumns.value.add(selectedField.value!.title!)
    }
  },
})

const refAttachmentCell = ref()

function openFilePicker() {
  refAttachmentCell.value?.openFilePicker()
}
</script>

<script lang="ts">
export default {
  name: 'ExpandedFormPresentorsAttachments',
}
</script>

<template>
  <div class="h-full flex flex-row nc-files-mode-container">
    <div
      class="h-full overflow-clip flex flex-col"
      :class="{
        'w-full': !showRightSections,
        'flex-1': showRightSections,
      }"
    >
      <template v-if="!hasAnyAttachmentFields">
        <div class="w-full h-full flex flex-col items-center justify-center bg-gray-100 nc-files-no-attachment-field">
          <span class="text-base font-black"> No Attachment field </span>
          <span class="text-xs mt-3 w-[200px] text-center"> Create an attachment field to use file mode. </span>
        </div>
      </template>
      <template v-else>
        <div class="hidden">
          <LazyCellAttachment ref="refAttachmentCell" v-model="attachmentVModel" />
        </div>
        <div class="w-full h-0 flex-1 flex flex-row relative">
          <template v-if="!hasAnyValueInAttachment">
            <div class="w-full h-full flex flex-col items-center justify-center bg-gray-100 nc-files-no-attachment relative">
              <span class="text-base font-black"> No Attachment </span>
              <span class="text-xs mt-3 w-[210px] text-center"> There are no attachments to display in this field </span>
              <NcButton type="secondary" size="small" class="mt-3" :disabled="readOnly" @click="openFilePicker()">
                <template #icon>
                  <GeneralIcon icon="upload" />
                </template>
                Upload Attachment
              </NcButton>

              <div class="px-4 py-3 overflow-hidden absolute top-0 left-0">
                <NcDropdownSelect
                  v-model="selectedFieldId"
                  class="nc-files-current-field-dropdown"
                  :items="attachmentFields.map(field => ({ label: field.title || field.id!, value: field.id! }))"
                  overlay-class-name="w-[288px]"
                >
                  <NcButton type="secondary" size="small" class="overflow-hidden">
                    <GeneralIcon icon="cellAttachment" class="w-4 h-4 aspect-square flex items-center justify-center" />

                    <NcTooltip class="max-w-[200px] truncate !leading-5" show-on-truncate-only>
                      <template #title>{{ selectedField?.title }}</template>
                      <span class="pl-2 nc-files-current-field-title">
                        {{ selectedField?.title }}
                      </span>
                    </NcTooltip>
                    <GeneralIcon
                      icon="chevronDown"
                      class="h-4 w-4 ml-1 text-gray-500 aspect-square flex items-center justify-center"
                    />
                  </NcButton>
                </NcDropdownSelect>
              </div>
            </div>
          </template>
          <template v-else>
            <SmartsheetExpandedFormPresentorsAttachmentsPreviewBar
              v-model:active-attachment-index="activeAttachmentIndex"
              v-model:selected-field-id="selectedFieldId"
              :attachments="selectedFieldValue"
              :selected-field="selectedField"
              :attachment-fields="attachmentFields"
              @open:file-picker="openFilePicker()"
            />
            <div class="w-0 flex-1 bg-gray-100 pl-[80px]">
              <SmartsheetExpandedFormPresentorsAttachmentsAttachmentView v-if="activeAttachment" :attachment="activeAttachment" />
            </div>
          </template>
        </div>
      </template>
    </div>
    <div
      v-if="showRightSections && !isUnsavedDuplicatedRecordExist"
      class="nc-comments-drawer border-l-1 relative border-gray-200 bg-gray-50 w-1/3 max-w-[400px] min-w-0 h-full xs:hidden rounded-br-2xl"
      :class="{
        active: commentsDrawer && isUIAllowed('commentList'),
      }"
    >
      <SmartsheetExpandedFormSidebar show-fields-tab />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-select-selector) {
  @apply !xs:(h-full);
}

.nc-data-cell {
  @apply !rounded-lg;
  transition: all 0.3s;

  &:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-attachment-cell):not(.nc-virtual-cell-button) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }
  &:not(:focus-within):hover:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-virtual-cell-button) {
    @apply !border-1;
    &:not(.nc-attachment-cell):not(.nc-virtual-cell-button) {
      box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
    }
  }

  &.nc-readonly-div-data-cell,
  &.nc-system-field {
    @apply !border-gray-200;

    .nc-cell,
    .nc-virtual-cell {
      @apply text-gray-400;
    }
  }
  &.nc-readonly-div-data-cell:focus-within,
  &.nc-system-field:focus-within {
    @apply !border-gray-200;
  }

  &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
    @apply !shadow-selected;
  }

  &:has(.nc-virtual-cell-qrcode .nc-qrcode-container),
  &:has(.nc-virtual-cell-barcode .nc-barcode-container) {
    @apply !border-none px-0 !rounded-none;
    :deep(.nc-virtual-cell-qrcode),
    :deep(.nc-virtual-cell-barcode) {
      @apply px-0;
      & > div {
        @apply !px-0;
      }
      .barcode-wrapper {
        @apply ml-0;
      }
    }
    :deep(.nc-virtual-cell-qrcode) {
      img {
        @apply !h-[84px] border-1 border-solid border-gray-200 rounded;
      }
    }
    :deep(.nc-virtual-cell-barcode) {
      .nc-barcode-container {
        @apply border-1 rounded-lg border-gray-200 h-[64px] max-w-full p-2;
        svg {
          @apply !h-full;
        }
      }
    }
  }
}

.nc-mentioned-cell {
  box-shadow: 0px 0px 0px 2px var(--ant-primary-color-outline) !important;
  @apply !border-brand-500 !border-1;
}

.nc-data-cell:focus-within {
  @apply !border-1 !border-brand-500;
}

:deep(.nc-system-field input) {
  @apply bg-transparent;
}
:deep(.nc-data-cell .nc-cell .nc-cell-field) {
  @apply px-2;
}
:deep(.nc-data-cell .nc-virtual-cell .nc-cell-field) {
  @apply px-2;
}
:deep(.nc-data-cell .nc-cell-field.nc-lookup-cell .nc-cell-field) {
  @apply px-0;
}
</style>
