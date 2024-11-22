<script setup lang="ts">

import { type ColumnType, isVirtualCol, isLinksOrLTAR, isSystemColumn, isCreatedOrLastModifiedTimeCol, isCreatedOrLastModifiedByCol } from 'nocodb-sdk';


/* interface */

const props = defineProps<{
  store: ReturnType<typeof useProvideExpandedFormStore>,
  rowId?: string,
  fields: ColumnType[],
  hiddenFields: ColumnType[],
  isUnsavedDuplicatedRecordExist: boolean,
  isUnsavedFormExist: boolean,
  isLoading: boolean,
  isSaving: boolean,
  newRecordSubmitBtnText?: string,
}>()

const emits = defineEmits([
  'copy:record-url',
  'delete:row',
  'save',
])


const rowId = toRef(props, 'rowId')
const fields = toRef(props, 'fields')
const hiddenFields = toRef(props, 'hiddenFields')
const isUnsavedDuplicatedRecordExist = toRef(props, 'isUnsavedDuplicatedRecordExist')
const isUnsavedFormExist = toRef(props, 'isUnsavedFormExist')
const isLoading = toRef(props, 'isLoading')
const isSaving = toRef(props, 'isSaving')
const newRecordSubmitBtnText = toRef(props, 'newRecordSubmitBtnText')


const isPublic = inject(IsPublicInj, ref(false))


/* stores */

const {
  commentsDrawer,
  changedColumns,
  isNew,
  loadRow: _loadRow,
  row: _row,
} = props.store

const { isUIAllowed } = useRoles()
const { isMobileMode } = useGlobal()


/* flags */

const showRightSections = computed(() =>
  !isNew.value && commentsDrawer.value && isUIAllowed('commentList')
)

const readOnly = computed(() =>
  !isUIAllowed('dataEdit') || isPublic.value
)

const canEdit = computed(() =>
  isUIAllowed('dataEdit')
)


/* attachments */

const attachmentFields = computed(() =>
  fields.value.filter(field => field.uidt === 'Attachment')
)

const selectedFieldId = ref(attachmentFields.value[0]?.id);

const selectedField = computed(() =>
  attachmentFields.value.find(field => field.id === selectedFieldId.value)
)

const selectedFieldValue = computed(() =>
  _row.value.row[selectedField.value?.column_name || '']
)

const activeAttachmentIndex = ref(0);

const activeAttachment = computed(() =>
  selectedFieldValue.value?.[activeAttachmentIndex.value]
)

watch(selectedFieldId, () => {
  activeAttachmentIndex.value = 0
})

watch(selectedFieldValue, () => {
  activeAttachmentIndex.value = Math.min(activeAttachmentIndex.value, Math.max(0, selectedFieldValue.value?.length - 1))
})


const hasAnyAttachmentFields = computed(() =>
  attachmentFields.value.length > 0
)

const hasAnyValueInAttachment = computed(() =>
  selectedFieldValue.value?.length > 0
)


/* attachment actions */

const smartsheetCell = ref()

function openFilePicker() {
  smartsheetCell.value?.openAttachmentCellPicker()
}

function downloadCurrentFile() {
  smartsheetCell.value?.downloadAttachment(activeAttachment.value)
}

function deleteCurrentFile() {
  smartsheetCell.value?.removeAttachment(activeAttachment.value.title, activeAttachmentIndex.value)
}

</script>

<script lang="ts">
export default {
  name: 'ExpandedFormPresentorsFields',
}
</script>

<template>
  <div class="h-full flex flex-row">
    <div
      class="h-full overflow-clip flex flex-col"
      :class="{
        'w-full': !showRightSections,
        'flex-1': showRightSections,
      }"
    >
      <template v-if="!hasAnyAttachmentFields">
        <div class="w-full h-full flex flex-col items-center justify-center bg-gray-100">
          <span class="text-base font-black">
            No Attachment field
          </span>
          <span class="text-xs mt-3 w-[200px] text-center">
            Create an attachment field to use file mode.
          </span>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center h-[44px] border-b-1 border-gray-200 px-3 gap-3">

          <LazySmartsheetCell
            v-if="selectedField"
            ref="smartsheetCell"
            :active="true"
            :column="selectedField"
            :edit-enabled="true"
            :read-only="readOnly"
            class="hidden"
            v-model="_row.row[selectedField!.title!]"
            @update:model-value="changedColumns.add(selectedField!.title!)"
          />

          <NcDropdownSelect
            :items="attachmentFields.map(field => ({ label: field.title || field.id!, value: field.id! }))"
            v-model="selectedFieldId"
          >
            <NcButton type="secondary" size="small">
              <GeneralIcon icon="cellAttachment" class="w-4" />
              <span class="min-w-[100px] text-left pl-2 pb-1 inline-block">
                {{ selectedField?.title }}
              </span>
              <GeneralIcon icon="chevronDown" />
            </NcButton>
          </NcDropdownSelect>

          <NcEditableText
            v-if="activeAttachment"
            :model-value="activeAttachment.title"
            @update:model-value="activeAttachment.title = $event"
          />

          <div class="flex-1" />

          <NcDropdown>
            <NcButton
              type="secondary"
              size="small">
              <GeneralIcon icon="threeDotVertical" />
            </NcButton>
            <template #overlay>
              <NcMenu>
                <NcMenuItem @click="downloadCurrentFile()">
                  <GeneralIcon icon="download" />
                  Download current file
                </NcMenuItem>
                <NcDivider />
                <NcMenuItem class="!text-red-500" @click="deleteCurrentFile()">
                  <GeneralIcon icon="delete" />
                  Delete current file
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>

        </div>
        <div class="w-full h-0 flex-1 flex flex-row relative">
          <template v-if="!hasAnyValueInAttachment">
            <div class="w-full h-full flex flex-col items-center justify-center bg-gray-100">
              <span class="text-base font-black">
                No Attachment
              </span>
              <span class="text-xs mt-3 w-[210px] text-center">
                There are no attachments to display in this field
              </span>
              <NcButton type="secondary" size="small" class="mt-3" @click="openFilePicker()">
                <template #icon>
                  <GeneralIcon icon="upload" />
                </template>
                Upload Attachment
              </NcButton>
            </div>
          </template>
          <template v-else>
            <SmartsheetExpandedFormPresentorsAttachmentsPreviewBar
              :attachments="selectedFieldValue"
              v-model:active-attachment-index="activeAttachmentIndex"
              @open:file-picker="openFilePicker()"
            />
            <div class="w-0 flex-1 bg-gray-100 pl-[80px]">
              <SmartsheetExpandedFormPresentorsAttachmentsAttachmentView
                v-if="activeAttachment"
                :attachment="activeAttachment"
              />
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

<style lang="scss">
.nc-drawer-expanded-form {
  @apply xs:my-0;

  .ant-drawer-content-wrapper {
    @apply !h-[90vh];
    .ant-drawer-content {
      @apply rounded-t-2xl;
    }
  }
}

.nc-expanded-cell-header {
  @apply w-full text-gray-500 !font-weight-500 !text-sm xs:(text-gray-600 mb-2 !text-small) pr-3;

  svg.nc-cell-icon,
  svg.nc-virtual-cell-icon {
    @apply !w-3.5 !h-3.5;
  }
}

.nc-expanded-cell-header > :nth-child(2) {
  @apply !text-sm xs:!text-small;
}
.nc-expanded-cell-header > :first-child {
  @apply !text-md pl-2 xs:(pl-0 -ml-0.5);
}
.nc-expanded-cell-header:not(.nc-cell-expanded-form-header) > :first-child {
  @apply pl-0;
}

.nc-drawer-expanded-form .nc-modal {
  @apply !p-0;
}
</style>

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
