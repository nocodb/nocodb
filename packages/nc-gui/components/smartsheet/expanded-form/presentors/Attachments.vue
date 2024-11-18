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


/* initial focus and scroll fix */

const cellWrapperEl = ref()
const mentionedCell = ref('')


/* hidden fields */

const showHiddenFields = ref(false)

function toggleHiddenFields() {
  showHiddenFields.value = !showHiddenFields.value
}


/* utilities */

function isReadOnlyVirtualCell(column: ColumnType) {
  return (
    isRollup(column) ||
    isFormula(column) ||
    isBarcode(column) ||
    isLookup(column) ||
    isQrCode(column) ||
    isSystemColumn(column) ||
    isCreatedOrLastModifiedTimeCol(column) ||
    isCreatedOrLastModifiedByCol(column)
  )
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
      <div class="flex items-center h-[44px] border-b-1 border-gray-200 px-3 gap-3">
        <NcDropdown>
          <NcButton type="secondary" size="small">
            <GeneralIcon icon="cellAttachment" class="w-4" />
            <span class="min-w-[100px] text-left pl-2 pb-1 inline-block">
              Resume
            </span>
            <GeneralIcon icon="chevronDown" />
          </NcButton>
          <template #overlay>
            asdf
          </template>
        </NcDropdown>
        <div>
          resume-file.pdf
        </div>
        <div class="flex-1" />
        <div>
          <NcButton
            type="secondary"
            size="small">
            <GeneralIcon icon="threeDotVertical" />
          </NcButton>
        </div>
      </div>
      <div class="w-full flex-1 flex flex-row">
        <div class="w-[80px] h-full bg-white border-r-1 border-gray-200 flex flex-col">
          <div class="flex-1 h-0 flex items-center justify-center p-2">
            <div class="w-full h-[64px] border-1 border-gray-200 rounded-lg overflow-hidden hover:bg-gray-50 cursor-pointer flex flex-col">
              <div class="h-0 flex-1 flex items-center justify-center">
                <GeneralIcon icon="pdfFile" class="text-red-500 text-xl" />
              </div>
              <div class="font-bold text-center">
                PDF
              </div>
            </div>
          </div>
          <div>
            <div class="flex items-center border-t-1 border-gray-200 rounded-t-lg overflow-clip">
              <NcButton type="text" class="w-0 flex-1 !border-r-1 !border-gray-200 !rounded-none">
                <GeneralIcon icon="chevronUpSmall" />
              </NcButton>
              <NcButton type="text" class="w-0 flex-1 !rounded-none">
                <GeneralIcon icon="chevronDownSmall" />
              </NcButton>
            </div>
            <NcButton type="text" class="w-full !rounded-none !border-t-1 !border-gray-200 !h-16">
              <div class="flex flex-col items-center">
                <GeneralIcon icon="plus" />
                <span class="mt-2">
                  Add file(s)
                </span>
              </div>
            </NcButton>
          </div>
        </div>
        <div class="w-0 flex-1 bg-gray-100 p-4">
          <CellAttachmentPreviewPdf
            :src="['https://pdfobject.com/pdf/sample.pdf']"
          />
        </div>
      </div>
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
