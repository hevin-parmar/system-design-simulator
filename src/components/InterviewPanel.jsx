/**
 * Interview panel: chat-style Q&A with senior system design InterviewerAgent.
 * Displays focus line, sends full context (diagram, traffic, transcript).
 */
import { useState, useCallback, useEffect } from 'react'

const API_BASE = 'http://localhost:3000'

export default function InterviewPanel({
  packId,
  pack,
  currentGraph,
  trafficLoad = 1000,
  onDiagramChanged,
  sessionId,
  history,
  onHistoryChange,
  onReset,
  chatEndRef,
}) {
  const [userText, setUserText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    chatEndRef?.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, chatEndRef])

  const buildPayload = useCallback((text) => ({
    sessionId,
    packId,
    text,
    diagramSnapshot: currentGraph ? { nodes: currentGraph.nodes || [], edges: currentGraph.edges || [] } : undefined,
    trafficLoad,
  }), [sessionId, packId, currentGraph, trafficLoad])

  const handleStart = useCallback(async () => {
    if (!packId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/interview/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload('[Ready to start]')),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start')
      onHistoryChange?.(data.history || [])
    } catch (err) {
      setError(err?.message || 'Could not start interview')
    } finally {
      setLoading(false)
    }
  }, [packId, sessionId, onHistoryChange, buildPayload])

  const handleAnswer = useCallback(async () => {
    if (!packId || !userText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/interview/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(userText.trim())),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      onHistoryChange?.(data.history || [])
      setUserText('')
    } catch (err) {
      setError(err?.message || 'Could not send answer')
    } finally {
      setLoading(false)
    }
  }, [packId, sessionId, userText, onHistoryChange, buildPayload])

  const handleResetClick = useCallback(async () => {
    if (!packId) return
    try {
      await fetch(`${API_BASE}/api/interview/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      onHistoryChange?.([])
      onReset?.()
    } catch (err) {
      setError(err?.message || 'Could not reset')
    }
  }, [packId, onHistoryChange, onReset])

  if (!packId && !pack) {
    return (
      <div className="interview-panel">
        <p className="interview-empty">Select a question pack to start the interview.</p>
      </div>
    )
  }

  const hasHistory = Array.isArray(history) && history.length > 0
  const lastInterviewer = hasHistory ? [...history].reverse().find((h) => h.role === 'interviewer') : null
  const focus = lastInterviewer?.focus

  return (
    <div className="interview-panel interview-panel--chat">
      <div className="interview-panel__header">
        <span className="interview-panel__title">Interview</span>
        {hasHistory && (
          <button
            type="button"
            className="interview-panel__reset"
            onClick={handleResetClick}
            title="Reset interview for this pack"
          >
            Reset
          </button>
        )}
      </div>
      {focus && (
        <div className="interview-panel__focus">Focus: {focus}</div>
      )}
      <div className="interview-panel__messages">
        {!hasHistory ? (
          <div className="interview-panel__empty">
            <p>Make changes to the diagram to trigger questions, or start with an opener.</p>
            <button
              type="button"
              className="interview-panel__start-btn"
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? 'Starting…' : 'Start Interview'}
            </button>
          </div>
        ) : (
          history.map((entry, i) => (
            <div
              key={i}
              className={`interview-msg interview-msg--${entry.role}`}
            >
              <span className="interview-msg__role">{entry.role === 'interviewer' ? 'Interviewer' : 'You'}</span>
              <div className="interview-msg__text">{entry.text}</div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      {hasHistory && (
        <div className="interview-panel__input">
          <textarea
            className="interview-panel__textarea"
            placeholder="Your answer…"
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAnswer()
              }
            }}
          />
          <button
            type="button"
            className="interview-panel__send"
            onClick={handleAnswer}
            disabled={loading || !userText.trim()}
          >
            {loading ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
      {error && <div className="interview-panel__error">{error}</div>}
    </div>
  )
}
