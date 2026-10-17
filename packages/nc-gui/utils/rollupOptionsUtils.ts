import { ROLLUP_FORMULA_FUNCTION, UITypes } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'

// a formula rollup starts at two decimals
const FORMULA_ROLLUP_PRECISION = 2

/**
 * A new rollup's target: the first unused aggregatable field. Links and
 * lookups only take a formula, so picking one would open the rollup as one.
 */
export const pickDefaultRollupTargetId = (
  columns: ColumnType[],
  usedTargetIds: (string | undefined)[],
  isAggregatable: (c: ColumnType) => boolean,
) => {
  const unused = (c: ColumnType) => !usedTargetIds.includes(c.id)
  const aggregatable = columns.filter(isAggregatable)
  return (aggregatable.find(unused) ?? aggregatable[0] ?? columns.find(unused) ?? columns[0])?.id
}

/**
 * The display format after the formula's result changed: put aside when it no
 * longer fits, the user's pick back when it fits again. `undefined` = no change.
 */
export const nextRollupDisplayType = ({
  isFormulaMode,
  formats,
  current,
  picked,
}: {
  isFormulaMode: boolean
  formats: string[]
  current?: string | null
  picked?: string | null
}): string | null | undefined => {
  if (!isFormulaMode) return current ? null : undefined
  // no formats yet: the formula isn't checked (or doesn't parse) yet
  if (!formats.length) return undefined
  const fits = !!picked && formats.includes(picked)
  if (fits) return current === picked ? undefined : picked
  return current ? null : undefined
}

// a formula / plain toggle moves an untouched precision to the mode's default
export const nextRollupModePrecision = (current: number | null | undefined, formulaMode: boolean, plainDefault: number) => {
  const previousDefault = formulaMode ? plainDefault : FORMULA_ROLLUP_PRECISION
  if (current == null || current === previousDefault) {
    return formulaMode ? FORMULA_ROLLUP_PRECISION : plainDefault
  }
  return current
}

// lets only the latest of overlapping async validations apply its result
export const createLatestCallTracker = () => {
  let latest = 0
  return {
    start: () => ++latest,
    isLatest: (token: number) => token === latest,
  }
}

// the form field a failed column save reports on
export const getColumnUpdateErrorField = (formState: { uidt?: string; rollup_function?: string | null }) =>
  formState.uidt === UITypes.Rollup && formState.rollup_function === ROLLUP_FORMULA_FUNCTION ? 'rollup_formula' : 'formula_raw'
