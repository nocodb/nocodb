import type { WidgetTypeType } from 'nocodb-sdk'

interface IdAndTitle {
  id: string
  title: string
}
interface TableWithProject {
  id: string
  title: string
  project: {
    id: string
    title: string
  }
}

interface WidgetTemplate {
  title: string
  icon: any
  type: WidgetTypeType
}

enum SelectedLayoutDimension {
  None = 'none',
  Vertical = 'vertical',
  Horizontal = 'horizontal',
  Gap = 'gap',
}

enum WidgetTypeText {
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

export { IdAndTitle, TableWithProject, WidgetTemplate, SelectedLayoutDimension, WidgetTypeText }
