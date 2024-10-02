import { type LinkToAnotherRecordType, RelationTypes, UITypes } from 'nocodb-sdk'
import dagre from 'dagre'
import type { Edge, EdgeMarker, Elements, Node } from '@vue-flow/core'
import { MarkerType, Position, isEdge, isNode } from '@vue-flow/core'
import type { MaybeRef } from '@vueuse/core'
import { scaleLinear as d3ScaleLinear } from 'd3-scale'
import tinycolor from 'tinycolor2'

export interface AiBaseSchema {
  title: string
  tables: {
    title: string
    columns: { title: string; type: UITypes }[]
  }[]
  relationships: {
    from: string
    to: string
    type: RelationTypes
  }[]
  [key: string]: any
}

export interface AiERDConfig {
  showPkAndFk: boolean
  showViews: boolean
  showAllColumns: boolean
  singleTableMode: boolean
  showJunctionTableNames: boolean
  showMMTables: boolean
  isFullScreen: boolean
}

export interface AiNodeData {
  table: string
  columns: {
    title: string
    type: UITypes
    relationType?: RelationTypes
    colOptions?: LinkToAnotherRecordType | Record<string, string>
  }[]
  showAllColumns: boolean
  color: string
  columnLength: number
}

export interface AiEdgeData {
  isManyToMany: boolean
  isOneToOne: boolean
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
  type: RelationTypes
}

/**
 * This util is used to generate the AI ERD graph elements and layout them
 *
 * @param tables
 * @param props
 */
export function useErdElements(schema: MaybeRef<AiBaseSchema>, props: MaybeRef<AiERDConfig>) {
  const elements = ref<Elements<AiNodeData | AiEdgeData>>([])

  const { theme } = useTheme()

  const colorScale = d3ScaleLinear<string>().domain([0, 2]).range([theme.value.primaryColor, theme.value.accentColor])

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'LR' })

  const erdSchema = computed(() => unref(schema))
  const config = computed(() => unref(props))

  const nodeWidth = 300
  const nodeHeight = computed(() => (config.value.showViews && config.value.showAllColumns ? 50 : 40))

  const relations = computed(() => {
    return erdSchema.value.relationships.reduce((acc, column) => {
      const source = column.from
      const target = column.to

      const relation: Relation = {
        source,
        target,
        parentColId: source,
        childColId: target,
        modelId: source,
        type: column.type,
      }

      acc.push(relation)

      return acc
    }, [] as Relation[])
  })

  function edgeLabel({ type, source, target, childColId, parentColId }: Relation) {
    const typeLabel = {
      [RelationTypes.HAS_MANY]: 'has many',
      [RelationTypes.MANY_TO_MANY]: 'many to many',
      [RelationTypes.ONE_TO_ONE]: 'one to one',
    }

    return [
      // detailed edge label
      `[${source}] ${childColId} - ${typeLabel[type]} - ${parentColId} [${target}]`,
      // simple edge label (for skeleton)
      `${source} - ${typeLabel[type]} - ${target}`,
    ]
  }

  function createNodes() {
    return erdSchema.value.tables.reduce<Node<AiNodeData>[]>((acc, table) => {
      const relationshipColumns = erdSchema.value.relationships
        .filter((relationship) => relationship.from === table.title || relationship.to === table.title)
        .map((relationship) => {
          return {
            title: relationship.from === table.title ? relationship.to : relationship.from,
            type: UITypes.Links,
            relationType: relationship.to === table.title && relationship.type === 'hm' ? 'bt' : relationship.type,
            colOptions: {
              type: relationship.to === table.title && relationship.type === 'hm' ? 'bt' : relationship.type,
              fk_child_column_id: relationship.from === table.title ? relationship.to : relationship.from,
              fk_parent_column_id: relationship.from === table.title ? relationship.from : relationship.to,
            },
          }
        })

      const columns = table.columns.concat(relationshipColumns)

      acc.push({
        id: table.title,
        data: {
          table: table.title,
          showAllColumns: config.value.showAllColumns,
          columns: relationshipColumns,
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
    return relations.value.reduce<Edge<AiEdgeData>[]>((acc, { source, target, childColId, parentColId, type, modelId }) => {
      let sourceColumnId, targetColumnId

      if (type === RelationTypes.HAS_MANY || type === 'oo') {
        sourceColumnId = childColId
        targetColumnId = parentColId
      }

      if (type === RelationTypes.MANY_TO_MANY) {
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
          isManyToMany: type === RelationTypes.MANY_TO_MANY,
          isOneToOne: type === RelationTypes.ONE_TO_ONE,
          isSelfRelation: source === target && sourceColumnId === targetColumnId,
          label,
          simpleLabel,
          color: '',
        },
      })

      return acc
    }, [])
  }

  const boxShadow = (_skeleton: boolean, _color: string) => ({})

  const layout = async (skeleton = false): Promise<void> => {
    return new Promise((resolve) => {
      elements.value = [...createNodes(), ...createEdges()] as Elements<AiNodeData | AiEdgeData>

      for (const el of elements.value) {
        if (isNode(el)) {
          const node = el as Node<AiNodeData>
          const colLength = node.data!.columnLength

          const width = skeleton ? nodeWidth * 3 : nodeWidth
          const height = nodeHeight.value + (skeleton ? 250 : colLength > 0 ? nodeHeight.value * colLength : nodeHeight.value)
          dagreGraph.setNode(el.id, {
            width,
            height,
          })
        } else if (isEdge(el)) {
          dagreGraph.setEdge(el.source, el.target)
        }
      }

      dagre.layout(dagreGraph)

      for (const el of elements.value) {
        if (isNode(el)) {
          const color = colorScale(dagreGraph.predecessors(el.id)!.length)

          const nodeWithPosition = dagreGraph.node(el.id)

          el.targetPosition = Position.Left
          el.sourcePosition = Position.Right
          el.position = { x: nodeWithPosition.x, y: nodeWithPosition.y }
          el.class = ['rounded-lg border-1 border-gray-200 shadow-lg'].join(' ')
          el.data.color = color

          el.style = (n) => {
            if (n.selected) {
              return boxShadow(skeleton, color)
            }

            return boxShadow(skeleton, '#64748B')
          }
        } else if (isEdge(el)) {
          const node = elements.value.find((nodes) => nodes.id === el.source)
          if (node) {
            const color = node.data!.color

            el.data.color = color
            ;(el.markerEnd as EdgeMarker).color = `#${tinycolor(color).toHex()}`
          }
        }
      }

      resolve()
    })
  }

  return {
    elements,
    layout,
  }
}
