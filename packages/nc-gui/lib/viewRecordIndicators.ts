export interface ViewRecordIndicatorSettings {
  showCount: boolean
  boldNonEmpty: boolean
  refreshAmount: number
  refreshUnit: 'hours' | 'days'
}

export const DEFAULT_VIEW_RECORD_INDICATORS: Readonly<ViewRecordIndicatorSettings> = Object.freeze({
  showCount: false,
  boldNonEmpty: false,
  refreshAmount: 1,
  refreshUnit: 'days',
})

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function metadataValue(meta: unknown): Record<string, unknown> {
  if (typeof meta !== 'string') return objectValue(meta)
  try {
    return objectValue(JSON.parse(meta))
  } catch {
    return {}
  }
}

export function isValidViewRecordIndicatorSettings(settings: unknown): boolean {
  const value = objectValue(settings)
  if (
    typeof value.showCount !== 'boolean' ||
    typeof value.boldNonEmpty !== 'boolean' ||
    (value.refreshUnit !== 'hours' && value.refreshUnit !== 'days') ||
    typeof value.refreshAmount !== 'number' ||
    !Number.isSafeInteger(value.refreshAmount) ||
    value.refreshAmount < 1
  ) {
    return false
  }
  return Number.isSafeInteger(value.refreshAmount * (value.refreshUnit === 'hours' ? HOUR_MS : DAY_MS))
}

export function readViewRecordIndicators(meta: unknown): ViewRecordIndicatorSettings {
  const value = objectValue(metadataValue(meta).sidebarIndicators)
  const settings: ViewRecordIndicatorSettings = {
    showCount: value.showCount === true,
    boldNonEmpty: value.boldNonEmpty === true,
    refreshAmount: typeof value.refreshAmount === 'number' ? value.refreshAmount : 1,
    refreshUnit: value.refreshUnit === 'hours' ? 'hours' : 'days',
  }
  if (!isValidViewRecordIndicatorSettings(settings)) settings.refreshAmount = 1
  return settings
}

export function mergeViewRecordIndicators(meta: unknown, settings: ViewRecordIndicatorSettings): Record<string, unknown> {
  const current = metadataValue(meta)
  return {
    ...current,
    sidebarIndicators: {
      ...objectValue(current.sidebarIndicators),
      ...readViewRecordIndicators({ sidebarIndicators: settings }),
    },
  }
}

export function areViewRecordIndicatorsEqual(a: ViewRecordIndicatorSettings, b: ViewRecordIndicatorSettings): boolean {
  return (
    a.showCount === b.showCount &&
    a.boldNonEmpty === b.boldNonEmpty &&
    a.refreshAmount === b.refreshAmount &&
    a.refreshUnit === b.refreshUnit
  )
}
