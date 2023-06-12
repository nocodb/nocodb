import type { WidgetTypeType } from 'nocodb-sdk'

export interface IdAndTitle {
  id: string
  title: string
}
export interface TableWithProject {
  id: string
  title: string
  project: {
    id: string
    title: string
  }
}

export interface WidgetTemplate {
  title: string
  icon: any
  type: WidgetTypeType
}

export enum SelectedLayoutDimension {
  None = 'none',
  Vertical = 'vertical',
  Horizontal = 'horizontal',
  Gap = 'gap',
}
