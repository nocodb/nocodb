import type { PageOrientation, PageType } from './layout'

interface PageLayout {
  orientation: PageOrientation
  pageType: PageType
}

export interface PageDesignerPayload {
  selectedTableId?: string
  selectedViewId?: string
  selectedRecordPrimaryKey?: string
  layout?: PageLayout
}
