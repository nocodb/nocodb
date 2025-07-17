import { type ColumnType, type SerializerOrParserFnProps, formatAggregation, formatBytes } from 'nocodb-sdk'
import { aggregationCache } from '../components/smartsheet/grid/canvas/utils/canvas'

export { formatAggregation, formatBytes }

export const getFormattedAggrationValue = (
  aggregation: string,
  value: any,
  col: ColumnType,
  cacheKeyPath: string[] = [],
  columnHelperParams?: SerializerOrParserFnProps['params'],
) => {
  const cacheKey = `${col.id}-${col.uidt}-${aggregation}-${value?.toString()}-${cacheKeyPath.join('-')}`

  const cacheValue = aggregationCache.get(cacheKey)
  if (!ncIsUndefined(cacheValue)) {
    return isValidValue(cacheValue) ? cacheValue : undefined
  }

  const aggregationValue = formatAggregation(aggregation, value, col, columnHelperParams)

  aggregationCache.set(cacheKey, aggregationValue)

  return isValidValue(aggregationValue) ? aggregationValue : undefined
}
