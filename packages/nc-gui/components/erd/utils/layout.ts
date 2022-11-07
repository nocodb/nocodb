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

/**
 * Utility to create a layout of current nodes
 * Should be executed after nodes have been passed to Vue Flow, so we can use the *actual* dimensisons and not guess them
 * @param skeleton
 */
export function useLayout(skeleton: Ref<boolean>) {
  const { getNodes, getEdges, findNode } = useVueFlow()

  const { theme } = useTheme()

  const colorScale = scaleLinear<string>().domain([0, 2]).range([theme.value.primaryColor, theme.value.accentColor])

  const layout: Function = flextree()
    .nodeSize((n: TreeNode) => [n.data.dimensions.height + padding, n.data.dimensions.width + padding * (skeleton.value ? 3 : 1)])
    .spacing(() => 1)

  function layoutNodes(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
    // convert nodes and edges into a hierarchical object for using it with the layout function
    const hierarchy = stratify<GraphNode>()
      .id((d) => d.id)
      // get the id of each node by searching through the edges
      .parentId((d) => {
        const sourceNodeId = edges.find((e) => e.target === d.id)?.source

        // if a parent relational table can be found, use that as the parent id
        if (sourceNodeId) return sourceNodeId

        // if no parent relational table can be found, use the project id as the parent id (this is the root node, otherwise we have multiple root nodes)
        return d.id !== '0' ? '0' : undefined
      })(nodes)

    // run the layout algorithm with the hierarchy data structure
    const root = layout(hierarchy)

    // convert the hierarchy back to vue flow nodes (the original node is stored as d.data)
    // we only extract the position and depth from the d3 function
    // we also flip the x and y coords to get the correct orientation (L to R)
    return root.descendants().forEach((d: TreeNode) => {
      if (d.id === '0') return

      const color = colorScale(d.depth)
      d.data.position = { x: d.y, y: d.x }
      d.data.data = { ...d.data.data, depth: d.depth, color }
      d.data.style = (n: GraphNode) => {
        if (n.selected) {
          return boxShadow(skeleton.value, color)
        }

        return boxShadow(skeleton.value, skeleton.value ? color : '#64748B')
      }
    })
  }

  return () => {
    layoutNodes(getNodes.value, getEdges.value)

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
