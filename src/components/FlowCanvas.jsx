import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactFlow, MiniMap, Controls, Background, addEdge } from '@xyflow/react'

import '@xyflow/react/dist/style.css'

import DiagramToolbar from './DiagramToolbar'
import ComponentStoreDrawer from './ComponentStoreDrawer'
import { NODE_DESCRIPTIONS } from '../data/nodeTypes'
import { COMPONENT_REGISTRY } from '../data/componentRegistry'
import { getLayoutedElements } from '../utils/dagreLayout'
import { getLayerLayoutedElements } from '../utils/layerLayout'
import { getRequirementTags, getComponentHelps } from '../data/componentRules'
import './FlowCanvas.css'

function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setNodes,
  setEdges,
  initialGraph,
  onReset,
  onNodeClick,
  onPaneClick,
  pack,
  packId,
  onDiagramChange,
}) {
  const undoStack = useRef([])
  const [canUndo, setCanUndo] = useState(false)
  const [unnecessaryWarning, setUnnecessaryWarning] = useState(null)
  const [componentStoreOpen, setComponentStoreOpen] = useState(false)
  const warningTimer = useRef(null)

  const pushUndo = useCallback(() => {
    undoStack.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    })
    if (undoStack.current.length > 1) undoStack.current.shift()
    setCanUndo(true)
  }, [nodes, edges])

  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (prev) {
      setNodes(prev.nodes)
      setEdges(prev.edges)
      setCanUndo(undoStack.current.length > 0)
    }
  }, [setNodes, setEdges])

  const checkUnnecessary = useCallback((label) => {
    if (!pack) return
    const reqText = [
      ...(pack.functionalRequirements || []),
      ...(pack.nonFunctionalRequirements || []),
      pack.problemStatement || '',
    ].join(' ')
    const reqTags = new Set(getRequirementTags(reqText).map((t) => t.toLowerCase()))
    const helps = getComponentHelps(label).map((h) => h.toLowerCase())
    const hasMatch = helps.some((h) => reqTags.has(h) || [...reqTags].some((r) => r.includes(h) || h.includes(r)))
    if (helps.length > 0 && !hasMatch) {
      return `This may be unnecessary because "${label}" doesn't appear to satisfy any requirement.`
    }
    return null
  }, [pack])

  const onConnect = useCallback(
    (params) => {
      pushUndo()
      const newEdges = addEdge(params, edges)
      setEdges(newEdges)
      const newEdge = { source: params.source, target: params.target }
      onDiagramChange?.({ nodes, edges: newEdges }, { kind: 'connect', details: newEdge })
    },
    [setEdges, pushUndo, edges, nodes, onDiagramChange]
  )

  const runLayout = useCallback(() => {
    const hasLayerMetadata = nodes.some((n) => n.data?.layer)
    const { nodes: layoutedNodes, edges: layoutedEdges } = hasLayerMetadata
      ? getLayerLayoutedElements(nodes, edges)
      : getLayoutedElements(nodes, edges, 'TB')
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [nodes, edges, setNodes, setEdges])

  const handleReset = useCallback(() => {
    if (onReset) return onReset()
    if (!initialGraph?.nodes?.length && !initialGraph?.edges?.length) return
    const hasLayerMetadata = initialGraph.nodes.some((n) => n.data?.layer)
    const { nodes: layouted, edges: layoutedEdges } = hasLayerMetadata
      ? getLayerLayoutedElements(initialGraph.nodes, initialGraph.edges)
      : getLayoutedElements(initialGraph.nodes, initialGraph.edges, 'TB')
    setNodes(layouted)
    setEdges(layoutedEdges)
  }, [onReset, initialGraph, setNodes, setEdges])

  const handleAddNode = useCallback(
    (typeId, label, position) => {
      pushUndo()
      const uniqueId = `${typeId}-${Date.now().toString(36)}`
      const reg = COMPONENT_REGISTRY.find((c) => c.id === typeId)
      const description = reg?.purpose ?? NODE_DESCRIPTIONS[typeId] ?? ''
      const defaults = reg?.defaults ?? {}
      const pos = position && typeof position.x === 'number' ? position : { x: 250, y: 200 }
      const newNode = {
        id: uniqueId,
        position: pos,
        data: {
          label,
          description,
          purpose: reg?.purpose,
          defaults,
          configs: defaults,
          whenToUse: reg?.whenToUse,
          tradeoffs: reg?.tradeoffs,
          failureModes: reg?.failureModes,
          interviewHooks: reg?.interviewHooks,
        },
      }
      setNodes((nds) => {
        const next = [...nds, newNode]
        const hasLayerMetadata = next.some((n) => n.data?.layer)
        const { nodes: layouted } = hasLayerMetadata
          ? getLayerLayoutedElements(next, edges)
          : getLayoutedElements(next, edges, 'TB')
        queueMicrotask(() =>
          onDiagramChange?.({ nodes: layouted, edges }, { kind: 'addNode', details: newNode })
        )
        return layouted
      })
      const warn = checkUnnecessary(label)
      if (warn) {
        if (warningTimer.current) clearTimeout(warningTimer.current)
        setUnnecessaryWarning(warn)
        warningTimer.current = setTimeout(() => setUnnecessaryWarning(null), 6000)
      }
    },
    [setNodes, edges, pushUndo, checkUnnecessary, onDiagramChange]
  )

  const handleDeleteSelected = useCallback(() => {
    pushUndo()
    const toRemove = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
    const removedEdges = edges.filter((e) => e.selected)
    const nextNodes = nodes.filter((n) => !n.selected)
    const nextEdges = edges.filter(
      (e) => !e.selected && !toRemove.has(e.source) && !toRemove.has(e.target)
    )
    setNodes(nextNodes)
    setEdges(nextEdges)
    if (toRemove.size > 0) {
      onDiagramChange?.({ nodes: nextNodes, edges: nextEdges }, { kind: 'deleteNode', targetId: [...toRemove][0] })
    } else if (removedEdges.length > 0) {
      onDiagramChange?.({ nodes: nextNodes, edges: nextEdges }, { kind: 'deleteEdge', details: removedEdges[0] })
    }
  }, [setNodes, setEdges, nodes, edges, pushUndo, onDiagramChange])

  useEffect(() => {
    runLayout()
  }, [])

  useEffect(() => {
    undoStack.current = []
    setCanUndo(false)
  }, [packId])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setComponentStoreOpen((v) => !v)
        return
      }
      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      ) {
        const hasSelected =
          nodes.some((n) => n.selected) || edges.some((ed) => ed.selected)
        if (hasSelected) {
          e.preventDefault()
          handleDeleteSelected()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nodes, edges, handleDeleteSelected])

  return (
    <div className="flow-canvas-wrapper">
      <DiagramToolbar
        onDeleteSelected={handleDeleteSelected}
        onAutoLayout={runLayout}
        onReset={handleReset}
        onUndo={handleUndo}
        canUndo={canUndo}
        onOpenComponentStore={() => setComponentStoreOpen(true)}
      />
      {unnecessaryWarning && (
        <div className="flow-canvas-warning" role="alert">
          {unnecessaryWarning}
        </div>
      )}
      <div className="flow-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodesConnectable
          elementsSelectable
          fitView
          defaultEdgeOptions={{ type: 'smoothstep' }}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      <ComponentStoreDrawer
        open={componentStoreOpen}
        onClose={() => setComponentStoreOpen(false)}
        onAddNode={handleAddNode}
        nodes={nodes}
      />
    </div>
  )
}

export default FlowCanvas
