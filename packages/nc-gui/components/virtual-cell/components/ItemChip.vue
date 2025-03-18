<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'

interface Props {
  value: string | number | boolean
  item: any
  column: any
  showUnlinkButton?: boolean
  border?: boolean
  readonly?: boolean
  truncate?: boolean
}

const { value, item, column, showUnlinkButton, border = true, readonly: readonlyProp, truncate = true } = defineProps<Props>()

const emit = defineEmits(['unlink'])

const { relatedTableMeta } = useLTARStoreOrThrow()!

const { isUIAllowed } = useRoles()

provide(IsUnderLTARInj, ref(true))

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const isForm = inject(IsFormInj)!

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const isClickDisabled = computed(() => {
  return !active.value && !isExpandedForm.value
})

const { open } = useExpandedFormDetached()

function openExpandedForm() {
  if (isClickDisabled.value) return

  const rowId = extractPkFromRow(item, relatedTableMeta.value.columns as ColumnType[])
  if (!readOnly.value && !readonlyProp && rowId) {
    open({
      isOpen: true,
      row: { row: item, rowMeta: {}, oldRow: { ...item } },
      meta: relatedTableMeta.value,
      rowId,
      useMetaFields: true,
      maintainDefaultViewOrder: true,
      loadRow: !isPublic.value,
      skipReload: true,
      createdRecord: onCreatedRecord,
    })

    function onCreatedRecord() {
      reloadTrigger?.trigger({
        shouldShowLoading: false,
      })

      reloadViewDataTrigger?.trigger({
        shouldShowLoading: false,
        isFromLinkRecord: true,
        relatedTableMetaId: relatedTableMeta.value.id,
        rowId: rowId!,
      })
    }
  }
}
</script>

<script lang="ts">
export default {
  name: 'ItemChip',
}
</script>

<template>
  <div
    v-e="['c:row-expand:open']"
    class="chip group mr-1 my-0.5 flex items-center rounded-[2px] flex-row"
    :class="{ active, 'border-1 py-1 px-2': isAttachment(column), truncate, 'cursor-pointer': !isClickDisabled }"
    @click.stop="openExpandedForm"
  >
    <div class="text-ellipsis overflow-hidden pointer-events-none">
      <span class="name">
        <!-- Render virtual cell except formula -->
        <div v-if="isVirtualCol(column) && column.uidt !== UITypes.Formula">
          <LazySmartsheetVirtualCell :edit-enabled="false" :read-only="true" :model-value="value" :column="column" />
        </div>
        <!-- Render normal cell and formula -->
        <template v-else>
          <div v-if="isAttachment(column) && value && !Array.isArray(value) && typeof value === 'object'">
            <LazySmartsheetCell :model-value="value" :column="column" :edit-enabled="false" :read-only="true" />
          </div>
          <!-- For attachment cell avoid adding chip style -->
          <template v-else>
            <div
              :class="{
                'px-1 rounded-full flex-1': !isAttachment(column),
                'border-gray-200 rounded border-1 blue-chip':
                  border && ![UITypes.Attachment, UITypes.MultiSelect, UITypes.SingleSelect].includes(column.uidt),
              }"
            >
              <LazySmartsheetCell
                v-if="!isVirtualCol(column)"
                :model-value="value"
                :column="column"
                :edit-enabled="false"
                :virtual="true"
                :read-only="true"
              />
              <LazySmartsheetVirtualCell
                v-else
                :edit-enabled="false"
                :read-only="true"
                :model-value="value"
                :column="column"
                class="!max-h-5"
              />
            </div>
          </template>
        </template>
      </span>
    </div>

    <div
      v-show="active || isForm || isExpandedForm"
      v-if="showUnlinkButton && !readOnly && isUIAllowed('dataEdit')"
      class="flex items-center cursor-pointer"
    >
      <component
        :is="iconMap.closeThick"
        class="nc-icon unlink-icon text-gray-500/50 group-hover:text-gray-500 ml-0.5 cursor-pointer"
        @click.stop="emit('unlink')"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.chip {
  max-width: max(100%, 60px);

  .name {
    white-space: nowrap;
    word-break: keep-all;
  }

  :deep(.nc-action-icon) {
    @apply invisible;
  }

  :deep(.nc-cell) {
    &.nc-cell-longtext {
      .long-text-wrapper {
        @apply min-h-1;
        .nc-readonly-rich-text-wrapper {
          @apply !min-h-1;
        }

        .nc-rich-text {
          @apply pl-0;
          .tiptap.ProseMirror {
            @apply -ml-1 min-h-1;
          }
        }
      }
    }

    &.nc-cell-checkbox {
      @apply children:pl-0;
      & > div {
        @apply !h-auto;
      }
    }

    &.nc-cell-singleselect .nc-cell-field > div {
      @apply flex items-center;
    }

    &.nc-cell-multiselect .nc-cell-field > div {
      @apply h-5;
    }

    &.nc-cell-email,
    &.nc-cell-phonenumber {
      @apply flex items-center;
    }

    &.nc-cell-email,
    &.nc-cell-phonenumber,
    &.nc-cell-url {
      .nc-cell-field-link {
        @apply py-0;
      }
    }
  }

  .blue-chip {
    @apply !bg-nc-bg-brand !border-none px-2 py-[3px] rounded-lg;
    &,
    & * {
      @apply !text-nc-content-brand !bg-nc-bg-brand;
    }

    :deep(.clamped-text) {
      @apply !block text-ellipsis;
    }
  }
}
</style>
