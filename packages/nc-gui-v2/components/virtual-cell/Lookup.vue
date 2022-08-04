<script lang="ts" setup>
import { ColumnType, LinkToAnotherRecordType, LookupType, isVirtualCol } from 'nocodb-sdk'
import { useColumn } from '~/composables'
import { ColumnInj, EditModeInj, MetaInj, ReadonlyInj, ValueInj } from '~/context'


const {metas, getMeta} = useMetas();

provide(ReadonlyInj, true);

const column = inject(ColumnInj) as ColumnType & { colOptions: LookupType };
const meta = inject(MetaInj);
const value = inject(ValueInj);

const relationColumn =  meta?.value.columns?.find(c => c.id === column.colOptions.fk_relation_column_id) as ColumnType & { colOptions: LinkToAnotherRecordType };
await getMeta(relationColumn.colOptions.fk_related_model_id as string);
const lookupTableMeta  = metas?.value[relationColumn.colOptions.fk_related_model_id as string];
const lookupColumn  = lookupTableMeta?.columns?.find(c => c.id === column.colOptions.fk_lookup_column_id) as ColumnType;

provide(MetaInj, ref(lookupTableMeta));

const lookupColumnMetaProps = useColumn(lookupColumn)

</script>

<template>
  <div class="w-full h-full">
    {{lookupColumnMetaProps}}
    <SmartsheetVirtualCell
      :edit-enabled="false" v-if="isVirtualCol(lookupColumn)" v-model="value"       :column="lookupColumn"
    />

    <SmartsheetCell
      v-else
      v-model="value"
      :column="lookupColumn"
      :edit-enabled="false"
    />
  </div>
</template>
