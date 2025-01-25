import type { PageOrientation, PageType } from './layout'
import type { PageDesignerWidget } from './widgets'

export interface PageDesignerPayload {
  orientation: PageOrientation
  pageType: PageType
  pageName?: string
  selectedTableId?: string
  selectedViewId?: string
  currentWidgetId: string | number
  lastWidgetId: number
  widgets: Record<string | number, PageDesignerWidget>
}
