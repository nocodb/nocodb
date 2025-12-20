import type { Ref } from 'vue'
import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@vue-flow/core'
import { Position, useVueFlow } from '@vue-flow/core'
import { GeneralNodeID } from 'nocodb-sdk'

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

    const workflowNodes = nodes.filter((node) => node.type !== GeneralNodeID.NOTE)

    for (const node of workflowNodes) {
      const graphNode = findNode(node.id)

      const width = graphNode?.dimensions?.width || 150
      const height = graphNode?.dimensions?.height || 50

      dagreGraph.setNode(node.id, { width, height })
    }

    for (const edge of edges) {
      dagreGraph.setEdge(edge.source, edge.target)
    }

    dagre.layout(dagreGraph)

    return nodes.map((node) => {
      // Note nodes keep their manual positions
      if (node.type === GeneralNodeID.NOTE) {
        return {
          ...node,
          position: node.position || { x: 0, y: 0 },
        }
      }

      const nodeWithPosition = dagreGraph.node(node.id)

      // Fallback to existing position if dagre didn't compute position
      const position = nodeWithPosition ? { x: nodeWithPosition.x, y: nodeWithPosition.y } : node.position || { x: 0, y: 0 }

      return {
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position,
      }
    })
  }

  return { graph, layout, previousDirection }
}
