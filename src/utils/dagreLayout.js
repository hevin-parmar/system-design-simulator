import dagre from '@dagrejs/dagre'

const NODE_WIDTH = 160
const NODE_HEIGHT = 40

export function getLayoutedElements(nodes, edges, direction = 'TB') {
  if (!nodes?.length) return { nodes: [], edges: edges || [] }

  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100 })

  const nodeIds = new Set(nodes.map((n) => n.id))
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  ;(edges || []).forEach((edge) => {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target)
    }
  })

  try {
    dagre.layout(dagreGraph)
  } catch (e) {
    console.warn('Dagre layout failed:', e)
    return { nodes, edges: edges || [] }
  }

  const isHorizontal = direction === 'LR'

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      targetPosition: isHorizontal ? 'left' : 'top',
    }
  })

  return { nodes: layoutedNodes, edges }
}
