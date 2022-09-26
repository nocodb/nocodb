<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType, LookupType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  CellUrlDisableOverlayInj,
  CellValueInj,
  ColumnInj,
  MetaInj,
  ReadonlyInj,
  computed,
  inject,
  isAttachment,
  provide,
  ref,
  useMetas,
  watch,
} from '#imports'

const { metas, getMeta } = useMetas()

provide(ReadonlyInj, true)

const column = inject(ColumnInj)! as Ref<ColumnType & { colOptions: LookupType }>

const meta = inject(MetaInj, ref())

const value = inject(CellValueInj)

const arrValue = computed(() => (Array.isArray(value?.value) ? value?.value : [value?.value]) ?? [])

const relationColumn = computed(
  () =>
    meta.value?.columns?.find((c) => c.id === column.value.colOptions?.fk_relation_column_id) as ColumnType & {
      colOptions: LinkToAnotherRecordType
    },
)

watch(
  relationColumn,
  async () => {
    await getMeta(relationColumn.value.colOptions.fk_related_model_id!)
  },
  { immediate: true },
)

const lookupTableMeta = computed(() => metas.value[relationColumn.value.colOptions.fk_related_model_id!])

const lookupColumn = computed<any>(
  () =>
    lookupTableMeta.value.columns?.find(
      (c: Record<string, any>) => c.id === column.value.colOptions?.fk_lookup_column_id,
    ) as ColumnType,
)

provide(MetaInj, lookupTableMeta)
provide(CellUrlDisableOverlayInj, ref(true))
</script>

<template>
  <div class="h-full flex gap-1">
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
          />
        </template>

        <LazySmartsheetVirtualCell v-else :edit-enabled="false" :model-value="arrValue" :column="lookupColumn" />
      </div>

      <!-- Render normal cell -->
      <template v-else>
        <!-- For attachment cell avoid adding chip style -->
        <div
          v-for="(v, i) of arrValue"
          :key="i"
          class="min-w-max"
          :class="{
            'bg-gray-100 px-1 rounded-full flex-1': !isAttachment(lookupColumn),
            ' border-gray-200 rounded border-1': ![UITypes.Attachment, UITypes.MultiSelect, UITypes.SingleSelect].includes(
              lookupColumn.uidt,
            ),
          }"
        >
          <LazySmartsheetCell :model-value="v" :column="lookupColumn" :edit-enabled="false" :virtual="true" />
        </div>
      </template>
    </template>
  </div>
</template>
