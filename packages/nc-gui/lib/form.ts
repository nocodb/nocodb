import type { ColumnType } from 'ant-design-vue/lib/table'
import type { FilterType } from 'nocodb-sdk'

type LocalFilterType = FilterType & { order?: number }

export class Filter {
  filters: LocalFilterType[]
  protected groupedFilters: Record<string, LocalFilterType[]>
  nestedGroupedFilters: Record<string, LocalFilterType[]>

  constructor(data: LocalFilterType[] = []) {
    this.filters = data
    this.groupedFilters = {}
    this.nestedGroupedFilters = {}
  }

  get length(): number {
    return this.filters.length
  }

  setFilters(filters: (LocalFilterType & { order?: number })[]) {
    this.filters = filters
  }

  getRootFilters(parentColId: string) {
    return (this.groupedFilters[parentColId] || [])
      .filter((f) => !f.fk_column_id)
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  }

  getParentFilters(parentColId: string, parentId: string) {
    return (this.groupedFilters[parentColId] || [])
      .filter((f) => f.fk_parent_id === parentId)
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  }

  getAllChildFilters(filters: LocalFilterType[], parentColId: string): any {
    return filters.map((filter) => {
      if (filter.id && filter.is_group) {
        const childFilters = this.getParentFilters(parentColId, filter.id)
        filter.children = this.getAllChildFilters(childFilters, parentColId)
      }

      return filter
    })
  }

  loadFilters() {
    for (const parentColId in this.groupedFilters) {
      const rootFilters = this.getRootFilters(parentColId)

      this.nestedGroupedFilters[parentColId] = this.getAllChildFilters(rootFilters, parentColId)
    }
    return this.nestedGroupedFilters
  }

  // Method to group filters by fk_parent_column_id
  getNestedGroupedFilters() {
    const groupedFiltes = this.filters.reduce((acc, filter) => {
      console.log('filter.fk_parent_column_id', filter.fk_parent_column_id, filter)
      const groupingKey = filter.fk_parent_column_id || 'ungrouped'

      if (!acc[groupingKey]) {
        acc[groupingKey] = []
      }

      acc[groupingKey].push(filter)

      return acc
    }, {} as typeof this.groupedFilters)

    this.groupedFilters = groupedFiltes

    const nestedGroupedFilters = this.loadFilters()

    return nestedGroupedFilters
  }
}
