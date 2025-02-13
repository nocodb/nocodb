import type { PropType } from '@vue/runtime-core'
import type { ColumnType, LinkToAnotherRecordType, LookupType, RollupType } from 'nocodb-sdk'
import { ButtonActionsType, RelationTypes, UITypes } from 'nocodb-sdk'
import type { Ref } from 'vue'

import CountIcon from '~icons/mdi/counter'

export const renderIcon = (column: ColumnType, relationColumn?: ColumnType) => {
  switch (column.uidt) {
    case UITypes.LinkToAnotherRecord:
    case UITypes.Links:
      switch ((column.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return { icon: iconMap.mm_solid }
        case RelationTypes.HAS_MANY:
          return { icon: iconMap.hm_solid }
        case RelationTypes.BELONGS_TO:
          return { icon: iconMap.bt_solid }
        case RelationTypes.ONE_TO_ONE:
          return { icon: iconMap.oneToOneSolid, color: 'text-purple-500' }
      }
      break
    case UITypes.SpecificDBType:
      return { icon: iconMap.cellDb, color: 'text-grey' }
    case UITypes.Formula:
      return { icon: iconMap.cellFormula, color: 'text-grey' }
    case UITypes.Button:
      switch ((column.colOptions as LinkToAnotherRecordType)?.type) {
        case ButtonActionsType.Ai:
          return { icon: iconMap.cellAiButton, color: 'text-grey' }
        default:
          return { icon: iconMap.cellButton, color: 'text-grey' }
      }
    case UITypes.QrCode:
      return { icon: iconMap.cellQrCode, color: 'text-grey' }
    case UITypes.Barcode:
      return { icon: iconMap.cellBarcode, color: 'text-grey' }
    case UITypes.Lookup:
      switch ((relationColumn?.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return { icon: iconMap.cellLookup, color: 'text-pink-500', hex: '#FC3AC6' }
        case RelationTypes.HAS_MANY:
          return { icon: iconMap.cellLookup, color: 'text-orange-500', hex: '#FA8231' }
        case RelationTypes.BELONGS_TO:
          return { icon: iconMap.cellLookup, color: 'text-blue-500', hex: '#36BFFF' }
        case RelationTypes.ONE_TO_ONE:
          return { icon: iconMap.cellLookup, color: 'text-purple-500', hex: '#7D26CD' }
      }
      return { icon: iconMap.cellLookup, color: 'text-grey' }
    case UITypes.Rollup:
      switch ((relationColumn?.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return { icon: iconMap.cellRollup, color: 'text-pink-500', hex: '#FC3AC6' }
        case RelationTypes.HAS_MANY:
          return { icon: iconMap.cellRollup, color: 'text-orange-500', hex: '#FA8231' }
        case RelationTypes.BELONGS_TO:
          return { icon: iconMap.cellRollup, color: 'text-blue-500', hex: '#36BFFF' }
        case RelationTypes.ONE_TO_ONE:
          return { icon: iconMap.cellRollup, color: 'text-purple-500', hex: '#7D26CD' }
      }
      return { icon: iconMap.cellRollup, color: 'text-grey' }
    case UITypes.Count:
      return { icon: CountIcon, color: 'text-grey' }
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      return { icon: iconMap.cellSystemDate, color: 'text-grey' }
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy:
      return { icon: iconMap.cellSystemUser, color: 'text-grey' }
  }

  return { icon: iconMap.cellSystemText, color: 'text-grey' }
}

export default defineComponent({
  name: 'VirtualCellIcon',
  props: {
    columnMeta: {
      type: Object as PropType<ColumnType>,
      required: false,
    },
  },
  setup(props) {
    const columnMeta = toRef(props, 'columnMeta')

    const injectedColumn = inject(ColumnInj, columnMeta) as Ref<ColumnType & { colOptions: LookupType | RollupType }>

    const column = computed(() => columnMeta.value ?? injectedColumn.value)

    const { metas } = useMetas()

    let relationColumn: ColumnType

    return () => {
      if (!column.value) return null

      if (column && column.value) {
        if (isLookup(column.value) || isRollup(column.value)) {
          relationColumn = metas.value?.[column.value.fk_model_id]?.columns?.find(
            (c) => c.id === column.value?.colOptions?.fk_relation_column_id,
          ) as ColumnType
        }
      }

      const { icon: Icon, color } = renderIcon(column.value, relationColumn)

      return h(Icon, { class: `${color || 'text-grey'} mx-1 nc-virtual-cell-icon` })
    }
  },
})
