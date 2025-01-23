import type { PageOrientation, PageType } from './layout'
import type { PageDesignerWidget } from './widgets'

interface PageLayout {
  orientation: PageOrientation
  pageType: PageType
}

export interface PageDesignerPayload {
  selectedTableId?: string
  selectedViewId?: string
  selectedRecordPrimaryKey?: string
  currentWidgetIndex?: number
  layout?: PageLayout
  widgets: PageDesignerWidget[]
}
