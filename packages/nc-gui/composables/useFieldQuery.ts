import { ColumnHelper, type ColumnType, FormulaDataTypes, type TableType, UITypes, isNumericCol, isVirtualCol } from 'nocodb-sdk'

export interface FieldQueryType {
  field: string
  query: string
  isValidFieldQuery?: boolean
}

export interface ValidSearchQueryForColumnReturnType {
  fk_column_id: string
  comparison_op: 'like' | 'eq'
  value: string
}

export function useFieldQuery() {
  const baseStore = useBase()

  const { isMysql, isPg } = baseStore

  const { sqlUis } = storeToRefs(baseStore)

  const { metas } = useMetas()

  // initial search object
  const emptyFieldQueryObj = {
    field: '',
    query: '',
    isValidFieldQuery: true,
  }

  // mapping view id (key) to corresponding emptyFieldQueryObj (value)
  const searchMap = useState<Record<string, FieldQueryType>>('field-query-search-map', () => ({}))

  // the fieldQueryObj under the current view
  const search = useState<FieldQueryType>('field-query-search', () => ({
    ...emptyFieldQueryObj,
  }))

  // retrieve the fieldQueryObj of the given view id
  // if it is not found in `searchMap`, init with emptyFieldQueryObj
  const loadFieldQuery = (id?: string, reset = false) => {
    if (!id) return

    if (reset || !(id in searchMap.value)) {
      searchMap.value[id] = { ...emptyFieldQueryObj }
    }

    search.value = searchMap.value[id]!
  }

  /**
   * @param col
   * @param query - search query
   * @param tableMeta
   * @param getWhereQuery - Whether to get the where query for the column
   * @returns The valid search query for the column or the where query for the column
   */
  const getValidSearchQueryForColumn = (
    col: ColumnType,
    query?: string,
    tableMeta?: TableType,
    params: { getWhereQueryAs?: 'string' | 'object' } = {},
  ): string | ValidSearchQueryForColumnReturnType => {
    if (!isValidValue(query)) return ''

    let searchQuery = query

    try {
      /**
       * This method can throw errors. so it's important to use a try-catch block when calling it.
       */
      searchQuery = ColumnHelper.serializeValue(searchQuery, {
        col,
        isMysql,
        isPg,
        meta: tableMeta,
        metas: metas.value,
        serializeSearchQuery: true,
      })
    } catch (_err: any) {
      /**
       * If it is a virtual column, then send query as it is
       */
      if (!isVirtualCol(col)) {
        searchQuery = ''
        /**
         * We don't have to anything if serializeValue is not valid for current column
         */
        console.log('invalid search query for column', col.title, searchQuery)
      } else if (col.uidt !== UITypes.Formula) {
        searchQuery = query
      }
    }

    if (isVirtualCol(col) && col.uidt !== UITypes.Formula && !isValidValue(searchQuery)) {
      searchQuery = query
    }

    if (!isValidValue(searchQuery)) return ''

    if (!params.getWhereQueryAs) return searchQuery ?? ''

    const sqlUi = tableMeta?.source_id ? sqlUis.value[tableMeta.source_id] : Object.values(sqlUis.value)[0]

    if (
      (col.uidt !== UITypes.Formula || getFormulaColDataType(col) !== FormulaDataTypes.NUMERIC) &&
      !isNumericCol(col) &&
      sqlUi &&
      ['text', 'string'].includes(sqlUi.getAbstractType(col)) &&
      col.dt !== 'bigint'
    ) {
      if (params.getWhereQueryAs === 'object') {
        return {
          fk_column_id: col.id!,
          comparison_op: 'like',
          value: searchQuery ?? '',
        }
      }

      return `(${col.title},like,%${searchQuery}%)`
    }

    if (params.getWhereQueryAs === 'object') {
      return {
        fk_column_id: col.id!,
        comparison_op: 'eq',
        value: searchQuery ?? '',
      }
    }

    return `(${col.title},eq,${searchQuery})`
  }

  return { search, loadFieldQuery, getValidSearchQueryForColumn }
}
