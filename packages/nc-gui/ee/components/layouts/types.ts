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

export enum WidgetTypeText {
  Number = 'Number',
  StaticText = 'Text',
  LineChart = 'Line Chart',
  BarChart = 'Bar Chart',
  PieChart = 'Pie Chart',
  ScatterPlot = 'Scatter Plot',
  Button = 'Button',
  Image = 'Image',
  Divider = 'Divider',
}
