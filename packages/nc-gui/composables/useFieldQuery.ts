import {
  ClientType,
  ColumnHelper,
  type ColumnType,
  FormulaDataTypes,
  SqlUiFactory,
  type TableType,
  UITypes,
  getAbbreviationSearchHalfWidth,
  getRollupResultUidt,
  isNumericCol,
  isVirtualCol,
  ncIsNaN,
} from 'nocodb-sdk'
import { linkDisplaySearchClause } from '~/utils/linkedRecordDisplay'

export interface FieldQueryType {
  field: string
  query: string
  isValidFieldQuery?: boolean
  // The user picked "All fields" themselves, so a plan_limit doesn't switch it to the display field.
  allFieldsPicked?: boolean
  // The box switched from "All fields" to the display field on plan_limit.
  planLimitFallback?: boolean
}

export interface FieldQueryScope {
  search: Ref<FieldQueryType>
  searchMap: Ref<Record<string, FieldQueryType>>
}

/**
 * Tree-scoped override for `useFieldQuery` — provided by hosts that mount a
 * SECOND live search surface beside the page's own (the LTAR embedded viz),
 * so their SearchData + smartsheet store read an isolated state instead of
 * the app-global "current view" search (typing in one box would otherwise
 * show up — and filter — in the other).
 */
export const FieldQueryScopeInj: InjectionKey<FieldQueryScope> = Symbol('field-query-scope')

/** Fresh isolated state for `FieldQueryScopeInj` providers. */
export function createFieldQueryScope(): FieldQueryScope {
  return {
    search: ref({ field: '', query: '', isValidFieldQuery: true }),
    searchMap: ref({}),
  }
}

export interface ValidSearchQueryForColumnReturnType {
  fk_column_id: string
  comparison_op: 'like' | 'eq' | 'ge' | 'lt'
  value: string | number
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

  // Tree-scoped override (see FieldQueryScopeInj) — null keeps the app-global
  // state below. Guarded: callers are all setup-context composables, but a
  // future non-setup call must not warn.
  const scope = getCurrentInstance() ? inject(FieldQueryScopeInj, null) : null

  // mapping view id (key) to corresponding emptyFieldQueryObj (value)
  const searchMap = scope?.searchMap ?? useState<Record<string, FieldQueryType>>('field-query-search-map', () => ({}))

  // the fieldQueryObj under the current view
  const search =
    scope?.search ??
    useState<FieldQueryType>('field-query-search', () => ({
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
    params: { getWhereQueryAs?: 'string' | 'object'; serializeLinkRecordSearchQuery?: boolean } = {},
  ): string | ValidSearchQueryForColumnReturnType[] => {
    if (!isValidValue(query)) return ''

    // A single-record link (e.g. as a display value) is searched by its leaf text
    if (params.getWhereQueryAs) {
      const linkClause = linkDisplaySearchClause(col, query as string, params.getWhereQueryAs, {
        meta: tableMeta,
        metas: metas.value,
      })
      if (linkClause !== undefined) return typeof linkClause === 'object' ? [linkClause] : linkClause
    }

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
        serializeLinkRecordSearchQuery: params.serializeLinkRecordSearchQuery,
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

    // The base store normally resolves a SqlUi per source; on public/interface-only
    // surfaces it seeds one from the shared-interface meta's real client (see
    // `sqlUis` in ee/store/base.ts). The MySQL default is a last resort for the
    // narrow window before that meta loads — without any SqlUi the abstract-type
    // check below fails and every text column falls through to `eq` instead of `like`.
    const sqlUi =
      (tableMeta?.source_id && sqlUis.value[tableMeta.source_id]) ||
      Object.values(sqlUis.value)[0] ||
      SqlUiFactory.create({ client: ClientType.MYSQL })

    // a formula rollup searches by its result type: text with like, the rest with eq
    const rollupResultUidt = getRollupResultUidt(col)

    if (
      rollupResultUidt
        ? rollupResultUidt === UITypes.SingleLineText
        : (col.uidt !== UITypes.Formula || getFormulaColDataType(col) !== FormulaDataTypes.NUMERIC) &&
          !isNumericCol(col) &&
          sqlUi &&
          ['text', 'string', 'json'].includes(sqlUi.getAbstractType(col)) &&
          col.dt !== 'bigint'
    ) {
      if (params.getWhereQueryAs === 'object') {
        return [
          {
            fk_column_id: col.id!,
            comparison_op: 'like',
            value: searchQuery ?? '',
          },
        ]
      }

      return `(${col.title},like,%${searchQuery}%)`
    }

    const isNumericSearchTarget =
      isNumericCol(col) ||
      col.dt === 'bigint' ||
      (col.uidt === UITypes.Formula && getFormulaColDataType(col) === FormulaDataTypes.NUMERIC)

    if (isNumericSearchTarget && ncIsNaN(searchQuery)) return ''

    // An abbreviating column renders a rounded value, so `1.2M` on screen is anything in
    // [1150000, 1250000). Match that bucket rather than the single value the suffix expands
    // to, or a row stays invisible to the very string it displays.
    const expanded = Number(searchQuery)
    const abbreviationHalfWidth = isNumericSearchTarget ? getAbbreviationSearchHalfWidth(query!, col, expanded) : null

    if (abbreviationHalfWidth) {
      // toPrecision drops float drift: 1234.5 - 0.05 is 1234.4499999999998
      const lower = Number((expanded - abbreviationHalfWidth).toPrecision(15))
      const upper = Number((expanded + abbreviationHalfWidth).toPrecision(15))

      if (params.getWhereQueryAs === 'object') {
        return [
          { fk_column_id: col.id!, comparison_op: 'ge', value: lower },
          { fk_column_id: col.id!, comparison_op: 'lt', value: upper },
        ]
      }

      // grouped, so the pair stays intact where callers join clauses with `~or`
      return `((${col.title},ge,${lower})~and(${col.title},lt,${upper}))`
    }

    if (params.getWhereQueryAs === 'object') {
      return [
        {
          fk_column_id: col.id!,
          comparison_op: 'eq',
          value: searchQuery ?? '',
        },
      ]
    }

    return `(${col.title},eq,${searchQuery})`
  }

  return {
    search,
    loadFieldQuery,
    getValidSearchQueryForColumn,
    /** True inside a `FieldQueryScopeInj` subtree — its search state is its own. */
    isScoped: !!scope,
  }
}
