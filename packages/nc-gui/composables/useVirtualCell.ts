import type { ColumnType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { computed, isBt, isCount, isFormula, isHm, isLookup, isMm, isRollup } from '#imports'
import HasMany from '~/components/virtual-cell/HasMany.vue'
import ManyToMany from '~/components/virtual-cell/ManyToMany.vue'
import BelongsTo from '~/components/virtual-cell/BelongsTo.vue'
import Lookup from '~/components/virtual-cell/Lookup.vue'
import Rollup from '~/components/virtual-cell/Rollup.vue'
import Formula from '~/components/virtual-cell/Formula.vue'
import Count from '~/components/virtual-cell/Count.vue'

export function useVirtualCell(column: Ref<ColumnType | undefined>) {
  return computed(() => {
    if (!column.value) return null

    if (isHm(column.value)) return HasMany
    if (isMm(column.value)) return ManyToMany
    if (isBt(column.value)) return BelongsTo
    if (isLookup(column.value)) return Lookup
    if (isRollup(column.value)) return Rollup
    if (isFormula(column.value)) return Formula
    if (isCount(column.value)) return Count
  })
}
