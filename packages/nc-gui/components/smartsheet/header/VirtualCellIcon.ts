import type { PropType } from '@vue/runtime-core'
import type { ColumnType, LinkToAnotherRecordType, LookupType, RollupType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { RelationTypes, UITypes } from 'nocodb-sdk'
import {
  ColumnInj,
  MetaInj,
  defineComponent,
  h,
  iconMap,
  inject,
  isBt,
  isHm,
  isLookup,
  isMm,
  isRollup,
  ref,
  toRef,
} from '#imports'
import CountIcon from '~icons/mdi/counter'

const renderIcon = (column: ColumnType, relationColumn?: ColumnType) => {
  switch (column.uidt) {
    case UITypes.LinkToAnotherRecord:
      switch ((column.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return { icon: iconMap.mm, color: 'text-accent' }
        case RelationTypes.HAS_MANY:
          return { icon: iconMap.hm, color: 'text-yellow-500' }
        case RelationTypes.BELONGS_TO:
          return { icon: iconMap.bt, color: 'text-sky-500' }
      }
      break
    case UITypes.SpecificDBType:
      return { icon: iconMap.specificDbType, color: 'text-grey' }
    case UITypes.Formula:
      return { icon: iconMap.formula, color: 'text-grey' }
    case UITypes.QrCode:
      return { icon: iconMap.qrCode, color: 'text-grey' }
    case UITypes.Barcode:
      return { icon: iconMap.qrCode, color: 'text-grey' }
    case UITypes.Lookup:
      switch ((relationColumn?.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return { icon: iconMap.lookup, color: 'text-accent' }
        case RelationTypes.HAS_MANY:
          return { icon: iconMap.lookup, color: 'text-yellow-500' }
        case RelationTypes.BELONGS_TO:
          return { icon: iconMap.lookup, color: 'text-sky-500' }
      }
      return { icon: iconMap.lookup, color: 'text-grey' }
    case UITypes.Rollup:
      switch ((relationColumn?.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return { icon: iconMap, color: 'text-accent' }
        case RelationTypes.HAS_MANY:
          return { icon: iconMap, color: 'text-yellow-500' }
        case RelationTypes.BELONGS_TO:
          return { icon: iconMap, color: 'text-sky-500' }
      }
      return { icon: iconMap, color: 'text-grey' }
    case UITypes.Count:
      return { icon: CountIcon, color: 'text-grey' }
  }

  return { icon: iconMap.generic, color: 'text-grey' }
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

    const column = inject(ColumnInj, columnMeta) as Ref<ColumnType & { colOptions: LookupType | RollupType }>

    let relationColumn: ColumnType

    return () => {
      if (!column.value) return null

      if (column && column.value) {
        if (isMm(column.value) || isHm(column.value) || isBt(column.value) || isLookup(column.value) || isRollup(column.value)) {
          const meta = inject(MetaInj, ref())
          relationColumn = meta.value?.columns?.find(
            (c) => c.id === column.value?.colOptions?.fk_relation_column_id,
          ) as ColumnType
        }
      }

      const { icon: Icon, color } = renderIcon(column.value, relationColumn)

      return h(Icon, { class: `${color} mx-1`,style: { fontSize: '16px' }  })
    }
  },
})
