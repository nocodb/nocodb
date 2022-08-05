<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType, LookupType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { useColumn } from '~/composables'
import { ColumnInj, MetaInj, ReadonlyInj, ValueInj } from '~/context'

const { metas, getMeta } = useMetas()

provide(ReadonlyInj, true)

const column = inject(ColumnInj) as ColumnType & { colOptions: LookupType }
const meta = inject(MetaInj)
const value = inject(ValueInj)
const arrValue = Array.isArray(value) ? value : [value]

const relationColumn = meta?.value.columns?.find((c) => c.id === column.colOptions.fk_relation_column_id) as ColumnType & {
  colOptions: LinkToAnotherRecordType
}
await getMeta(relationColumn.colOptions.fk_related_model_id as string)
const lookupTableMeta = metas?.value[relationColumn.colOptions.fk_related_model_id as string]
const lookupColumn = lookupTableMeta?.columns?.find((c) => c.id === column.colOptions.fk_lookup_column_id) as ColumnType

provide(MetaInj, ref(lookupTableMeta))

const lookupColumnMetaProps = useColumn(lookupColumn)
</script>

<template>
  <div class="w-full h-full flex gap-1">
    <template v-if="lookupColumn">
      <!-- Render virtual cell -->
      <div v-if="isVirtualCol(lookupColumn)">
        <template
          v-if="lookupColumn.uidt === UITypes.LinkToAnotherRecord && lookupColumn.colOptions.type === RelationTypes.BELONGS_TO"
        >
          <SmartsheetVirtualCell
            v-for="(v, i) of arrValue"
            :key="i"
            :edit-enabled="false"
            :model-value="v"
            :column="lookupColumn"
          />
        </template>

        <SmartsheetVirtualCell v-else :edit-enabled="false" :model-value="arrValue" :column="lookupColumn" />
      </div>

      <!-- Render normal cell -->
      <template v-else>
        <!-- For attachment cell avoid adding chip style -->
        <div
          v-for="(v, i) in arrValue"
          :key="i"
          :class="{ 'bg-gray-100 px-2 rounded-full': !lookupColumnMetaProps.isAttachment }"
        >
          <SmartsheetCell :model-value="v" :column="lookupColumn" :edit-enabled="false" />
        </div>
      </template>
    </template>
  </div>
</template>
