import type { Edge, Node } from '@vue-flow/core'
import { useVueFlow } from '@vue-flow/core'
import { stratify, tree } from 'd3-hierarchy'
import { ref } from '#imports'

// initialize the tree layout (see https://observablehq.com/@d3/tree for examples)
const layout = tree<Node>()
  // the node size configures the spacing between the nodes ([width, height])
  .nodeSize([500, 500])
  // this is needed for creating equal space between all nodes
  .separation(() => 1)

// the layouting function
// accepts current nodes and edges and returns the layouted nodes with their updated positions
function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  // convert nodes and edges into a hierarchical object for using it with the layout function
  const hierarchy = stratify<Node>()
    .id((d) => d.id)
    // get the id of each node by searching through the edges
    // this only works if every node has one connection
    .parentId((d) => edges.find((e) => e.target === d.id)?.source)(nodes)

  // run the layout algorithm with the hierarchy data structure
  const root = layout(hierarchy)

  // convert the hierarchy back to react flow nodes (the original node is stored as d.data)
  // we only extract the position from the d3 function
  return root.descendants().map((d) => ({ ...d.data, position: { x: d.y, y: d.x } }))
}

function useLayout() {
  // this ref is used to fit the nodes in the first run
  // after first run, this is set to false
  const initial = ref(true)

  const { getNodes, setNodes, getEdges, fitView } = useVueFlow()

  return () => {
    // run the layout and get back the nodes with their updated positions
    const targetNodes = layoutNodes(getNodes.value, getEdges.value)

    // if you do not want to animate the nodes, you can uncomment the following line
    setNodes(targetNodes)

    // in the first run, fit the view
    if (!initial.value) {
      fitView({ duration: 200, padding: 0.2 })
    }
    initial.value = false
  }
}

export default useLayout
