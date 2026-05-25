<script setup lang="ts">
import { type ColumnType, PermissionEntity, PermissionKey, UITypes, type ViewType } from 'nocodb-sdk'

/* interface */

const props = defineProps<{
  fields: ColumnType[]
  hiddenFields: ColumnType[]
  view?: ViewType
  isUnsavedDuplicatedRecordExist: boolean
  /** Force-hide the right-side sidebar (fields / comments / audits) regardless
   * of the user's commentsDrawer preference. Used by the EE docked panel at
   * narrow widths. */
  hideSidebar?: boolean
  /** Render the sidebar's Fields tab in compact mode. */
  compactMode?: boolean
  /** Side-panel layout: preview on top, horizontal thumbnail strip at the
   * bottom (with a '+' tile to add files), field selector as an icon-only
   * dropdown in the top-left. When false (fullscreen), the original
   * vertical rail + preview layout is used. */
  compactLayout?: boolean
}>()

const { fields, hiddenFields, isUnsavedDuplicatedRecordExist } = toRefs(props)

const isPublic = inject(IsPublicInj, ref(false))

const readOnlyView = inject(ReadonlyInj, ref(false))

/* stores */

const { commentsDrawer, changedColumns, isNew, loadRow: _loadRow, row: _row } = useExpandedFormStoreOrThrow()

const { isUIAllowed } = useRoles()

const viewsStore = useViewsStore()

const { sidebarWidth, onResizeStart } = useExpandedRecordSidebarWidth()

/* flags */

const showRightSections = computed(() => !props.hideSidebar && !isNew.value && commentsDrawer.value && isUIAllowed('commentList'))

const readOnly = computed(() => !isUIAllowed('dataEdit') || isPublic.value)

const hasAddFieldPermission = computed(() => {
  return !readOnlyView.value && isUIAllowed('fieldAdd')
})

/* attachments */

const attachmentFields = computed(() =>
  fields.value.concat(hiddenFields.value || []).filter((field) => field.uidt === UITypes.Attachment),
)

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
      activeAttachmentIndex.value = Math.min(
        activeAttachmentIndex.value,
        Math.max(0, (selectedFieldValue.value?.length ?? 0) - 1),
      )
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
        <div class="w-full h-full flex flex-col items-center justify-center bg-nc-bg-gray-light nc-files-no-attachment-field">
          <span class="text-base font-black"> No Attachment field </span>
          <span class="text-xs mt-3 text-center" :class="hasAddFieldPermission ? 'max-w-[200px]' : 'max-w-[300px]'">
            {{
              hasAddFieldPermission
                ? 'Create an attachment field to use file mode.'
                : 'At least one attachment field should be present to use file mode.'
            }}
          </span>
        </div>
      </template>
      <template v-else>
        <div class="hidden">
          <LazyCellAttachment ref="refAttachmentCell" v-model="attachmentVModel" />
        </div>
        <div class="w-full h-0 flex-1 flex flex-row relative">
          <template v-if="!hasAnyValueInAttachment">
            <div
              class="w-full h-full flex flex-col items-center justify-center bg-nc-bg-gray-light nc-files-no-attachment relative"
            >
              <span class="text-base font-black"> No Attachment </span>
              <span class="text-xs mt-3 w-[210px] text-center"> There are no attachments to display in this field </span>
              <PermissionsTooltip
                class="mt-3"
                :entity="PermissionEntity.FIELD"
                :entity-id="selectedFieldId"
                :permission="PermissionKey.RECORD_FIELD_EDIT"
              >
                <template #default="{ isAllowed }">
                  <NcButton type="secondary" size="small" :disabled="readOnly || !isAllowed" @click="openFilePicker()">
                    <template #icon>
                      <GeneralIcon icon="upload" />
                    </template>
                    Upload Attachment
                  </NcButton>
                </template>
              </PermissionsTooltip>

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
                      class="h-4 w-4 ml-1 text-nc-content-gray-muted aspect-square flex items-center justify-center"
                    />
                  </NcButton>
                </NcDropdownSelect>
              </div>
            </div>
          </template>
          <template v-else-if="compactLayout">
            <!-- Side-panel layout: preview on top, horizontal strip at bottom -->
            <div class="flex-1 flex flex-col relative w-full">
              <!-- Field selector — always present so the user knows which field
                   they're viewing; behaves as a single-item indicator when
                   only one attachment field exists. z-30 keeps it above the
                   carousel's full-height nav arrows (z-20) so clicks land on
                   the dropdown, not the left arrow. -->
              <div class="absolute top-3 left-3 z-30">
                <NcDropdownSelect
                  v-model="selectedFieldId"
                  class="nc-files-current-field-dropdown"
                  :items="attachmentFields.map((field) => ({ label: field.title || field.id!, value: field.id! }))"
                  overlay-class-name="w-[288px]"
                >
                  <NcTooltip :title="selectedField?.title" placement="bottom">
                    <button
                      class="nc-files-field-icon-btn flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md border-1 border-white/20 hover:bg-white/20 transition-all"
                    >
                      <GeneralIcon icon="cellAttachment" class="w-4 h-4 text-white" />
                    </button>
                  </NcTooltip>
                </NcDropdownSelect>
              </div>
              <div class="flex-1 min-h-0 overflow-hidden">
                <SmartsheetExpandedFormPresentorsAttachmentsInlinePreviewCarousel
                  v-model:active-index="activeAttachmentIndex"
                  :attachments="selectedFieldValue"
                  :is-edit-allowed="!readOnly"
                  @download="(att) => refAttachmentCell?.downloadAttachment?.(att)"
                  @rename="(att, idx) => refAttachmentCell?.renameAttachment?.(att, idx, true)"
                  @remove="(idx) => refAttachmentCell?.removeAttachment?.(idx)"
                  @add-file="openFilePicker()"
                />
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
            <div class="w-0 flex-1 bg-nc-bg-gray-light pl-[80px]">
              <SmartsheetExpandedFormPresentorsAttachmentsAttachmentView v-if="activeAttachment" :attachment="activeAttachment" />
            </div>
          </template>
        </div>
      </template>
    </div>
    <div
      v-if="showRightSections && !isUnsavedDuplicatedRecordExist"
      class="nc-comments-drawer border-l-1 rtl:(border-l-0 border-r-1) relative border-nc-border-gray-medium bg-nc-bg-gray-extralight h-full xs:hidden rounded-br-2xl flex-shrink-0"
      :style="{ width: `${sidebarWidth}px` }"
      :class="{
        active: commentsDrawer && isUIAllowed('commentList'),
      }"
    >
      <div class="nc-sidebar-resize-handle" @mousedown.prevent="onResizeStart" />
      <SmartsheetExpandedFormSidebar show-fields-tab :compact-mode="compactMode" />
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
    box-shadow: 0px 0px 4px 0px rgba(var(--rgb-base), 0.08);
  }
  &:not(:focus-within):hover:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-virtual-cell-button) {
    @apply !border-1;
    &:not(.nc-attachment-cell):not(.nc-virtual-cell-button) {
      box-shadow: 0px 0px 4px 0px rgba(var(--rgb-base), 0.24);
    }
  }

  &.nc-readonly-div-data-cell,
  &.nc-system-field {
    @apply !border-nc-border-gray-medium;

    .nc-cell,
    .nc-virtual-cell {
      @apply text-nc-content-gray-disabled;
    }
  }
  &.nc-readonly-div-data-cell:focus-within,
  &.nc-system-field:focus-within {
    @apply !border-nc-border-gray-medium;
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
        @apply !h-[84px] border-1 border-solid border-nc-border-gray-medium rounded;
      }
    }
    :deep(.nc-virtual-cell-barcode) {
      .nc-barcode-container {
        @apply border-1 rounded-lg border-nc-border-gray-medium h-[64px] max-w-full p-2;
        svg {
          @apply !h-full;
        }
      }
    }
  }
}

.nc-mentioned-cell {
  box-shadow: 0px 0px 0px 2px var(--ant-primary-color-outline) !important;
  @apply !border-nc-border-brand !border-1;
}

.nc-data-cell:focus-within {
  @apply !border-1 !border-nc-border-brand;
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

.nc-sidebar-resize-handle {
  @apply absolute left-0 top-0 h-full w-1 cursor-col-resize z-50 transition-colors;
}
.nc-sidebar-resize-handle:hover {
  @apply bg-nc-border-gray-medium;
}
</style>
