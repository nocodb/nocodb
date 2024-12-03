<script setup lang="ts">
import { type ColumnType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  store: ReturnType<typeof useProvideExpandedFormStore>
  rowId?: string
  fields: ColumnType[]
  hiddenFields: ColumnType[]
  isUnsavedDuplicatedRecordExist: boolean
  isUnsavedFormExist: boolean
  isLoading: boolean
  isSaving: boolean
  newRecordSubmitBtnText?: string
}>()

const emits = defineEmits(['copy:record-url', 'delete:row', 'save'])

const rowId = toRef(props, 'rowId')
const fields = toRef(props, 'fields')
const hiddenFields = toRef(props, 'hiddenFields')
const isUnsavedDuplicatedRecordExist = toRef(props, 'isUnsavedDuplicatedRecordExist')
const isUnsavedFormExist = toRef(props, 'isUnsavedFormExist')
const isLoading = toRef(props, 'isLoading')
const isSaving = toRef(props, 'isSaving')
const newRecordSubmitBtnText = toRef(props, 'newRecordSubmitBtnText')

/* stores */

const { commentsDrawer, changedColumns, isNew, loadRow: _loadRow, row: _row } = props.store

const { isUIAllowed } = useRoles()
const { isMobileMode } = useGlobal()

/* flags */

const showRightSections = computed(() => !isNew.value && commentsDrawer.value && isUIAllowed('commentList'))

const canEdit = computed(() => isUIAllowed('dataEdit'))
</script>

<script lang="ts">
export default {
  name: 'ExpandedFormPresentorsFields',
}
</script>

<template>
  <div class="h-full flex flex-row">
    <div
      class="h-full flex xs:w-full flex-col overflow-hidden"
      :class="{
        'w-full': !showRightSections,
        'flex-1': showRightSections,
      }"
    >
      <SmartsheetExpandedFormPresentorsFieldsColumns
        :store="props.store"
        :fields="fields"
        :hidden-fields="hiddenFields"
        :is-loading="isLoading"
      />

      <div
        v-if="canEdit"
        class="w-full flex items-center justify-end px-2 xs:(p-0 gap-x-4 justify-between)"
        :class="{
          'xs(border-t-1 border-gray-200)': !isNew,
        }"
      >
        <div v-if="!isNew && isMobileMode" class="p-2">
          <NcDropdown placement="bottomRight" class="p-2">
            <NcButton :disabled="isLoading" class="nc-expand-form-more-actions" type="secondary" size="small">
              <GeneralIcon :class="isLoading ? 'text-gray-300' : 'text-gray-700'" class="text-md" icon="threeDotVertical" />
            </NcButton>

            <template #overlay>
              <NcMenu>
                <NcMenuItem class="text-gray-700" @click="_loadRow()">
                  <div v-e="['c:row-expand:reload']" class="flex gap-2 items-center" data-testid="nc-expanded-form-reload">
                    <component :is="iconMap.reload" class="cursor-pointer" />
                    {{ $t('general.reload') }}
                  </div>
                </NcMenuItem>
                <NcMenuItem v-if="rowId" class="text-gray-700" @click="!isNew ? emits('copy:record-url') : () => {}">
                  <div v-e="['c:row-expand:copy-url']" class="flex gap-2 items-center" data-testid="nc-expanded-form-copy-url">
                    <component :is="iconMap.copy" class="cursor-pointer nc-duplicate-row" />
                    {{ $t('labels.copyRecordURL') }}
                  </div>
                </NcMenuItem>
                <NcDivider />
                <NcMenuItem
                  v-if="isUIAllowed('dataEdit') && !isNew"
                  v-e="['c:row-expand:delete']"
                  class="!text-red-500 !hover:bg-red-50"
                  @click="!isNew && emits('delete:row')"
                >
                  <div data-testid="nc-expanded-form-delete">
                    <component :is="iconMap.delete" class="cursor-pointer nc-delete-row" />
                    Delete record
                  </div>
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
        </div>
        <div v-if="isMobileMode" class="p-2">
          <NcButton
            v-e="['c:row-expand:save']"
            :disabled="changedColumns.size === 0 && !isUnsavedFormExist"
            :loading="isSaving"
            class="nc-expand-form-save-btn !xs:(text-sm) !px-2"
            :class="{
              '!h-7': !isMobileMode,
            }"
            data-testid="nc-expanded-form-save"
            type="primary"
            :size="isMobileMode ? 'small' : 'xsmall'"
            @click="emits('save')"
          >
            <div class="xs:px-1">{{ newRecordSubmitBtnText ?? isNew ? 'Create Record' : 'Save Record' }}</div>
          </NcButton>
        </div>
      </div>
      <div v-else class="p-2" />
    </div>
    <div
      v-if="showRightSections && !isUnsavedDuplicatedRecordExist"
      class="nc-comments-drawer border-l-1 relative border-gray-200 bg-gray-50 w-1/3 max-w-[400px] min-w-0 h-full xs:hidden rounded-br-2xl"
      :class="{
        active: commentsDrawer && isUIAllowed('commentList'),
      }"
    >
      <SmartsheetExpandedFormSidebar :store="store" />
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
