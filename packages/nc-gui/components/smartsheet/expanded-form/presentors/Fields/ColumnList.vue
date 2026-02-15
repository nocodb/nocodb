<script setup lang="ts">
import { type ColumnType, type LinkToAnotherRecordType, type TableType, PermissionEntity, PermissionKey, isLinksOrLTAR, isVirtualCol } from 'nocodb-sdk'

const props = defineProps<{
  fields: ColumnType[]
  forceVerticalMode?: boolean
  isLoading: boolean
  showColCallback?: (col: ColumnType) => boolean
  isHiddenCol?: boolean
}>()

const { changedColumns, localOnlyChanges, isNew, loadRow: _loadRow, row: _row } = useExpandedFormStoreOrThrow()

const { isSqlView } = useSmartsheetStoreOrThrow()

const isPublic = inject(IsPublicInj, ref(false))

const meta = inject(MetaInj, ref())

const isTemplateMode = inject(IsTemplateModeInj, ref(false))

const blueprintParentTableId = inject(BlueprintParentTableIdInj, ref())

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const { getMeta } = useMetas()

const { open: openExpandedFormDetached } = useExpandedFormDetached()

const readOnly = computed(() => !isUIAllowed('dataEdit') || isPublic.value || isSqlView.value)

const isParentLtarColumn = (col: ColumnType): boolean => {
  if (!blueprintParentTableId.value || !isLinksOrLTAR(col)) return false
  const colOptions = col.colOptions as LinkToAnotherRecordType
  return colOptions?.fk_related_model_id === blueprintParentTableId.value
}

const addBlueprintForColumn = async (col: ColumnType) => {
  const colOptions = col.colOptions as LinkToAnotherRecordType
  const relatedTableId = colOptions?.fk_related_model_id
  const baseId = meta.value?.base_id
  if (!relatedTableId || !baseId) return

  try {
    const relatedMeta = (await getMeta(baseId, relatedTableId)) as TableType
    if (!relatedMeta) return

    openExpandedFormDetached({
      isOpen: true,
      row: { row: {}, oldRow: {}, rowMeta: { new: true } },
      meta: relatedMeta,
      loadRow: false,
      useMetaFields: true,
      blueprintMode: true,
      blueprintParentTableId: meta.value?.id,
      newRecordSubmitBtnText: 'Save Blueprint',
      newRecordHeader: `New ${relatedMeta.title} (Blueprint)`,
      createdRecord: (record: Record<string, any>) => {
        const blueprint = { ...record, _isBlueprint: true }
        // Ensure ltarState structure exists
        if (!_row.value.rowMeta) _row.value.rowMeta = {}
        if (!_row.value.rowMeta.ltarState) _row.value.rowMeta.ltarState = {}

        if (isHm(col) || isMm(col)) {
          if (!_row.value.rowMeta.ltarState[col.title!]) {
            _row.value.rowMeta.ltarState[col.title!] = []
          }
          _row.value.rowMeta.ltarState[col.title!].push(blueprint)
        } else {
          // BT or OO — single linked record
          _row.value.rowMeta.ltarState[col.title!] = blueprint
        }
      },
    })
  } catch (e) {
    console.error('Failed to open blueprint form:', e)
  }
}

const getRelatedTableName = (col: ColumnType): string => {
  const colOptions = col.colOptions as LinkToAnotherRecordType
  const relatedTableId = colOptions?.fk_related_model_id
  const baseId = meta.value?.base_id
  if (!relatedTableId || !baseId) return 'Sub Record'
  const { getMetaByKey } = useMetas()
  const relatedMeta = getMetaByKey(baseId, relatedTableId)
  return relatedMeta?.title || 'Sub Record'
}

const showCol = (col: ColumnType) => {
  return props.showColCallback?.(col) || !isVirtualCol(col) || !isNew.value || isLinksOrLTAR(col)
}

const revertLocalOnlyChanges = (col: string) => {
  if (localOnlyChanges.value[col]) {
    _row.value.row[col] = localOnlyChanges.value[col]
    changedColumns.value.delete(col)
    delete localOnlyChanges.value[col]
  }
}

const isSyncedColumn = (column: ColumnType) => meta.value?.synced && column?.readonly
</script>

<template>
  <div
    v-for="col of fields"
    v-show="showCol(col)"
    :key="col.title"
    :class="`nc-expand-col-${col.title}`"
    :col-id="col.id"
    :data-testid="`nc-expand-col-${col.title}`"
    class="nc-expanded-form-row w-full"
  >
    <div
      class="flex items-start nc-expanded-cell min-h-[32px]"
      :class="{
        'flex-row <lg:(flex-col w-full)': !props.forceVerticalMode,
        'flex-col w-full': props.forceVerticalMode,
      }"
    >
      <div
        class="flex-none flex items-center rounded-lg overflow-hidden"
        :class="{
          'w-45 <lg:(w-full px-0 mb-2) h-[32px] xs:(h-auto) sm:(mx-2)': !props.forceVerticalMode,
          'w-full px-0 mb-2 h-auto': props.forceVerticalMode,
        }"
      >
        <LazySmartsheetHeaderVirtualCell
          v-if="isVirtualCol(col)"
          :column="col"
          class="nc-expanded-cell-header h-full flex-none"
          :is-hidden-col="isHiddenCol"
          show-lock-icon
        />
        <LazySmartsheetHeaderCell
          v-else
          :column="col"
          class="nc-expanded-cell-header flex-none"
          :is-hidden-col="isHiddenCol"
          show-lock-icon
        />
      </div>

      <a-skeleton-input
        v-if="isLoading"
        active
        class="flex-none h-8 <lg:!w-full lg:flex-1 !rounded-lg !overflow-hidden"
        :class="{
          '!h-[151px]': isTextArea(col),
          '!h-[118px]': isAttachment(col),
          '!h-[80px]': isQrCode(col),
          '!h-[64px]': isBarcode(col),
          '!h-[38px]': isButton(col),
        }"
        size="small"
      />
      <NcTooltip
        v-else
        :tooltip-style="{ zIndex: '1049' }"
        class="<lg:(!w-full !flex-none) lg:flex-1 flex"
        :class="{
          'w-full !flex-none': props.forceVerticalMode,
          'lg:max-w-[calc(100%_-_188px)]': !props.forceVerticalMode,
        }"
        :placement="isMobileMode ? 'top' : 'right'"
        :disabled="!showReadonlyColumnTooltip(col) && !isParentLtarColumn(col)"
        :arrow="false"
      >
        <template #title>{{
          isParentLtarColumn(col) ? 'This field will be auto-linked to the parent record' : $t('msg.info.fieldReadonly')
        }}</template>
        <PermissionsTooltip
          v-if="col.title"
          class="w-full"
          :tooltip-style="{ zIndex: '1049' }"
          :entity="PermissionEntity.FIELD"
          :entity-id="col.id"
          :permission="PermissionKey.RECORD_FIELD_EDIT"
          :placement="isMobileMode ? 'top' : 'right'"
          :show-pointer-event-none="false"
          hide-on-click
          :disabled="showReadonlyColumnTooltip(col) || !showEditRestrictedColumnTooltip(col)"
        >
          <template #default="{ isAllowed }">
            <SmartsheetDivDataCell
              class="flex-1 bg-nc-bg-default px-1 min-h-8 flex items-center relative"
              :class="{
                'w-full': props.forceVerticalMode,
                '!select-text nc-system-field !bg-nc-bg-gray-extralight !text-nc-content-inverted-primary-disabled':
                  showReadonlyColumnTooltip(col) || isParentLtarColumn(col),
                '!select-text nc-readonly-div-data-cell': readOnly || !isAllowed || isSyncedColumn(col),
              }"
            >
              <LazySmartsheetVirtualCell
                v-if="isVirtualCol(col)"
                v-model="_row.row[col.title]"
                :column="col"
                :read-only="readOnly || !isAllowed || isSyncedColumn(col) || isParentLtarColumn(col)"
                :row="_row"
                :is-allowed="isAllowed"
              />

              <LazySmartsheetCell
                v-else
                v-model="_row.row[col.title]"
                :active="true"
                :column="col"
                :edit-enabled="true"
                :read-only="
                  ncIsPlaywright()
                    ? readOnly || !isAllowed || isSyncedColumn(col)
                    : readOnly || !isAllowed || showReadonlyColumnTooltip(col) || isSyncedColumn(col)
                "
                :is-allowed="isAllowed"
                @update:model-value="changedColumns.add(col.title)"
              />
            </SmartsheetDivDataCell>
          </template>
        </PermissionsTooltip>
      </NcTooltip>
      <div
        v-if="col.title && localOnlyChanges[col.title]"
        class="flex items-center justify-center cursor-pointer relative"
        @click="revertLocalOnlyChanges(col.title)"
      >
        <GeneralIcon
          class="absolute right-1 top-2 text-nc-content-gray-muted hover:text-nc-content-gray-subtle my-auto"
          icon="reload"
        />
      </div>
    </div>

    <!-- Add Blueprint button below LTAR fields in template mode -->
    <div
      v-if="isTemplateMode && isLinksOrLTAR(col) && !readOnly && !isParentLtarColumn(col)"
      class="flex items-center"
      :class="{
        'flex-row <lg:pl-0': !props.forceVerticalMode,
        'pl-0': props.forceVerticalMode,
      }"
    >
      <div
        v-if="!props.forceVerticalMode"
        class="flex-none w-45 <lg:hidden sm:mx-2"
      />
      <div class="flex items-center gap-2">
        <NcButton type="secondary" size="small" class="!mt-1" @click.stop="addBlueprintForColumn(col)">
          <div class="flex items-center gap-1">
            <GeneralIcon icon="plus" class="h-3.5 w-3.5" />
            <span>Add {{ getRelatedTableName(col) }} Template</span>
          </div>
        </NcButton>
        <NcTooltip placement="bottom" class="flex items-center !mt-1">
          <template #title>
            A new {{ getRelatedTableName(col) }} record will be created and linked each time this template is used
          </template>
          <GeneralIcon icon="info" class="h-3.5 w-3.5 text-nc-content-gray-subtle" />
        </NcTooltip>
      </div>
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

  .nc-cell,
  .nc-virtual-cell {
    @apply h-auto;
  }

  &.nc-readonly-div-data-cell,
  &.nc-system-field {
    @apply !border-nc-border-gray-medium;

    .nc-cell,
    .nc-virtual-cell {
      @apply text-nc-content-gray-muted;
    }
  }

  &.nc-readonly-div-data-cell:focus-within,
  &.nc-system-field:focus-within {
    @apply !border-nc-border-gray-medium;
  }

  &:focus-within:not(.nc-readonly-div-data-cell):not(.nc-system-field) {
    @apply !shadow-selected;
  }

  :deep(.nc-lookup-cell) {
    .nc-qrcode-container {
      height: 100%;
    }

    .nc-multi-select {
      > div {
        margin-top: 3px;
      }
    }
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
        @apply !h-full border-1 border-solid border-nc-border-gray-medium rounded;
      }
    }

    :deep(.nc-virtual-cell-barcode) {
      .nc-barcode-container {
        @apply border-1 rounded-lg border-nc-border-gray-medium h-[64px] max-w-full p-2 dark:bg-white;

        svg {
          @apply !h-full;
        }
      }
    }
  }

  .nc-cell-json {
    @apply;
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
</style>
