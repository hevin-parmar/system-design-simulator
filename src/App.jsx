import { useState, useEffect, useCallback, useRef } from 'react'
import { useNodesState, useEdgesState } from '@xyflow/react'
import FlowCanvas from './components/FlowCanvas'
import NodeNotesPanel from './components/NodeNotesPanel'
import QuestionSidebar from './components/QuestionSidebar'
import RightPanel from './components/RightPanel'
import AdminModal from './components/AdminModal'
import DesignWizardModal from './components/DesignWizardModal'
import { processQuestions } from './utils/processQuestion'
import { getLayoutedElements } from './utils/dagreLayout'
import { computeUnnecessaryNodeIds } from './utils/gameLogic'
import { isAdminUnlocked } from './utils/adminAuth'

const API_BASE = 'http://localhost:3000'
const EMPTY_GRAPH = { nodes: [], edges: [] }

function formatTraffic(value) {
  if (value >= 1e6) return `${value / 1e6}M`
  if (value >= 1e3) return `${value / 1e3}K`
  return String(value)
}

function App() {
  const [designId, setDesignId] = useState(null)
  const [leftOpen, setLeftOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('leftOpen') ?? 'true') } catch { return true }
  })
  const [rightOpen, setRightOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rightOpen') ?? 'true') } catch { return true }
  })
  const [selectedNode, setSelectedNode] = useState(null)
  const [trafficLoad, setTrafficLoad] = useState(1000)
  const [questions, setQuestions] = useState([])
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [currentPack, setCurrentPack] = useState(null)
  const [search, setSearch] = useState('')
  const [nodes, setNodes, onNodesChange] = useNodesState(EMPTY_GRAPH.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(EMPTY_GRAPH.edges)
  const [initialGraph, setInitialGraph] = useState(EMPTY_GRAPH)
  const [loadingQuestion, setLoadingQuestion] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [adminUnlocked, setAdminUnlocked] = useState(() => isAdminUnlocked())
  const [interviewSessionId, setInterviewSessionId] = useState(null)
  const [interviewHistory, setInterviewHistory] = useState([])
  const [qualityReport, setQualityReport] = useState(null)
  const diagramChangeTimer = useRef(null)
  const designIdRef = useRef(designId)
  const skipLoadRef = useRef(false)

  const unnecessaryNodeIds = computeUnnecessaryNodeIds(nodes, edges)

  designIdRef.current = designId

  useEffect(() => {
    localStorage.setItem('leftOpen', JSON.stringify(leftOpen))
  }, [leftOpen])
  useEffect(() => {
    localStorage.setItem('rightOpen', JSON.stringify(rightOpen))
  }, [rightOpen])

  useEffect(() => {
    setAdminUnlocked(isAdminUnlocked())
  }, [adminOpen])

  useEffect(() => {
    const handler = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      if (e.key === '[') { e.preventDefault(); setLeftOpen((v) => !v) }
      else if (e.key === ']') { e.preventDefault(); setRightOpen((v) => !v) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const refreshQuestions = useCallback(async () => {
    try {
      const [packsRes, questionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/packs`).then((r) => r.json()),
        fetch(`${API_BASE}/api/questions`).then((r) => r.json()),
      ])
      const packList = packsRes?.packs || []
      const legacyQs = processQuestions(questionsRes?.questions || [])
      const merged = packList.length ? packList : legacyQs
      setQuestions(merged)
      return merged
    } catch (err) {
      console.error('Load questions failed:', err)
      return []
    }
  }, [])

  const fetchNewDesignId = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/design/new`, { method: 'POST' })
      const json = await res.json()
      return json.designId || null
    } catch (err) {
      console.error('Failed to create design:', err)
      return null
    }
  }, [])

  const loadDesignFromPack = useCallback(async (packId) => {
    try {
      const res = await fetch(`${API_BASE}/api/design/from-pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      if (!res.ok) throw new Error('from-pack failed')
      const json = await res.json()
      return { designId: json.designId, state: json.state, pack: json.pack }
    } catch (err) {
      console.error('Load design from pack failed:', err)
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchNewDesignId().then((id) => {
      if (!cancelled && id) setDesignId(id)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    refreshQuestions().then((merged) => {
      if (!cancelled && merged?.length && !selectedQuestion) setSelectedQuestion(merged[0])
    })
    return () => { cancelled = true }
  }, [])

  const loadDesignState = useCallback(async (dId) => {
    if (!dId) return
    try {
      const res = await fetch(`${API_BASE}/api/design/${dId}`)
      if (!res.ok) return
      const state = await res.json()
      if (designIdRef.current !== dId) return
      const n = state.nodes?.length ? state.nodes : EMPTY_GRAPH.nodes
      const e = state.edges?.length ? state.edges : EMPTY_GRAPH.edges
      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
        JSON.parse(JSON.stringify(n)),
        JSON.parse(JSON.stringify(e)),
        'TB'
      )
      if (designIdRef.current !== dId) return
      setNodes(layouted)
      setEdges(layoutedEdges)
      setInitialGraph({ nodes: layouted, edges: layoutedEdges })
      setSelectedNode(null)
    } catch (err) {
      console.warn('Load design state failed:', err)
    }
  }, [setNodes, setEdges])

  useEffect(() => {
    if (!designId) return
    if (skipLoadRef.current) {
      skipLoadRef.current = false
      return
    }
    loadDesignState(designId)
  }, [designId, loadDesignState])

  useEffect(() => {
    if (!selectedQuestion?.id) return
    let cancelled = false
    setLoadingQuestion(true)
    loadDesignFromPack(selectedQuestion.id).then((result) => {
      if (cancelled || !result) return
      const { designId: newId, state, pack } = result
      skipLoadRef.current = true
      setNodes([])
      setEdges([])
      setInitialGraph(EMPTY_GRAPH)
      setSelectedNode(null)
      setInterviewSessionId(null)
      setInterviewHistory([])
      setQualityReport(null)
      setCurrentPack(pack)
      setDesignId(newId)
      const n = state?.nodes?.length ? state.nodes : EMPTY_GRAPH.nodes
      const e = state?.edges?.length ? state.edges : EMPTY_GRAPH.edges
      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
        JSON.parse(JSON.stringify(n)),
        JSON.parse(JSON.stringify(e)),
        'TB'
      )
      setNodes(layouted)
      setEdges(layoutedEdges)
      setInitialGraph({ nodes: layouted, edges: layoutedEdges })
    }).finally(() => { if (!cancelled) setLoadingQuestion(false) })
    return () => { cancelled = true }
  }, [selectedQuestion?.id])

  const handleNewDesign = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/design/new`, { method: 'POST' })
      const json = await res.json()
      const newId = json.designId
      if (newId) {
        // Clear diagram and UI state synchronously BEFORE designId to prevent save effect from persisting stale data
        setNodes(EMPTY_GRAPH.nodes)
        setEdges(EMPTY_GRAPH.edges)
        setInitialGraph(EMPTY_GRAPH)
        setSelectedQuestion(null)
        setCurrentPack(null)
        setSelectedNode(null)
        setInterviewSessionId(null)
        setInterviewHistory([])
        setQualityReport(null)
        setDesignId(newId)
      }
    } catch (err) {
      console.error('New design failed:', err)
    }
  }, [setNodes, setEdges])

  useEffect(() => {
    if (!selectedQuestion?.id) setCurrentPack(null)
  }, [selectedQuestion?.id])

  const startInterviewSession = useCallback(async (packId, dId) => {
    if (!packId && !dId) return
    try {
      const res = await fetch(`${API_BASE}/api/interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: packId || currentPack?.id, designId: dId || designId }),
      })
      const data = await res.json()
      setInterviewSessionId(data.sessionId || null)
      setInterviewHistory(data.history || [])
    } catch (err) {
      console.warn('Interview start failed:', err)
    }
  }, [currentPack?.id, designId])

  useEffect(() => {
    if ((selectedQuestion?.id || currentPack?.id) && !loadingQuestion) {
      startInterviewSession(selectedQuestion?.id || currentPack?.id, designId)
    } else if (!selectedQuestion?.id && !currentPack?.id) {
      setInterviewSessionId(null)
      setInterviewHistory([])
    }
  }, [selectedQuestion?.id, currentPack?.id, designId, loadingQuestion, startInterviewSession])

  const handleDiagramChange = useCallback(
    (diagram, changeMeta) => {
      if (!selectedQuestion?.id || !interviewSessionId) return
      if (diagramChangeTimer.current) clearTimeout(diagramChangeTimer.current)
      diagramChangeTimer.current = setTimeout(async () => {
        diagramChangeTimer.current = null
        try {
          const res = await fetch(`${API_BASE}/api/interview/diagramChanged`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: interviewSessionId,
              packId: selectedQuestion.id,
              diagram: { nodes: diagram.nodes, edges: diagram.edges },
              changeMeta,
            }),
          })
          const data = await res.json()
          if (data.history) setInterviewHistory(data.history)
        } catch (err) {
          console.warn('Diagram change sync failed:', err)
        }
      }, 500)
    },
    [selectedQuestion?.id, interviewSessionId]
  )

  const handleInterviewReset = useCallback(() => {
    if (selectedQuestion?.id) startInterviewSession(selectedQuestion.id)
  }, [selectedQuestion?.id, startInterviewSession])

  useEffect(() => {
    if (!designId || loadingQuestion) return
    const t = setTimeout(() => {
      fetch(`${API_BASE}/api/design/${designId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, packId: selectedQuestion?.id || currentPack?.id }),
      })
        .then(() => undefined)
        .catch((e) => console.warn('Design state save failed:', e))
    }, 500)
    return () => clearTimeout(t)
  }, [nodes, edges, designId, selectedQuestion?.id, currentPack?.id, loadingQuestion])

  const handleStartGame = useCallback(() => {
    if (selectedQuestion?.id) {
      startInterviewSession(selectedQuestion.id)
      // Could show a toast or visual feedback
    }
  }, [selectedQuestion?.id, startInterviewSession])

  const handleWizardSuccess = useCallback((pack, newDesignId) => {
    if (!pack) return
    if (newDesignId) setDesignId(newDesignId)
    setQualityReport(pack.qualityReport || pack.validation?.qualityReport || null)
    const { diagramSpec, validation } = pack
    const notesByNodeId = diagramSpec?.notesByNodeId || {}
    const nodeValidation = (validation?.nodeValidation || []).reduce((acc, v) => {
      acc[v.nodeId] = v
      return acc
    }, {})
    if (diagramSpec?.nodes?.length) {
      const nodes = diagramSpec.nodes.map((n, i) => {
        const notes = notesByNodeId[n.id] || n.data || {}
        const v = nodeValidation[n.id]
        return {
          id: n.id ?? `node-${i}`,
          position: { x: 250, y: i * 80 },
          data: {
            label: n.label ?? n.id,
            purpose: notes.purpose ?? n.data?.purpose,
            defaults: notes.defaults ?? notes.knobs ?? n.data?.defaults,
            configs: notes.configs ?? notes.knobs ?? n.data?.defaults,
            tradeoffs: notes.tradeoffs ?? n.data?.tradeoffs ?? [],
            failureModes: notes.failureModes ?? n.data?.failureModes ?? [],
            interviewHooks: notes.interviewHooks ?? n.data?.interviewHooks ?? [],
            justificationLinks: v?.justifications ?? [],
            nodeStatus: v?.status,
            nodeSuggestion: v?.suggestion,
          },
        }
      })
      const edges = (diagramSpec.edges || []).map((e, i) => ({
        id: `e-${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
      }))
      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'TB')
      setNodes(layouted)
      setEdges(layoutedEdges)
      setInitialGraph({ nodes: layouted, edges: layoutedEdges })
    }
    setCurrentPack(pack)
    setSelectedQuestion(pack)
    setSelectedNode(null)
    refreshQuestions()
  }, [setNodes, setEdges, refreshQuestions])

  const handleReset = useCallback(async () => {
    if (designId && !selectedQuestion?.id) {
      try {
        const res = await fetch(`${API_BASE}/api/design/${designId}/reset`, { method: 'POST' })
        const state = await res.json()
        const n = state.nodes?.length ? state.nodes : EMPTY_GRAPH.nodes
        const e = state.edges?.length ? state.edges : EMPTY_GRAPH.edges
        const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(JSON.parse(JSON.stringify(n)), JSON.parse(JSON.stringify(e)), 'TB')
        setNodes(layouted)
        setEdges(layoutedEdges)
        setInitialGraph({ nodes: layouted, edges: layoutedEdges })
        setSelectedNode(null)
      } catch (err) { console.error('Reset failed:', err) }
      return
    }
    if (!selectedQuestion?.id) return
    try {
      const res = await fetch(`${API_BASE}/api/packs/${selectedQuestion.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const { nodes: resetNodes, edges: resetEdges } = await res.json()
      const toUse = resetNodes?.length ? resetNodes : initialGraph.nodes
      const toUseEdges = resetEdges?.length ? resetEdges : initialGraph.edges
      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
        JSON.parse(JSON.stringify(toUse)),
        JSON.parse(JSON.stringify(toUseEdges)),
        'TB'
      )
      setNodes(layouted)
      setEdges(layoutedEdges)
      setInitialGraph({ nodes: layouted, edges: layoutedEdges })
      setSelectedNode(null)
    } catch (err) {
      console.error('Reset failed:', err)
      const fallbackRes = await fetch(`${API_BASE}/api/questions/${selectedQuestion.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(() => null)
      const toUse = fallbackRes ? await fallbackRes.json().catch(() => ({})) : initialGraph
      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
        toUse.nodes || initialGraph.nodes,
        toUse.edges || initialGraph.edges,
        'TB'
      )
      setNodes(layouted)
      setEdges(layoutedEdges)
    }
  }, [designId, selectedQuestion?.id, initialGraph, setNodes, setEdges])

  const handleSelectQuestion = useCallback((q) => setSelectedQuestion(q), [])

  const handleNodeUpdate = useCallback((nodeId, updates) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
      )
    )
  }, [setNodes])

  const nodesWithUnnecessary = nodes.map((n) =>
    unnecessaryNodeIds.has(n.id) ? { ...n, className: `${n.className || ''} node--unnecessary`.trim() } : n
  )

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__top">
          <h1>System Design Simulator</h1>
          <div className="app-header__actions">
            <button type="button" className="btn-header" onClick={handleNewDesign}>
              New Design
            </button>
            <button type="button" className="btn-header" onClick={handleStartGame}>
              Start Game
            </button>
            <button type="button" className="btn-header admin-btn" onClick={() => setAdminOpen(true)}>
              {adminUnlocked ? 'Admin' : 'Unlock Admin'}
            </button>
          </div>
          <div className="traffic-slider">
            <label className="traffic-slider__label" htmlFor="traffic-load">Traffic Load</label>
            <div className="traffic-slider__control">
              <input
                id="traffic-load"
                type="range"
                min="0"
                max="100"
                value={Math.round(((Math.log10(trafficLoad) - 3) / 4) * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setTrafficLoad(Math.round(10 ** (3 + (4 * v) / 100)))
                }}
                className="traffic-slider__input"
              />
              <span className="traffic-slider__value">{formatTraffic(trafficLoad)}</span>
            </div>
          </div>
        </div>
          <div className="design-input-row">
          <button type="button" className="design-generate-btn" onClick={() => setWizardOpen(true)}>
            Generate Design
          </button>
        </div>
      </header>
      <main className="app-main">
        <div className="appLayout">
          <aside className={`leftPanel ${leftOpen ? 'open' : 'collapsed'}`}>
            <div className="panelHeader">
              <button type="button" className="panelToggle" onClick={() => setLeftOpen((v) => !v)}>
                {leftOpen ? '◀' : '▶'}
              </button>
              {leftOpen && <div className="panelTitle">Question Bank</div>}
            </div>
            {leftOpen ? (
              <div className="panelBody scrollY">
                <QuestionSidebar
                  questions={questions}
                  selectedQuestion={selectedQuestion}
                  onSelect={handleSelectQuestion}
                  search={search}
                  onSearchChange={setSearch}
                  hideTitle
                />
              </div>
            ) : (
              <div className="collapsedLabel">Questions</div>
            )}
          </aside>

          <main className="centerCanvas">
            <FlowCanvas
              key={designId || 'init'}
                nodes={nodesWithUnnecessary}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                setNodes={setNodes}
                setEdges={setEdges}
                initialGraph={initialGraph}
                onReset={handleReset}
                onNodeClick={(_, node) => setSelectedNode(node)}
                onPaneClick={() => setSelectedNode(null)}
                pack={currentPack || selectedQuestion}
                packId={selectedQuestion?.id}
                onDiagramChange={handleDiagramChange}
              />
            {selectedNode && (
              <NodeNotesPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onUpdate={handleNodeUpdate}
              />
            )}
          </main>

          <aside className={`rightPanel ${rightOpen ? 'open' : 'collapsed'}`}>
            <div className="panelHeader">
              {rightOpen && <div className="panelTitle">Requirements & Progress</div>}
              <button type="button" className="panelToggle" onClick={() => setRightOpen((v) => !v)}>
                {rightOpen ? '▶' : '◀'}
              </button>
            </div>
            {rightOpen ? (
              <div className="panelBody rightPanel__body" key={designId || 'no-design'}>
                <RightPanel
                  question={currentPack || selectedQuestion}
                  nodes={nodes}
                  edges={edges}
                  packId={selectedQuestion?.id}
                  pack={currentPack || selectedQuestion}
                  currentGraph={{ nodes, edges }}
                  trafficLoad={trafficLoad}
                  onDiagramChanged={handleDiagramChange}
                  interviewSessionId={interviewSessionId}
                  interviewHistory={interviewHistory}
                  onInterviewHistory={setInterviewHistory}
                  onInterviewReset={handleInterviewReset}
                  qualityReport={qualityReport}
                  designId={designId}
                />
              </div>
            ) : (
              <div className="collapsedLabel">Reqs</div>
            )}
          </aside>
        </div>
      </main>
      {adminOpen && (
        <AdminModal
          onClose={() => setAdminOpen(false)}
          unlocked={adminUnlocked}
          onUnlock={() => setAdminUnlocked(true)}
          onPacksRegenerated={refreshQuestions}
        />
      )}
      {wizardOpen && (
        <DesignWizardModal
          designId={designId}
          onClose={() => setWizardOpen(false)}
          onSuccess={handleWizardSuccess}
          onDesignIdNeeded={fetchNewDesignId}
        />
      )}
    </div>
  )
}

export default App
