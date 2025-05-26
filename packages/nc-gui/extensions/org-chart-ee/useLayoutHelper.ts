import dagre from 'dagre'
import { Position } from '@vue-flow/core'

export interface CoordPosition {
  x: number
  y: number
}

export interface Node {
  id: string
  position: CoordPosition
  data: any
}

export interface Edge {
  id: string
  source: string
  target: string
}

/**
 * Composable to run the layout algorithm on the graph.
 * It uses the `dagre` library to calculate the layout of the nodes and edges.
 */
export function useLayoutHelper() {
  function layout(nodes: Node[], edges: Edge[], direction: string) {
    // we create a new graph instance, in case some nodes/edges were removed, otherwise dagre would act as if they were still there
    const dagreGraph = new dagre.graphlib.Graph()

    dagreGraph.setDefaultEdgeLabel(() => ({}))
    dagreGraph.setGraph({ rankdir: direction })

    for (const node of nodes) {
      dagreGraph.setNode(node.id, { width: 250, height: 200 })
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
        position: { x: nodeWithPosition.x, y: nodeWithPosition.y },
        targetPosition: direction === 'TB' ? Position.Top : Position.Bottom,
        sourcePosition: direction === 'TB' ? Position.Bottom : Position.Top,
      }
    })
  }

  return { layout }
}
