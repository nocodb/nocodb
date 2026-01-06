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
      edge.zIndex = 2
      dagreGraph.setEdge(edge.source, edge.target)
    }

    dagre.layout(dagreGraph)

    // Post-process to ensure consistent edge-to-edge spacing between ranks
    const edgeGap = 80
    const rankGroups = new Map<number, Array<{ node: Node; dagreNode: dagre.Node }>>()

    // Group nodes by their rank (position along the flow direction)
    workflowNodes.forEach((node) => {
      const dagreNode = dagreGraph.node(node.id)
      if (!dagreNode) return

      const rankPos = isHorizontal ? dagreNode.x : dagreNode.y
      if (!rankGroups.has(rankPos)) rankGroups.set(rankPos, [])
      rankGroups.get(rankPos)!.push({ node, dagreNode })
    })

    // Process each rank to ensure consistent spacing
    const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b)
    let currentPos = 0

    const processedNodes = sortedRanks.flatMap((rankKey, i) => {
      const nodesInRank = rankGroups.get(rankKey)

      if (!nodesInRank || nodesInRank.length === 0) return []

      // First rank: use dagre's position
      // Subsequent ranks: position = previous bottom + gap + current node half-height
      if (i === 0) {
        const firstNode = nodesInRank[0]
        if (firstNode) {
          currentPos = isHorizontal ? firstNode.dagreNode.x : firstNode.dagreNode.y
        }
      } else {
        const prevRankKey = sortedRanks[i - 1]
        if (prevRankKey === undefined) return []

        const prevRank = rankGroups.get(prevRankKey)
        if (!prevRank || prevRank.length === 0) return []

        const prevMaxSize = Math.max(...prevRank.map((n) => (isHorizontal ? n.dagreNode.width : n.dagreNode.height)))

        const firstNode = nodesInRank[0]
        if (!firstNode) return []

        const currentSize = isHorizontal ? firstNode.dagreNode.width : firstNode.dagreNode.height

        currentPos += prevMaxSize / 2 + edgeGap + currentSize / 2
      }

      // Apply position to all nodes in this rank
      return nodesInRank.map(({ node, dagreNode }) => ({
        ...node,
        zIndex: 2,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: isHorizontal ? { x: currentPos, y: dagreNode.y } : { x: dagreNode.x, y: currentPos },
      }))
    })

    // Include note nodes with their manual positions
    return [
      ...processedNodes,
      ...nodes
        .filter((n) => n.type === GeneralNodeID.NOTE)
        .map((n) => ({
          ...n,
          zIndex: 1,
          position: n.position || { x: 0, y: 0 },
        })),
    ]
  }

  return { graph, layout, previousDirection }
}
