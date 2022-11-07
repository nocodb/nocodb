import type { EdgeMarker, GraphEdge, GraphNode } from '@vue-flow/core'
import { useVueFlow } from '@vue-flow/core'
import { stratify } from 'd3-hierarchy'
import type { Ref } from 'vue'
import { scaleLinear } from 'd3-scale'
import tinycolor from 'tinycolor2'
// @ts-expect-error no types for flextree
import { flextree } from 'd3-flextree'
import type { TreeNode } from './types'
import { useTheme } from '#imports'

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
