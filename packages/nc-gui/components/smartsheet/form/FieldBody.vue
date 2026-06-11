<script lang="ts" setup>
import { isVirtualCol } from 'nocodb-sdk'

interface Props {
  field: Record<string, any>
}

defineProps<Props>()

const { formState, validateInfos, fieldMappings } = useFormViewStoreOrThrow()

const { row } = useSmartsheetRowStoreOrThrow()

// True when an attachment cell currently holds files — drives a static
// `nc-input-has-attachments` class that replaces a costly `:has()` CSS selector.
function isAttachmentCellWithFiles(col: Record<string, any>) {
  if (!isAttachment(col)) return false
  const val = formState.value?.[col.title]
  const arr = ncIsArray(val) ? val : ncIsString(val) ? parseProp(val) : []
  return ncIsArray(arr) && arr.length > 0
}
</script>

<template>
  <div class="nc-form-field-body">
    <div class="mt-2">
      <a-form-item
        v-if="fieldMappings[field.title]"
        :name="fieldMappings[field.title]"
        class="!my-0 nc-input-required-error nc-form-input-item"
        v-bind="validateInfos[fieldMappings[field.title]]"
      >
        <LazySmartsheetDivDataCell class="relative" @click.stop>
          <LazySmartsheetVirtualCell
            v-if="isVirtualCol(field)"
            v-model="formState[field.title]"
            :row="row"
            class="nc-input"
            :class="`nc-form-input-${field.title.replaceAll(' ', '')}`"
            :data-testid="`nc-form-input-${field.title.replaceAll(' ', '')}`"
            :column="field"
          />
          <LazySmartsheetCell
            v-else
            v-model="formState[field.title]"
            class="nc-input truncate"
            :class="[
              `nc-form-input-${field.title.replaceAll(' ', '')}`,
              {
                'layout-list': field.meta.isList,
                'nc-input-has-attachments': isAttachmentCellWithFiles(field),
              },
            ]"
            :data-testid="`nc-form-input-${field.title.replaceAll(' ', '')}`"
            :column="field"
            :edit-enabled="true"
          />
        </LazySmartsheetDivDataCell>
      </a-form-item>

      <div>
        <LazySmartsheetFormFieldConfigError :column="field" mode="preview" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-input {
  @apply appearance-none w-full;
  // Bordered-input style for all non-list cells except attachment cells that have
  // files (their attachment display has its own chrome). Uses a static class
  // (`nc-input-has-attachments`) instead of `:has(...)` — the relational selector
  // forced Blink to re-scan every `.nc-input` subtree on ANY in-form style change
  // (e.g. the activeRow class toggle), which was the dominant RecalcStyle cost on
  // large forms. A direct class is O(1) invalidation.
  &:not(.layout-list):not(.nc-input-has-attachments) {
    @apply !bg-nc-bg-default rounded-lg border-solid border-1 border-nc-border-gray-medium !focus-within:border-nc-border-brand;
  }
  &.layout-list {
    @apply h-auto !p-0;
  }

  &.nc-cell-geodata {
    @apply !py-1;
  }
  &.nc-cell-currency {
    @apply !py-0 !pl-0 flex items-stretch;
  }

  &:not(.nc-cell-datetime) {
    :deep(input) {
      &:not(.ant-select-selection-search-input) {
        @apply !px-1;
      }
    }
  }

  &.nc-cell-longtext {
    @apply p-0 h-auto;
  }
  &.nc-cell:not(.nc-cell-longtext) {
    @apply p-2;
  }

  :deep(&.nc-cell:not(.nc-cell-longtext)) {
    &.nc-cell-phonenumber,
    &.nc-cell-email,
    &.nc-cell-url {
      .nc-cell-field.nc-cell-link-preview {
        @apply px-3;
      }
    }
  }
  &.nc-virtual-cell {
    @apply px-2 py-1 min-h-10;
  }

  &.nc-cell-json {
    @apply min-h-[38px] h-auto;
    & > div {
      @apply w-full;
    }
  }

  :deep(.ant-picker) {
    @apply !py-0;
  }
  :deep(input.nc-cell-field) {
    @apply !py-0;
  }
}

.nc-input-required-error {
  max-width: 100%;
  white-space: pre-line;
  :deep(.ant-form-item-explain-error) {
    &:first-child {
      @apply mt-2;
    }
  }
  &:focus-within {
    :deep(.ant-form-item-explain-error) {
      @apply text-nc-content-gray-disabled;
    }
  }
}

:deep(.ant-form-item-has-error .ant-select:not(.ant-select-disabled) .ant-select-selector) {
  border: none !important;
}
:deep(.ant-form-item-has-success .ant-select:not(.ant-select-disabled) .ant-select-selector) {
  border: none !important;
}

:deep(.nc-cell-attachment) {
  @apply p-0;

  .nc-attachment-cell {
    @apply px-4 min-h-[75px] w-full h-full;

    .nc-attachment {
      @apply md: (w-[50px] h-[50px]) lg:(w-[75px] h-[75px]) min-h-[50px] min-w-[50px];
    }

    .nc-attachment-cell-dropzone {
      @apply rounded bg-nc-bg-gray-extradark/75;
    }
  }
}

.nc-form-input-item .nc-data-cell {
  @apply !border-none rounded-none;

  &:focus-within {
    @apply !border-none;
  }
}

.nc-form-field-body {
  :deep(.nc-cell) {
    @apply my-0;
  }
}
</style>
