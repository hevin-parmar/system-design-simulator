import { useState, useCallback, useEffect, useMemo } from 'react'

const REQ_CHECKS_KEY = 'reqChecks'
const JUNK = /(what is|high level|database schema|capacity estimation|constraints|storage estimate|for details|take a look)/i
const MAX_LEN = 120

function compressOneLiner(s) {
  let t = (s || '').replace(/^[\s*\-•\d.)]+/, '').trim()
  t = t.replace(/\s+/g, ' ')
  return t
}

function normalizeReqs(list) {
  const out = []
  const seen = new Set()
  for (const x of list || []) {
    const t = compressOneLiner(x)
    if (!t || t.length < 8) continue
    if (JUNK.test(t)) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

function getChecksKey(designId, questionId) {
  return `${REQ_CHECKS_KEY}:${designId || ''}:${questionId || ''}`
}

function loadChecks(designId, questionId) {
  try {
    const raw = localStorage.getItem(getChecksKey(designId, questionId))
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveChecks(designId, questionId, checked) {
  try {
    localStorage.setItem(getChecksKey(designId, questionId), JSON.stringify([...checked]))
  } catch (e) {
    console.warn('Failed to save requirement checks', e)
  }
}

function ReqItem({ text, checked, onToggle, index }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > MAX_LEN
  const display = expanded || !isLong ? text : text.slice(0, MAX_LEN) + '…'
  return (
    <li className="reqItem">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(index)}
        className="reqItem__checkbox"
      />
      <span className="reqItem__text" onClick={() => isLong && setExpanded(!expanded)}>
        {display}
        {isLong && (
          <button type="button" className="reqItem__expand" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
            {expanded ? ' less' : ' more'}
          </button>
        )}
      </span>
    </li>
  )
}

function CollapsibleSection({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="reqSection">
      <button type="button" className="reqSectionHeader" onClick={() => setOpen(!open)}>
        <span>{title} ({count})</span>
        <span className="reqSectionChevron">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="reqSectionBody">{children}</div>}
    </section>
  )
}

export default function RequirementsPanel({ question, designId }) {
  const [activeTab, setActiveTab] = useState('split')
  const [checked, setChecked] = useState(new Set())

  useEffect(() => {
    setChecked(loadChecks(designId, question?.id))
  }, [designId, question?.id])

  useEffect(() => {
    if (question?.id && designId) saveChecks(designId, question.id, checked)
  }, [designId, question?.id, checked])

  const functional = normalizeReqs(question?.functionalRequirements || []).slice(0, 10)
  const nonFunctional = normalizeReqs(question?.nonFunctionalRequirements || []).slice(0, 10)
  const assumptions = (question?.assumptions || question?.constraintsAssumptions || []).slice(0, 8)
  const constraints = (question?.constraints || question?.constraintsAssumptions || []).slice(0, 10)
  const flaggedItems = (question?.flaggedItems || []).slice(0, 5)
  const merged = useMemo(() => [
    ...functional.map((t, i) => ({ text: t, type: 'F', index: `f-${i}` })),
    ...nonFunctional.map((t, i) => ({ text: t, type: 'NF', index: `nf-${i}` })),
  ], [functional, nonFunctional])

  const toggle = useCallback((key) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const markAllSatisfied = useCallback(() => {
    const all = new Set([...functional.map((_, i) => `f-${i}`), ...nonFunctional.map((_, i) => `nf-${i}`)])
    setChecked(all)
  }, [functional, nonFunctional])

  const clearChecks = useCallback(() => setChecked(new Set()), [])

  if (!question) {
    return (
      <div className="reqWrap">
        <div className="reqTitle">No question selected</div>
      </div>
    )
  }

  return (
    <div className="reqWrap">
      <div className="reqTitle">{question.title}</div>
      {(question.problemStatement || question.shortDescription) && (
        <div className="reqShortDesc">{question.problemStatement || question.shortDescription}</div>
      )}

      <div className="reqTabs">
        <button
          type="button"
          className={`reqTab ${activeTab === 'split' ? 'reqTab--active' : ''}`}
          onClick={() => setActiveTab('split')}
        >
          Split
        </button>
        <button
          type="button"
          className={`reqTab ${activeTab === 'merged' ? 'reqTab--active' : ''}`}
          onClick={() => setActiveTab('merged')}
        >
          Merged
        </button>
      </div>

      <div className="reqActions">
        <button type="button" className="reqCopyBtn" onClick={markAllSatisfied}>Mark all satisfied</button>
        <button type="button" className="reqCopyBtn" onClick={clearChecks}>Clear checks</button>
      </div>

      {activeTab === 'split' && (
        <>
          {question?.designPlan && (
            <CollapsibleSection title="Design Plan" count="✓" defaultOpen={true}>
              <div className="reqDesignPlan">
                {question.designPlan.workload && (
                  <div className="reqDesignPlan__block">
                    <strong>Workload</strong>
                    <ul className="reqList">
                      {Object.entries(question.designPlan.workload).map(([k, v]) => (
                        <li key={k} className="reqItem reqItem--muted"><code>{k}</code>: {String(v)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(question.designPlan.coreFlows?.length) > 0 && (
                  <div className="reqDesignPlan__block">
                    <strong>Core flows</strong>
                    <ul className="reqList">
                      {question.designPlan.coreFlows.map((f, i) => (
                        <li key={i} className="reqItem reqItem--muted">{f.description}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(question.designPlan.accessPatterns?.length) > 0 && (
                  <div className="reqDesignPlan__block">
                    <strong>Access patterns</strong>
                    <span className="reqDesignPlan__tags">{question.designPlan.accessPatterns.join(', ')}</span>
                  </div>
                )}
                {(question.designPlan.qualityGoals?.length) > 0 && (
                  <div className="reqDesignPlan__block">
                    <strong>Quality goals</strong>
                    <ul className="reqList">
                      {question.designPlan.qualityGoals.map((g, i) => (
                        <li key={i} className="reqItem reqItem--muted"><code>{g.metric}</code>: {g.target}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}
          {assumptions.length > 0 && (
            <CollapsibleSection title="Assumptions" count={assumptions.length} defaultOpen={false}>
              <ul className="reqList">
                {assumptions.map((a, i) => (
                  <li key={`a-${i}`} className="reqItem reqItem--muted">
                    <span className="reqItem__text">{typeof a === 'string' ? a : a.text}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}
          {constraints.length > 0 && (
            <CollapsibleSection title="Constraints" count={constraints.length} defaultOpen={false}>
              <ul className="reqList">
                {constraints.map((c, i) => (
                  <li key={`c-${i}`} className="reqItem reqItem--muted">
                    <span className="reqItem__text">{typeof c === 'string' ? c : c.text}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}
          <CollapsibleSection title="Functional" count={functional.length} defaultOpen>
            <ul className="reqList">
              {functional.map((t, i) => (
                <ReqItem
                  key={i}
                  text={t}
                  checked={checked.has(`f-${i}`)}
                  onToggle={() => toggle(`f-${i}`)}
                  index={i}
                />
              ))}
            </ul>
          </CollapsibleSection>
          <CollapsibleSection title="Non-Functional" count={nonFunctional.length} defaultOpen>
            <ul className="reqList">
              {nonFunctional.map((t, i) => (
                <ReqItem
                  key={i}
                  text={t}
                  checked={checked.has(`nf-${i}`)}
                  onToggle={() => toggle(`nf-${i}`)}
                  index={i}
                />
              ))}
            </ul>
          </CollapsibleSection>
          {flaggedItems.length > 0 && (
            <CollapsibleSection title="Noise/Unnecessary" count={flaggedItems.length} defaultOpen={false}>
              <ul className="reqList">
                {flaggedItems.map((f, i) => (
                  <li key={`f-${i}`} className="reqItem reqItem--flagged">
                    <span className="reqItem__text">{typeof f === 'string' ? f : f.text}</span>
                    {f.reason && <span className="reqItem__reason">— {f.reason}</span>}
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}
        </>
      )}

      {activeTab === 'merged' && (
        <div className="reqMerged">
          <ul className="reqList">
            {merged.map(({ text, type, index }) => (
              <li key={index} className="reqItem reqItem--merged">
                <span className={`reqBadge reqBadge--${type.toLowerCase()}`}>{type}</span>
                <input
                  type="checkbox"
                  checked={checked.has(index)}
                  onChange={() => toggle(index)}
                  className="reqItem__checkbox"
                />
                <span className="reqItem__text">
                  {text.length > MAX_LEN ? text.slice(0, MAX_LEN) + '…' : text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}
