import type { ViewType } from 'nocodb-sdk'
import type { ViewRecordIndicatorSettings } from './viewRecordIndicators'
import {
  areViewRecordIndicatorsEqual,
  isValidViewRecordIndicatorSettings,
  mergeViewRecordIndicators,
  readViewRecordIndicators,
} from './viewRecordIndicators'

type UpdateView = (viewId: string, updates: Partial<ViewType>) => Promise<ViewType | null>

/** Save preferences against the caller's latest target view, without changing computed counts. */
export async function persistViewRecordIndicators(
  view: ViewType,
  settings: ViewRecordIndicatorSettings,
  updateView: UpdateView,
): Promise<ViewType> {
  if (!isValidViewRecordIndicatorSettings(settings)) throw new Error('Invalid record indicator refresh interval')
  if (areViewRecordIndicatorsEqual(readViewRecordIndicators(view.meta), settings)) return view
  if (!view.id) throw new Error('A saved view is required')

  const updated = await updateView(view.id, { meta: mergeViewRecordIndicators(view.meta, settings) })
  if (updated?.id !== view.id) throw new Error('Record indicators could not be saved')
  return updated
}
