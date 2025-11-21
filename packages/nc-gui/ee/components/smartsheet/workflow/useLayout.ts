import type { Ref } from 'vue'
import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@vue-flow/core'
import { Position, useVueFlow } from '@vue-flow/core'

type Direction = 'TB' | 'BT' | 'LR' | 'RL'

interface LayoutNode extends Node {
  position: { x: number; y: number }
  targetPosition?: Position
  sourcePosition?: Position
}

export function useLayout() {
  const { findNode } = useVueFlow()

  const graph: Ref<dagre.graphlib.Graph> = ref(new dagre.graphlib.Graph())

  const previousDirection: Ref<Direction> = ref('LR')

  function layout(nodes: Node[], edges: Edge[], direction: Direction): LayoutNode[] {
    // we create a new graph instance, in case some nodes/edges were removed, otherwise dagre would act as if they were still there
    const dagreGraph = new dagre.graphlib.Graph()

    graph.value = dagreGraph

    dagreGraph.setDefaultEdgeLabel(() => ({}))

    const isHorizontal = direction === 'LR'
    dagreGraph.setGraph({ rankdir: direction })

    previousDirection.value = direction

    for (const node of nodes) {
      // if you need width+height of nodes for your layout, you can use the dimensions property of the internal node (`GraphNode` type)
      const graphNode = findNode(node.id)

      if (graphNode) {
        dagreGraph.setNode(node.id, { width: graphNode.dimensions.width || 150, height: graphNode.dimensions.height || 50 })
      }
    }

    for (const edge of edges) {
      dagreGraph.setEdge(edge.source, edge.target)
    }

    dagre.layout(dagreGraph)

    // set nodes with updated positions
    return nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id)

      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: { x: nodeWithPosition.x, y: nodeWithPosition.y },
      }
    })
  }

  return { graph, layout, previousDirection }
}
