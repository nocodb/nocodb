<script setup lang="ts">
import { type ColumnType, PermissionEntity, PermissionKey, isLinksOrLTAR, isVirtualCol } from 'nocodb-sdk'

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

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const readOnly = computed(() => !isUIAllowed('dataEdit') || isPublic.value || isSqlView.value)

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
        class="h-8 flex-none <lg:!w-full lg:flex-1 !rounded-lg !overflow-hidden"
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
        :disabled="!showReadonlyColumnTooltip(col)"
        :arrow="false"
      >
        <template #title>{{ $t('msg.info.fieldReadonly') }}</template>
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
                  showReadonlyColumnTooltip(col),
                '!select-text nc-readonly-div-data-cell': readOnly || !isAllowed,
              }"
            >
              <LazySmartsheetVirtualCell
                v-if="isVirtualCol(col)"
                v-model="_row.row[col.title]"
                :column="col"
                :read-only="readOnly || !isAllowed"
                :row="_row"
                :is-allowed="isAllowed"
              />

              <LazySmartsheetCell
                v-else
                v-model="_row.row[col.title]"
                :active="true"
                :column="col"
                :edit-enabled="true"
                :read-only="ncIsPlaywright() ? readOnly || !isAllowed : readOnly || !isAllowed || showReadonlyColumnTooltip(col)"
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
        @apply border-1 rounded-lg border-nc-border-gray-medium h-[64px] max-w-full p-2;
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
