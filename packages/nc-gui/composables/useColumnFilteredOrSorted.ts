import { type FilterType, type TableType, UITypes } from 'nocodb-sdk'

export function useColumnFilteredOrSorted() {
  const { nestedFilters, allFilters, sorts, validFiltersFromUrlParams, meta } = useSmartsheetStoreOrThrow()

  /**
   * If true, the cell will be coloured based on the filtered or sorted state.
   */
  const isCellColouringEnabled = false

  const userColumnIds = computed(() =>
    ((meta.value as TableType)?.columns || []).filter((c) => c.uidt === UITypes.User).map((c) => c.id),
  )

  const filteredColumnIds = computed(() => {
    const columnIds: Set<string> = new Set<string>()
    const extractFilterArray = (filters: FilterType[]) => {
      if (filters && filters.length > 0) {
        for (const eachFilter of filters) {
          if (!eachFilter) continue

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

    extractFilterArray([...allFilters.value, ...nestedFilters.value, ...validFiltersFromUrlParams.value])

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

  const isColumnSortedOrFiltered = (colId: string, isColumnHeader: boolean = false) => {
    if (!isColumnHeader && !isCellColouringEnabled) {
      return undefined
    }

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
      'cellBgClass': '!bg-nc-green-50 column-filtered',
      'toolbarBgClass': '!bg-nc-bg-green-light !hover:bg-nc-bg-green-dark',
      'toolbarChipBgClass': 'bg-nc-bg-green-dark group-hover:bg-nc-green-200',
      'toolbarTextClass': 'text-nc-green-700',
      'headerBgColor': '#27D6650A',
      'headerBgClass': "relative !bg-[#ffffff88] after:(content-[''] absolute block inset-0 !bg-[#27D6650A] pointer-events-none)",
      'canvas': {
        'cellBgColor': themeV4Colors.green['50'],
        'cellBgColor.hovered': themeV4Colors.green['100'],
        'cellBgColor.selected': themeV4Colors.green['100'],
        'cellBorderColor': themeV4Colors.gray['200'],
        'cellBorderColor.hovered': themeV4Colors.gray['200'],
        'cellBorderColor.selected': themeV4Colors.gray['200'],
        'headerBgColor': '#27D6650A',
      },
    },
    SORTED: {
      'cellBgColor': themeV3Colors.orange['50'],
      'cellBgColor.hovered': themeV3Colors.orange['100'],
      'cellBgColor.selected': themeV3Colors.orange['100'],
      'cellBorderColor': themeV3Colors.gray['200'],
      'cellBorderColor.hovered': themeV3Colors.gray['200'],
      'cellBorderColor.selected': themeV3Colors.gray['200'],
      'cellBgClass': '!bg-nc-orange-50 column-sorted !border-b-nc-gray-200',
      'toolbarBgClass': '!bg-nc-bg-orange-light !hover:bg-nc-bg-orange-dark',
      'toolbarChipBgClass': 'bg-nc-bg-orange-dark group-hover:bg-nc-orange-200',
      'toolbarTextClass': 'text-nc-orange-700',
      'headerBgColor': '#FA82310A',
      'headerBgClass': "relative !bg-[#ffffff88] after:(content-[''] absolute block inset-0 !bg-[#FA82310A] pointer-events-none)",
      'canvas': {
        'cellBgColor': themeV4Colors.orange['50'],
        'cellBgColor.hovered': themeV4Colors.orange['100'],
        'cellBgColor.selected': themeV4Colors.orange['100'],
        'cellBorderColor': themeV4Colors.gray['200'],
        'cellBorderColor.hovered': themeV4Colors.gray['200'],
        'cellBorderColor.selected': themeV4Colors.gray['200'],
        'headerBgColor': '#FA82310A',
      },
    },
  }

  return {
    appearanceConfig,
    filteredColumnIds,
    sortedColumnIds,
    isColumnSortedOrFiltered,
    userColumnIds,
    isCellColouringEnabled,
  }
}
