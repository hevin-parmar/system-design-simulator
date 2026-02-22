/**
 * Right panel: Requirements and Interview tabs.
 */
import { useState, useRef, useEffect } from 'react'
import RequirementsPanel from './RequirementsPanel'
import GamePanel from './GamePanel'
import InterviewPanel from './InterviewPanel'

export default function RightPanel({
  question,
  nodes,
  edges,
  packId,
  pack,
  currentGraph,
  trafficLoad = 1000,
  onDiagramChanged,
  interviewSessionId,
  interviewHistory,
  onInterviewHistory,
  onInterviewReset,
  qualityReport,
  designId,
}) {
  const [activeTab, setActiveTab] = useState('requirements')
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [interviewHistory])

  return (
    <div className="right-panel">
      <div className="right-panel__tabs">
        <button
          type="button"
          className={`right-panel__tab ${activeTab === 'requirements' ? 'active' : ''}`}
          onClick={() => setActiveTab('requirements')}
        >
          Requirements
        </button>
        <button
          type="button"
          className={`right-panel__tab ${activeTab === 'interview' ? 'active' : ''}`}
          onClick={() => setActiveTab('interview')}
        >
          Interview
        </button>
      </div>
      <div className="right-panel__content">
        {activeTab === 'requirements' && (
          <div className="right-panel__scroll">
            {qualityReport && (qualityReport.missingCritical?.length > 0 || qualityReport.unnecessary?.length > 0) && (
              <div className="right-panel__quality">
                {qualityReport.missingCritical?.length > 0 && (
                  <section className="reqSection">
                    <div className="reqSectionHeader">Missing Critical</div>
                    <ul className="reqList">
                      {qualityReport.missingCritical.map((m, i) => (
                        <li key={i} className="reqItem reqItem--flagged">{m.message || m.layer}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {qualityReport.unnecessary?.length > 0 && (
                  <section className="reqSection">
                    <div className="reqSectionHeader">Unnecessary</div>
                    <ul className="reqList">
                      {qualityReport.unnecessary.map((u, i) => (
                        <li key={i} className="reqItem reqItem--flagged">{u.nodeId}: {u.reason}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
            <RequirementsPanel question={question} designId={designId} />
            <GamePanel question={question} nodes={nodes} edges={edges} />
          </div>
        )}
        {activeTab === 'interview' && (
          <div className="right-panel__scroll right-panel__scroll--interview">
            <InterviewPanel
              packId={packId}
              pack={pack}
              currentGraph={currentGraph}
              trafficLoad={trafficLoad}
              onDiagramChanged={onDiagramChanged}
              sessionId={interviewSessionId}
              history={interviewHistory}
              onHistoryChange={onInterviewHistory}
              onReset={onInterviewReset}
              chatEndRef={chatEndRef}
            />
          </div>
        )}
      </div>
    </div>
  )
}
