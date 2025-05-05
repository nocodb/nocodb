<script lang="ts" setup>
import { type ColumnType, UITypesName, type LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isHiddenCol, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'

import rfdc from 'rfdc'

const props = defineProps<{
  // As we need to focus search box when the parent is opened
  isParentOpen: boolean
}>()

const emits = defineEmits(['created'])

const { isParentOpen } = toRefs(props)

const clone = rfdc()

const activeView = inject(ActiveViewInj, ref())

const meta = inject(MetaInj, ref())

const { showSystemFields, metaColumnById } = useViewColumnsOrThrow(activeView, meta)

const { sorts } = useViewSorts(activeView)

const options = computed<ColumnType[]>(() =>
  (
    clone(meta.value?.columns)
      ?.filter((c: ColumnType) => {
        if (c.uidt === UITypes.Links) {
          return true
        }
        if (isSystemColumn(metaColumnById?.value?.[c.id!])) {
          if (isHiddenCol(c, meta.value)) {
            /** ignore mm relation column, created by and last modified by system field */
            return false
          }

          return (
            /** hide system columns if not enabled */
            showSystemFields.value
          )
        } else {
          /** ignore hasmany and manytomany relations if it's using within sort menu */
          return !(
            isLinksOrLTAR(c) &&
            ![RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(
              (c.colOptions as LinkToAnotherRecordType).type as RelationTypes,
            )
          )
          /** ignore virtual fields which are system fields ( mm relation ) and qr code fields */
        }
      })
      .filter((c: ColumnType) => !sorts.value.find((s) => s.fk_column_id === c.id)) ?? []
  ).map((c) => {
    const isDisabled = [UITypes.QrCode, UITypes.Barcode, UITypes.ID, UITypes.Button].includes(c.uidt)

    if (isDisabled) {
      c.ncItemDisabled = true
      c.ncItemTooltip = `Sorting is not supported for ${UITypesName[c.uidt]} field`
    }

    return c
  }),
)

const onClick = (column: ColumnType) => {
  emits('created', column)
}
</script>

<template>
  <div class="nc-sort-create-modal">
    <SmartsheetToolbarFieldListWithSearch
      :is-parent-open="isParentOpen"
      :search-input-placeholder="$t('msg.selectFieldToSort')"
      :options="options"
      toolbar-menu="sort"
      @selected="onClick"
    />
  </div>
</template>
