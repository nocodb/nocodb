import { type FilterType } from 'nocodb-sdk'

export function useColumnFilteredOrSorted() {
  const { nestedFilters, allFilters, sorts } = useSmartsheetStoreOrThrow()
  const filteredColumnIds = computed(() => {
    const columnIds: Set<string> = new Set<string>()
    const extractFilterArray = (filters: FilterType[]) => {
      if (filters && filters.length > 0) {
        for (const eachFilter of filters) {
          if (eachFilter.is_group) {
            if ((eachFilter.children?.length ?? 0) > 0) {
              extractFilterArray(eachFilter.children!)
            }
          } else if (eachFilter.fk_column_id) {
            columnIds.add(eachFilter.fk_column_id)
          }
        }
      }
    }
    extractFilterArray([...allFilters.value, ...nestedFilters.value])
    return columnIds
  })
  const sortedColumnIds = computed(() => {
    const columnIds: Set<string> = new Set<string>()
    if (!sorts?.value || sorts.value.length === 0) {
      return columnIds
    }
    for (const sort of sorts.value) {
      if (sort.fk_column_id) {
        columnIds.add(sort.fk_column_id)
      }
    }
    return columnIds
  })

  const isColumnSortedOrFiltered = (colId: string) => {
    if (filteredColumnIds.value.has(colId)) {
      return 'FILTERED'
    } else if (sortedColumnIds.value.has(colId)) {
      return 'SORTED'
    } else {
      return undefined
    }
  }

  const appearanceConfig = {
    FILTERED: {
      'cellBgColor': themeV3Colors.green['50'],
      'cellBgColor.hovered': themeV3Colors.green['100'],
      'cellBgColor.selected': themeV3Colors.green['100'],
      'cellBorderColor': themeV3Colors.gray['200'],
      'cellBorderColor.hovered': themeV3Colors.gray['200'],
      'cellBorderColor.selected': themeV3Colors.gray['200'],
      'cellBgClass': '!bg-green-50 column-filtered',
      'toolbarBgClass': 'bg-green-50',
      'toolbarTextClass': 'text-green-700',
    },
    SORTED: {
      'cellBgColor': themeV3Colors.orange['50'],
      'cellBgColor.hovered': themeV3Colors.orange['100'],
      'cellBgColor.selected': themeV3Colors.orange['100'],
      'cellBorderColor': themeV3Colors.gray['200'],
      'cellBorderColor.hovered': themeV3Colors.gray['200'],
      'cellBorderColor.selected': themeV3Colors.gray['200'],
      'cellBgClass': '!bg-orange-50 column-sorted !border-b-gray-200',
      'toolbarBgClass': 'bg-orange-50',
      'toolbarTextClass': 'text-orange-700',
    },
  }

  return {
    appearanceConfig,
    filteredColumnIds,
    sortedColumnIds,
    isColumnSortedOrFiltered,
  }
}
