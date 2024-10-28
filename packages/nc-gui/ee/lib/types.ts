import type { DocsPageType, LayoutType, WidgetTypeType } from 'nocodb-sdk'

interface AntSidebarNode {
  parentNodeId?: string
  isLeaf: boolean
  key: string
  style?: string | Record<string, string>
  isBook?: boolean
  children?: PageSidebarNode[]
  level?: number
  isSelected?: boolean
}

type PageSidebarNode = DocsPageType & AntSidebarNode
type LayoutSidebarNode = Omit<LayoutType, 'meta'> & AntSidebarNode
type PublishTreeNode = PageSidebarNode & { isSelected: boolean; key: string }

interface IdAndTitle {
  id: string
  title: string
}
interface TableWithProject {
  id: string
  title: string
  base: {
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

enum WorkspaceIconType {
  IMAGE = 'IMAGE',
  ICON = 'ICON',
}

export {
  PageSidebarNode,
  LayoutSidebarNode,
  PublishTreeNode,
  IdAndTitle,
  TableWithProject,
  WidgetTemplate,
  SelectedLayoutDimension,
  WidgetTypeText,
  WorkspaceIconType,
}
