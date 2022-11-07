import type { GraphNode } from '@vue-flow/core'
import type { ColumnType, TableType } from 'nocodb-sdk'

export interface ERDConfig {
  showPkAndFk: boolean
  showViews: boolean
  showAllColumns: boolean
  singleTableMode: boolean
  showJunctionTableNames: boolean
  showMMTables: boolean
}

export interface NodeData {
  table: TableType
  pkAndFkColumns: ColumnType[]
  nonPkColumns: ColumnType[]
  showPkAndFk: boolean
  showAllColumns: boolean
  color: string
  columnLength: number
  depth: number
}

export interface EdgeData {
  isManyToMany: boolean
  isSelfRelation: boolean
  label?: string
  simpleLabel?: string
  color: string
}

export interface Relation {
  source: string
  target: string
  childColId?: string
  parentColId?: string
  modelId?: string
  type: 'mm' | 'hm'
}

export interface TreeNode {
  id: string
  data: GraphNode<NodeData>
  x: number
  y: number
  depth: number
  path: (node: TreeNode) => TreeNode[]
}
