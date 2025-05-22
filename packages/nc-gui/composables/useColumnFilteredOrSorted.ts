import { UITypes, type FilterType, type TableType } from 'nocodb-sdk'

export function useColumnFilteredOrSorted() {
  const { nestedFilters, allFilters, sorts, filtersFromUrlParams, meta } = useSmartsheetStoreOrThrow()

  const userColumnIds = computed(() =>
    ((meta.value as TableType)?.columns || []).filter((c) => c.uidt === UITypes.User).map((c) => c.id),
  )

  const combinedFilters = computed(() => [
    ...allFilters.value,
    ...nestedFilters.value,
    ...(filtersFromUrlParams.value?.errors?.length ? [] : filtersFromUrlParams.value?.filters || []),
  ])

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

    extractFilterArray([
      ...allFilters.value,
      ...nestedFilters.value,
      ...(!filtersFromUrlParams.value?.errors?.length ? filtersFromUrlParams.value?.filters || [] : []),
    ])

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
      'toolbarBgClass': '!bg-nc-bg-green-light !hover:bg-nc-bg-green-dark',
      'toolbarChipBgClass': 'bg-nc-bg-green-dark group-hover:bg-green-200',
      'toolbarTextClass': 'text-green-700',
      'headerBgColor': '#27D6650A',
      'headerBgClass': "relative !bg-[#ffffff88] after:(content-[''] absolute block inset-0 !bg-[#27D6650A])",
    },
    SORTED: {
      'cellBgColor': themeV3Colors.orange['50'],
      'cellBgColor.hovered': themeV3Colors.orange['100'],
      'cellBgColor.selected': themeV3Colors.orange['100'],
      'cellBorderColor': themeV3Colors.gray['200'],
      'cellBorderColor.hovered': themeV3Colors.gray['200'],
      'cellBorderColor.selected': themeV3Colors.gray['200'],
      'cellBgClass': '!bg-orange-50 column-sorted !border-b-gray-200',
      'toolbarBgClass': '!bg-nc-bg-orange-light !hover:bg-nc-bg-orange-dark',
      'toolbarChipBgClass': 'bg-nc-bg-orange-dark group-hover:bg-orange-200',
      'toolbarTextClass': 'text-orange-700',
      'headerBgColor': '#FA82310A',
      'headerBgClass': "relative !bg-[#ffffff88] after:(content-[''] absolute block inset-0 !bg-[#FA82310A])",
    },
  }

  return {
    appearanceConfig,
    filteredColumnIds,
    sortedColumnIds,
    isColumnSortedOrFiltered,
    userColumnIds,
    combinedFilters,
  }
}
