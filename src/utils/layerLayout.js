/**
 * Layer-aware layout: assigns fixed Y per architectural layer, spreads nodes horizontally.
 */

const LAYER_Y = {
  edge: 0,
  gateway: 150,
  app: 300,
  domain: 450,
  async: 600,
  data: 750,
  caching: 800,
  observability: 900,
  background: 850,
  resilience: 325,
}

const HORIZONTAL_SPACING = 200

export function getLayerLayoutedElements(nodes, edges) {
  if (!nodes?.length) return { nodes: [], edges: edges || [] }

  const byLayer = new Map()
  for (const node of nodes) {
    const layer = node.data?.layer || 'app'
    const y = LAYER_Y[layer] ?? LAYER_Y.app
    if (!byLayer.has(y)) byLayer.set(y, [])
    byLayer.get(y).push(node)
  }

  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b)
  const layoutedNodes = []

  for (const y of sortedLayers) {
    const layerNodes = byLayer.get(y)
    layerNodes.sort((a, b) => {
      const roleA = a.data?.role || a.data?.label || a.id || ''
      const roleB = b.data?.role || b.data?.label || b.id || ''
      return String(roleA).localeCompare(String(roleB)) || a.id.localeCompare(b.id)
    })
    const count = layerNodes.length
    const totalWidth = (count - 1) * HORIZONTAL_SPACING
    const startX = -totalWidth / 2
    layerNodes.forEach((node, i) => {
      layoutedNodes.push({
        ...node,
        position: { x: startX + i * HORIZONTAL_SPACING, y },
        sourcePosition: 'bottom',
        targetPosition: 'top',
      })
    })
  }

  return { nodes: layoutedNodes, edges: edges || [] }
}
