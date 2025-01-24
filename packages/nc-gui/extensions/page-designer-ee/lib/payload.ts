import type { PageOrientation, PageType } from './layout'
import type { PageDesignerWidget } from './widgets'

export interface PageDesignerPayload {
  orientation: PageOrientation
  pageType: PageType
  pageName?: string
  selectedTableId?: string
  selectedViewId?: string
  currentWidgetIndex?: number
  widgets: PageDesignerWidget[]
}
