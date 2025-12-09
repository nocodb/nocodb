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
    const dagreGraph = new dagre.graphlib.Graph()

    graph.value = dagreGraph

    dagreGraph.setDefaultEdgeLabel(() => ({}))

    const isHorizontal = direction === 'LR'
    dagreGraph.setGraph({
      rankdir: direction,
      nodesep: 80, // Increased gap between nodes
      ranksep: 80, // Increased gap between ranks
      edgesep: 380, // Increased gap between edges
    })

    previousDirection.value = direction

    for (const node of nodes) {
      const graphNode = findNode(node.id)

      if (graphNode) {
        dagreGraph.setNode(node.id, { width: graphNode.dimensions.width || 150, height: graphNode.dimensions.height || 50 })
      }
    }

    for (const edge of edges) {
      dagreGraph.setEdge(edge.source, edge.target)
    }

    dagre.layout(dagreGraph)

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
