<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isHiddenCol, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'

const props = defineProps<{
  // As we need to focus search box when the parent is opened
  isParentOpen: boolean
  columns?: ColumnType[]
}>()

const emits = defineEmits(['created'])

const { isParentOpen, columns } = toRefs(props)

const meta = inject(MetaInj, ref())

const { showSystemFields, metaColumnById } = useViewColumnsOrThrow()

const { groupBy } = useViewGroupByOrThrow()

const options = computed<ColumnType[]>(
  () =>
    (columns.value || meta.value?.columns)
      ?.filter((c: ColumnType) => {
        if (c.uidt === UITypes.Links) {
          return true
        }
        if (isSystemColumn(metaColumnById?.value?.[c.id!])) {
          /** hide system columns if not enabled */
          if (c?.colOptions) {
            /** ignore virtual fields which are system fields ( mm relation ) and qr code fields */
            return false
          }

          if (isHiddenCol(c, meta.value)) {
            /** ignore mm relation column, created by and last modified by system field */
            return false
          }

          return showSystemFields.value
        } else if (c.uidt === UITypes.QrCode || c.uidt === UITypes.Barcode || c.uidt === UITypes.ID) {
          return false
        } else {
          /** ignore hasmany and manytomany relations if it's using within group menu */
          return !(
            isLinksOrLTAR(c) &&
            ![RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(
              (c.colOptions as LinkToAnotherRecordType).type as RelationTypes,
            )
          )
        }
      })
      .filter((c: ColumnType) => !groupBy.value.find((g) => g.column?.id === c.id)) ?? [],
)

const onClick = (column: ColumnType) => {
  emits('created', column)
}
</script>

<template>
  <div class="nc-group-by-create-modal">
    <SmartsheetToolbarFieldListWithSearch
      :is-parent-open="isParentOpen"
      :search-input-placeholder="$t('msg.selectFieldToGroup')"
      :options="options"
      toolbar-menu="groupBy"
      @selected="onClick"
    />
  </div>
</template>
