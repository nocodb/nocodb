import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { Edge, EdgeMarker, Elements, GraphEdge, GraphNode, Node } from '@vue-flow/core'
import type { MaybeRef } from '@vueuse/core'
import { MarkerType, Position, useVueFlow } from '@vue-flow/core'
import { stratify } from 'd3-hierarchy'
// @ts-expect-error No types for flextree
import { flextree } from 'd3-flextree'
import { scaleLinear } from 'd3-scale'
import type { Ref } from 'vue'
import tinycolor from 'tinycolor2'
import { computed, ref, unref, useMetas, useTheme, watch } from '#imports'

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
}

export interface EdgeData {
  isManyToMany: boolean
  isSelfRelation: boolean
  label?: string
  simpleLabel?: string
  color: string
}

interface Relation {
  source: string
  target: string
  childColId?: string
  parentColId?: string
  modelId?: string
  type: 'mm' | 'hm'
}

interface TreeNode {
  data: GraphNode<NodeData>
  x: number
  y: number
  depth: number
  path: (node: TreeNode) => TreeNode[]
}

/**
 * This util is used to generate the ERD graph elements and layout them
 *
 * @param tables
 * @param props
 */
export function useErdElements(tables: MaybeRef<TableType[]>, props: MaybeRef<ERDConfig>) {
  const elements = ref<Elements<NodeData | EdgeData>>([])

  const { metasWithIdAsKey } = useMetas()

  const erdTables = computed(() => unref(tables))
  const config = $computed(() => unref(props))

  const relations = computed(() =>
    erdTables.value.reduce((acc, table) => {
      const meta = metasWithIdAsKey.value[table.id!]
      const columns =
        meta.columns?.filter((column: ColumnType) => column.uidt === UITypes.LinkToAnotherRecord && column.system !== 1) || []

      columns.forEach((column: ColumnType) => {
        const colOptions = column.colOptions as LinkToAnotherRecordType
        const source = column.fk_model_id
        const target = colOptions.fk_related_model_id

        const sourceExists = erdTables.value.find((t) => t.id === source)
        const targetExists = erdTables.value.find((t) => t.id === target)

        if (source && target && sourceExists && targetExists) {
          const relation: Relation = {
            source,
            target,
            childColId: colOptions.fk_child_column_id,
            parentColId: colOptions.fk_parent_column_id,
            modelId: colOptions.fk_mm_model_id,
            type: 'hm',
          }

          if (colOptions.type === 'hm') {
            relation.type = 'hm'

            return acc.push(relation)
          }

          if (colOptions.type === 'mm') {
            // Avoid duplicate mm connections
            const correspondingColumn = acc.find(
              (relation) =>
                relation.type === 'mm' &&
                relation.parentColId === colOptions.fk_child_column_id &&
                relation.childColId === colOptions.fk_parent_column_id,
            )

            if (!correspondingColumn) {
              relation.type = 'mm'

              return acc.push(relation)
            }
          }
        }
      })

      return acc
    }, [] as Relation[]),
  )

  function edgeLabel({ type, source, target, modelId, childColId, parentColId }: Relation) {
    const typeLabel = type === 'mm' ? 'many to many' : 'has many'

    const parentCol = metasWithIdAsKey.value[source].columns?.find((col) => {
      const colOptions = col.colOptions as LinkToAnotherRecordType
      if (!colOptions) return false

      return (
        colOptions.fk_child_column_id === childColId &&
        colOptions.fk_parent_column_id === parentColId &&
        colOptions.fk_mm_model_id === modelId
      )
    })

    const childCol = metasWithIdAsKey.value[target].columns?.find((col) => {
      const colOptions = col.colOptions as LinkToAnotherRecordType
      if (!colOptions) return false

      return colOptions.fk_parent_column_id === (type === 'mm' ? childColId : parentColId)
    })

    if (!parentCol || !childCol) return ''

    if (type === 'mm') {
      if (config.showJunctionTableNames) {
        if (!modelId) return ''

        const mmModel = metasWithIdAsKey.value[modelId]

        if (!mmModel) return ''

        if (mmModel.title !== mmModel.table_name) {
          return [`${mmModel.title} (${mmModel.table_name})`]
        }

        return [mmModel.title]
      }
    }

    return [
      // detailed edge label
      `[${metasWithIdAsKey.value[source].title}] ${parentCol.title} - ${typeLabel} - ${childCol.title} [${metasWithIdAsKey.value[target].title}]`,
      // simple edge label (for skeleton)
      `${metasWithIdAsKey.value[source].title} - ${typeLabel} - ${metasWithIdAsKey.value[target].title}`,
    ]
  }

  function createNodes() {
    return erdTables.value.reduce<Node<NodeData>[]>((acc, table) => {
      if (!table.id) return acc

      const columns =
        metasWithIdAsKey.value[table.id].columns?.filter(
          (col) => config.showAllColumns || (!config.showAllColumns && col.uidt === UITypes.LinkToAnotherRecord),
        ) || []

      const pkAndFkColumns = columns.filter(() => config.showPkAndFk).filter((col) => col.pk || col.uidt === UITypes.ForeignKey)

      const nonPkColumns = columns.filter((col) => !col.pk && col.uidt !== UITypes.ForeignKey)

      acc.push({
        id: table.id,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        class: 'rounded-lg',
        data: {
          table: metasWithIdAsKey.value[table.id],
          pkAndFkColumns,
          nonPkColumns,
          showPkAndFk: config.showPkAndFk,
          showAllColumns: config.showAllColumns,
          columnLength: columns.length,
          color: '',
        },
        type: 'custom',
        position: { x: 0, y: 0 },
      })

      return acc
    }, [])
  }

  function createEdges() {
    return relations.value.reduce<Edge<EdgeData>[]>((acc, { source, target, childColId, parentColId, type, modelId }) => {
      let sourceColumnId, targetColumnId

      if (type === 'hm') {
        sourceColumnId = childColId
        targetColumnId = childColId
      }

      if (type === 'mm') {
        sourceColumnId = parentColId
        targetColumnId = childColId
      }

      const [label, simpleLabel] = edgeLabel({
        source,
        target,
        type,
        childColId,
        parentColId,
        modelId,
      })

      acc.push({
        id: `e-${sourceColumnId}-${source}-${targetColumnId}-${target}-#${label}`,
        source: `${source}`,
        target: `${target}`,
        sourceHandle: `s-${sourceColumnId}-${source}`,
        targetHandle: `d-${targetColumnId}-${target}`,
        type: 'custom',
        markerEnd: {
          id: 'arrow-colored',
          type: MarkerType.ArrowClosed,
        },
        data: {
          isManyToMany: type === 'mm',
          isSelfRelation: source === target && sourceColumnId === targetColumnId,
          label,
          simpleLabel,
          color: '',
        },
      })

      return acc
    }, [])
  }

  const createElements = () => {
    elements.value = [...createNodes(), ...createEdges()] as Elements<NodeData | EdgeData>
    return elements.value
  }

  watch(
    erdTables,
    () => {
      createElements()
    },
    { immediate: true },
  )

  return {
    elements,
    createElements,
  }
}

const padding = 150

const boxShadow = (skeleton: boolean, color: string) => ({
  border: 'none !important',
  boxShadow: `0 0 0 ${skeleton ? '12' : '2'}px ${color}`,
})

const layout: Function = flextree()
  .nodeSize((n: TreeNode) => [n.data.dimensions.height + padding, n.data.dimensions.width + padding])
  .spacing((nodeA: TreeNode, nodeB: TreeNode) => nodeA.path(nodeB).length)

function layoutNodes(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  // convert nodes and edges into a hierarchical object for using it with the layout function
  const hierarchy = stratify<GraphNode>()
    .id((d) => d.id)
    // get the id of each node by searching through the edges
    .parentId((d) => edges.find((e) => e.target === d.id)?.source)(nodes)

  // run the layout algorithm with the hierarchy data structure
  const root = layout(hierarchy)

  // convert the hierarchy back to vue flow nodes (the original node is stored as d.data)
  // we only extract the position and depth from the d3 function
  // we also flip the x and y coords to get the correct orientation (L to R)
  return root
    .descendants()
    .map((d: TreeNode) => ({ ...d.data, position: { x: d.y, y: d.x }, data: { ...d.data.data, depth: d.depth } }))
}

/**
 * Utility to create a layout of current nodes
 * Should be executed after nodes have been passed to Vue Flow, so we can use the *actual* dimensions and not guess them
 * @param skeleton
 */
export function useLayout(skeleton: Ref<boolean>) {
  const { getNodes, setNodes, getEdges, findNode } = useVueFlow()
  const { theme } = useTheme()

  const colorScale = scaleLinear<string>().domain([0, 2]).range([theme.value.primaryColor, theme.value.accentColor])

  return () => {
    // run the layout and get back the nodes with their updated positions
    const targetNodes = layoutNodes(getNodes.value, getEdges.value)

    // if you do not want to animate the nodes, you can uncomment the following line
    setNodes(
      targetNodes.map((node) => {
        const color = colorScale(node.data.depth)

        return {
          ...node,
          data: {
            ...node.data,
            color,
          },
          style: (n) => {
            if (n.selected) {
              return boxShadow(skeleton.value, color)
            }

            return boxShadow(skeleton.value, skeleton.value ? color : '#64748B')
          },
        }
      }),
    )

    getEdges.value.forEach((edge) => {
      const node = findNode(edge.source)

      if (node) {
        const color = node.data.color

        edge.data.color = color
        ;(edge.markerEnd as EdgeMarker).color = `#${tinycolor(color).toHex()}`
      }
    })
  }
}

export default useLayout
