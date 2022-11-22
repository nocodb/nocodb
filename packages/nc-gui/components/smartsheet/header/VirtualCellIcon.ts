import type { PropType } from '@vue/runtime-core'
import type { ColumnType, LinkToAnotherRecordType, LookupType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { RelationTypes, UITypes } from 'nocodb-sdk'
import { ColumnInj, MetaInj, defineComponent, h, inject, isBt, isHm, isLookup, isMm, isRollup, ref, toRef } from '#imports'
import GenericIcon from '~icons/mdi/square-rounded'
import HMIcon from '~icons/mdi/table-arrow-right'
import BTIcon from '~icons/mdi/table-arrow-left'
import MMIcon from '~icons/mdi/table-network'
import FormulaIcon from '~icons/mdi/math-integral'
import RollupIcon from '~icons/mdi/movie-roll'
import CountIcon from '~icons/mdi/counter'
import SpecificDBTypeIcon from '~icons/mdi/database-settings'
import TableColumnPlusBefore from '~icons/mdi/table-column-plus-before'

const renderIcon = (column: ColumnType, relationColumn?: ColumnType) => {
  switch (column.uidt) {
    case UITypes.LinkToAnotherRecord:
      switch ((column.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return { icon: MMIcon, color: 'text-accent' }
        case RelationTypes.HAS_MANY:
          return { icon: HMIcon, color: 'text-yellow-500' }
        case RelationTypes.BELONGS_TO:
          return { icon: BTIcon, color: 'text-sky-500' }
      }
      break
    case UITypes.SpecificDBType:
      return { icon: SpecificDBTypeIcon, color: 'text-grey' }
    case UITypes.Formula:
      return { icon: FormulaIcon, color: 'text-grey' }
    case UITypes.Lookup:
      switch ((relationColumn?.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return { icon: TableColumnPlusBefore, color: 'text-accent' }
        case RelationTypes.HAS_MANY:
          return { icon: TableColumnPlusBefore, color: 'text-yellow-500' }
        case RelationTypes.BELONGS_TO:
          return { icon: TableColumnPlusBefore, color: 'text-sky-500' }
      }
      return { icon: TableColumnPlusBefore, color: 'text-grey' }
    case UITypes.Rollup:
      switch ((relationColumn?.colOptions as LinkToAnotherRecordType)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return { icon: RollupIcon, color: 'text-accent' }
        case RelationTypes.HAS_MANY:
          return { icon: RollupIcon, color: 'text-yellow-500' }
        case RelationTypes.BELONGS_TO:
          return { icon: RollupIcon, color: 'text-sky-500' }
      }
      return { icon: RollupIcon, color: 'text-grey' }
    case UITypes.Count:
      return { icon: CountIcon, color: 'text-grey' }
  }

  return { icon: GenericIcon, color: 'text-grey' }
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

    const column = inject(ColumnInj, columnMeta) as Ref<ColumnType & { colOptions: LookupType }>

    let relationColumn: ColumnType & { colOptions: LookupType }

    return () => {
      if (!column.value) return null

      if (column && column.value) {
        if (isMm(column.value) || isHm(column.value) || isBt(column.value) || isLookup(column.value) || isRollup(column.value)) {
          const meta = inject(MetaInj, ref())

          relationColumn = meta.value?.columns?.find(
            (c) => c.id === column.value?.colOptions?.fk_relation_column_id,
          ) as ColumnType & {
            colOptions: LinkToAnotherRecordType
          }
        }
      }

      const { icon: Icon, color } = renderIcon(column.value, relationColumn)

      return h(Icon, { class: `${color} mx-1 !text-xs` })
    }
  },
})
