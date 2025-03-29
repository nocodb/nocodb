import { type FilterType } from 'nocodb-sdk'

export enum AppearanceConfigOptionKey {
  'cellBgColor' = 'cellBgColor',
  'cellBgColorHovered' = 'cellBgColor.hovered',
  'cellBgColorSelected' = 'cellBgColor.selected',
  'cellBgClass' = 'cellBgClass',
  'toolbarBgClass' = 'toolbarBgClass',
  'toolbarTextClass' = 'toolbarTextClass',
}

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
      [AppearanceConfigOptionKey.cellBgColor]: '#ECFFF2',
      [AppearanceConfigOptionKey.cellBgColorHovered]: '#D4F7E0',
      [AppearanceConfigOptionKey.cellBgColorSelected]: '#D4F7E0',
      [AppearanceConfigOptionKey.cellBgClass]: '!bg-green-50 column-filtered',
      [AppearanceConfigOptionKey.toolbarBgClass]: 'bg-green-50',
      [AppearanceConfigOptionKey.toolbarTextClass]: 'text-green-700',
    },
    SORTED: {
      [AppearanceConfigOptionKey.cellBgColor]: '#FFF0F7',
      [AppearanceConfigOptionKey.cellBgColorHovered]: '#FFDBEC',
      [AppearanceConfigOptionKey.cellBgColorSelected]: '#FFDBEC',
      [AppearanceConfigOptionKey.cellBgClass]: '!bg-maroon-50 column-sorted',
      [AppearanceConfigOptionKey.toolbarBgClass]: 'bg-maroon-50',
      [AppearanceConfigOptionKey.toolbarTextClass]: 'text-pink-700',
    },
  }

  return {
    appearanceConfig,
    filteredColumnIds,
    sortedColumnIds,
    isColumnSortedOrFiltered,
  }
}
