import type { GraphNode } from '@vue-flow/core'

export interface ERDConfig {
  showPkAndFk: boolean
  showViews: boolean
  showAllColumns: boolean
  singleTableMode: boolean
  showJunctionTableNames: boolean
  showMMTables: boolean
}

export interface NodeData {
  tableId: string
  color: string
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
