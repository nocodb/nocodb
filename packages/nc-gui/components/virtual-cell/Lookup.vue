<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType, LookupType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import {
  CellUrlDisableOverlayInj,
  CellValueInj,
  ColumnInj,
  MetaInj,
  computed,
  inject,
  isAttachment,
  provide,
  ref,
  useMetas,
  useShowNotEditableWarning,
  watch,
} from '#imports'

const { metas, getMeta } = useMetas()

const column = inject(ColumnInj, ref())

const meta = inject(MetaInj, ref())

const cellValue = inject(CellValueInj, ref())

const relationColumn = computed(
  () =>
    meta.value?.columns?.find((c: ColumnType) => c.id === (column.value?.colOptions as LookupType)?.fk_relation_column_id) as
      | (ColumnType & {
          colOptions: LinkToAnotherRecordType | undefined
        })
      | undefined,
)

watch(
  relationColumn,
  async (relationCol: { colOptions: LinkToAnotherRecordType }) => {
    if (relationCol && relationCol.colOptions) await getMeta(relationCol.colOptions.fk_related_model_id!)
  },
  { immediate: true },
)

const lookupTableMeta = computed<Record<string, any> | undefined>(() => {
  if (relationColumn.value && relationColumn.value?.colOptions)
    return metas.value[relationColumn.value.colOptions.fk_related_model_id!]

  return undefined
})

const lookupColumn = computed(
  () =>
    lookupTableMeta.value?.columns?.find((c: any) => c.id === (column.value?.colOptions as LookupType)?.fk_lookup_column_id) as
      | ColumnType
      | undefined,
)

const arrValue = computed(() => {
  if (!cellValue.value) return []

  // if lookup column is Attachment and relation type is Belongs to wrap the value in an array
  // since the attachment component expects an array or JSON string array
  if (lookupColumn.value?.uidt === UITypes.Attachment && relationColumn.value?.colOptions?.type === RelationTypes.BELONGS_TO)
    return [cellValue.value]

  if (Array.isArray(cellValue.value)) return cellValue.value

  return [cellValue.value]
})

provide(MetaInj, lookupTableMeta)

provide(CellUrlDisableOverlayInj, ref(true))

const { showEditNonEditableFieldWarning, showClearNonEditableFieldWarning, activateShowEditNonEditableFieldWarning } =
  useShowNotEditableWarning()
</script>

<template>
  <div class="h-full" @dblclick="activateShowEditNonEditableFieldWarning">
    <div class="h-full flex gap-1 overflow-x-auto p-1">
      <template v-if="lookupColumn">
        <!-- Render virtual cell -->
        <div v-if="isVirtualCol(lookupColumn)">
          <template
            v-if="lookupColumn.uidt === UITypes.LinkToAnotherRecord && lookupColumn.colOptions.type === RelationTypes.BELONGS_TO"
          >
            <LazySmartsheetVirtualCell
              v-for="(v, i) of arrValue"
              :key="i"
              :edit-enabled="false"
              :model-value="v"
              :column="lookupColumn"
              :read-only="true"
            />
          </template>

          <LazySmartsheetVirtualCell
            v-else
            :edit-enabled="false"
            :read-only="true"
            :model-value="arrValue"
            :column="lookupColumn"
          />
        </div>

        <!-- Render normal cell -->
        <template v-else>
          <div
            v-if="isAttachment(lookupColumn) && arrValue[0] && !Array.isArray(arrValue[0]) && typeof arrValue[0] === 'object'"
            class="min-w-max"
          >
            <LazySmartsheetCell :model-value="arrValue" :column="lookupColumn" :edit-enabled="false" :read-only="true" />
          </div>
          <!-- For attachment cell avoid adding chip style -->
          <template v-else>
            <div
              v-for="(v, i) of arrValue"
              :key="i"
              class="min-w-max"
              :class="{
                'bg-gray-100 px-1 rounded-full flex-1': !isAttachment(lookupColumn),
                'border-gray-200 rounded border-1': ![UITypes.Attachment, UITypes.MultiSelect, UITypes.SingleSelect].includes(
                  lookupColumn.uidt,
                ),
              }"
            >
              <LazySmartsheetCell
                :model-value="v"
                :column="lookupColumn"
                :edit-enabled="false"
                :virtual="true"
                :read-only="true"
              />
            </div>
          </template>
        </template>
      </template>
    </div>
    <div>
      <div v-if="showEditNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldEditWarning') }}
      </div>
      <div v-if="showClearNonEditableFieldWarning" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
        {{ $t('msg.info.computedFieldDeleteWarning') }}
      </div>
    </div>
  </div>
</template>
