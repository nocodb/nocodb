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

const props = withDefaults(defineProps<Props>(), {
  border: true,
  truncate: true,
})

const emit = defineEmits(['unlink'])

const { item, value, column, readonly: readonlyProp } = toRefs(props)

const { relatedTableMeta, externalBaseUserRoles, row: parentRow } = useLTARStoreOrThrow()!

const injectedColumn = inject(ColumnInj, ref())

const parentTableMeta = inject(MetaInj, ref())

const { isUIAllowed } = useRoles()

provide(IsUnderLTARInj, ref(true))

provide(MetaInj, relatedTableMeta)

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const isForm = inject(IsFormInj)!

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const reloadTrigger = inject(ReloadRowDataHookInj, createEventHook())

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const parentBreadcrumbs = inject(TemplateBreadcrumbsInj, ref([]))

/** Whether this chip represents a blueprint (unsaved sub-record template) vs. an existing record */
const isBlueprint = computed(() => !!item.value?._isBlueprint)

const isClickDisabled = computed(() => {
  return (!active.value && !isExpandedForm.value) || isPublic.value || isForm.value || readonlyProp.value
})

const { open } = useExpandedFormDetached()

/**
 * Open the blueprint editor for this chip's blueprint data.
 * Strips internal flags (_isBlueprint, _ltarState) before populating the form,
 * and passes nested ltarState so sub-blueprints are preserved for editing.
 * On save, the updated blueprint replaces the original in the parent's ltarState.
 */
function openBlueprintEditor() {
  if (isClickDisabled.value) return

  const { _isBlueprint, _ltarState, ...blueprintData } = item.value
  const nestedLtarState = _ltarState && Object.keys(_ltarState).length ? _ltarState : undefined

  // Build breadcrumb trail: append current (parent) table name
  const breadcrumbs = [...parentBreadcrumbs.value, parentTableMeta.value?.title || '']

  open({
    isOpen: true,
    row: { row: { ...blueprintData }, oldRow: {}, rowMeta: { new: true, ltarState: nestedLtarState } },
    state: nestedLtarState,
    meta: relatedTableMeta.value,
    loadRow: false,
    useMetaFields: true,
    blueprintMode: true,
    blueprintParentTableId: parentTableMeta.value?.id,
    breadcrumbs,
    newRecordSubmitBtnText: 'Save Record',
    newRecordHeader: `Edit ${relatedTableMeta.value?.title} Record`,
    createdRecord: (record: Record<string, any>) => {
      const updatedBlueprint = { ...record, _isBlueprint: true }
      const colTitle = injectedColumn.value?.title
      if (!colTitle || !parentRow.value?.rowMeta?.ltarState) return

      const ltarState = parentRow.value.rowMeta.ltarState
      if (Array.isArray(ltarState[colTitle])) {
        // Find and replace the old blueprint in the array
        const idx = ltarState[colTitle].indexOf(item.value)
        if (idx !== -1) {
          ltarState[colTitle].splice(idx, 1, updatedBlueprint)
        }
      } else {
        // BT/OO — single value, just replace
        ltarState[colTitle] = updatedBlueprint
      }
    },
  })
}

function openExpandedForm() {
  if (isClickDisabled.value) return

  // Blueprint records open in blueprint editor instead
  if (isBlueprint.value) {
    openBlueprintEditor()
    return
  }

  const rowId = extractPkFromRow(item.value, relatedTableMeta.value.columns as ColumnType[])

  if (!rowId) return

  open({
    isOpen: true,
    row: { row: item.value, rowMeta: {}, oldRow: { ...item.value } },
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
                'border-nc-border-gray-medium rounded border-1 blue-chip':
                  !isBlueprint &&
                  border &&
                  ![UITypes.Attachment, UITypes.MultiSelect, UITypes.SingleSelect].includes(column.uidt),
                'rounded border-1 border-dashed blueprint-chip':
                  isBlueprint && border && ![UITypes.Attachment, UITypes.MultiSelect, UITypes.SingleSelect].includes(column.uidt),
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
      v-if="showUnlinkButton && !readOnly && (isUIAllowed('dataEdit', externalBaseUserRoles) || isForm)"
      class="flex items-center cursor-pointer"
    >
      <component
        :is="iconMap.closeThick"
        class="nc-icon unlink-icon text-nc-content-gray-muted/50 group-hover:text-nc-content-gray-muted ml-0.5 cursor-pointer"
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
    @apply !bg-nc-bg-brand dark:!bg-nc-bg-gray-light !border-none px-2 py-[3px] rounded-lg;
    &,
    & * {
      @apply !text-nc-content-brand !bg-nc-bg-brand dark:!bg-nc-bg-gray-light;
    }

    :deep(.clamped-text) {
      @apply !block text-ellipsis;
    }
  }

  .blueprint-chip {
    @apply !bg-nc-bg-gray-extralight !border-nc-border-gray-medium px-2 py-[3px] rounded-lg;
    &,
    & * {
      @apply !text-nc-content-gray-muted !bg-nc-bg-gray-extralight;
    }

    :deep(.clamped-text) {
      @apply !block text-ellipsis;
    }
  }
}
</style>
