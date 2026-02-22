/**
 * Admin modal: upload video, transcribe, build memory.
 * Unlock with passcode; 1h expiry in localStorage.
 */
import { useState, useEffect } from 'react'
import { isAdminUnlocked, setAdminUnlocked, clearAdminUnlock, getAdminHeaders } from '../utils/adminAuth'

const API_BASE = 'http://localhost:3000'

export default function AdminModal({ onClose, unlocked: propUnlocked, onUnlock, onPacksRegenerated }) {
  const [unlocked, setUnlocked] = useState(propUnlocked ?? isAdminUnlocked())
  const [passcode, setPasscode] = useState('')
  const [passcodeError, setPasscodeError] = useState('')
  const [uploadId, setUploadId] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [mockTranscript, setMockTranscript] = useState(false)
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [trainTarget, setTrainTarget] = useState('both')
  const [activeTab, setActiveTab] = useState('training')
  const [corpusLog, setCorpusLog] = useState('')
  const [buildingCorpus, setBuildingCorpus] = useState(false)
  const [regenerateLog, setRegenerateLog] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    setUnlocked(propUnlocked ?? isAdminUnlocked())
  }, [propUnlocked])

  const headers = () => ({ ...getAdminHeaders(), 'Content-Type': 'application/json' })

  const handleUnlock = async (e) => {
    e.preventDefault()
    setPasscodeError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      const json = await res.json()
      if (json.ok) {
        setAdminUnlocked(passcode)
        setUnlocked(true)
        setPasscode('')
        onUnlock?.()
      } else {
        setPasscodeError('Invalid passcode')
      }
    } catch (err) {
      setPasscodeError('Verification failed')
    }
  }

  const handleLock = () => {
    clearAdminUnlock()
    setUnlocked(false)
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setStatus('Uploading…')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API_BASE}/api/admin/upload`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: fd,
      })
      if (res.status === 403) throw new Error('Admin passcode required')
      const json = await res.json()
      setUploadId(json.uploadId)
      setStatus('Uploaded: ' + (json.uploadId || 'OK'))
    } catch (err) {
      setStatus('Upload failed: ' + (err?.message || err))
    } finally {
      setUploading(false)
    }
    e.target.value = ''
  }

  const handleTranscribe = async () => {
    if (!uploadId) { setStatus('Upload a video first'); return }
    setTranscribing(true)
    setStatus('Transcribing…')
    try {
      const res = await fetch(`${API_BASE}/api/admin/transcribe`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ uploadId }),
      })
      if (res.status === 403) throw new Error('Admin passcode required')
      const json = await res.json()
      setTranscript(json.transcript || '')
      setMockTranscript(!!json.mockTranscript)
      setStatus(json.mockTranscript ? 'Transcription complete (mock)' : 'Transcription complete')
    } catch (err) {
      setStatus('Transcribe failed: ' + (err?.message || err))
    } finally {
      setTranscribing(false)
    }
  }

  const handleBuildCorpus = async () => {
    setBuildingCorpus(true)
    setCorpusLog('Building corpus…')
    try {
      const res = await fetch(`${API_BASE}/api/admin/build-corpus`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({}),
      })
      if (res.status === 403) throw new Error('Admin passcode required')
      const json = await res.json()
      setCorpusLog(json.log || `Done: ${json.chunks || 0} chunks from ${json.docs || 0} docs`)
    } catch (err) {
      setCorpusLog('Build failed: ' + (err?.message || err))
    } finally {
      setBuildingCorpus(false)
    }
  }

  const handleRegeneratePacks = async () => {
    setRegenerating(true)
    setRegenerateLog('Regenerating packs…')
    try {
      const res = await fetch(`${API_BASE}/api/admin/regenerate-packs`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ force: false }),
      })
      if (res.status === 403) throw new Error('Admin passcode required')
      const json = await res.json()
      const msg = `Updated: ${json.updated}, Skipped: ${json.skipped}`
      setRegenerateLog(msg)
      if (json.updated > 0) onPacksRegenerated?.()
    } catch (err) {
      setRegenerateLog('Regeneration failed: ' + (err?.message || err))
    } finally {
      setRegenerating(false)
    }
  }

  const handleBuildMemory = async () => {
    setStatus('Building memory…')
    try {
      const res = await fetch(`${API_BASE}/api/admin/build-memory`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ trainTarget }),
      })
      if (res.status === 403) throw new Error('Admin passcode required')
      const json = await res.json()
      setStatus(`Memory built (${json.chunks || 0} chunks, target: ${trainTarget})`)
    } catch (err) {
      setStatus('Build failed: ' + (err?.message || err))
    }
  }

  if (!unlocked) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Unlock Admin</h2>
            <button type="button" className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <form className="admin-unlock-form" onSubmit={handleUnlock}>
              <div className="admin-section">
                <label>Passcode</label>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => { setPasscode(e.target.value); setPasscodeError('') }}
                  placeholder="Enter passcode"
                  autoFocus
                />
              </div>
              {passcodeError && <p className="admin-error">{passcodeError}</p>}
              <button type="submit">Unlock</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Admin</h2>
          <div>
            <button type="button" className="admin-lock-btn" onClick={handleLock}>Lock</button>
            <button type="button" className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab ${activeTab === 'training' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('training')}
          >
            Training
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'corpus' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('corpus')}
          >
            Corpus
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'status' ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab('status')}
          >
            Status
          </button>
        </div>
        <div className="modal-body admin-modal__body">
          {activeTab === 'training' && (
            <>
              <p className="admin-hint">Offline training from local video or files. Upload → Transcribe → Build memory. Or build corpus from docs.</p>

              <div className="admin-section">
                <label>1. Upload video or file</label>
                <input
                  type="file"
                  accept="video/*,audio/*,.pdf,.txt,.md"
                  onChange={handleUpload}
                  disabled={uploading}
                />
                {uploadId && <span className="admin-uploaded">Uploaded: {uploadId}</span>}
              </div>

              <div className="admin-section">
                <label>2. Transcribe (video/audio)</label>
                <button type="button" onClick={handleTranscribe} disabled={!uploadId || transcribing}>
                  {transcribing ? 'Transcribing…' : 'Transcribe'}
                </button>
                {transcript && (
                  <pre className="admin-transcript">{transcript.slice(0, 300)}{transcript.length > 300 ? '…' : ''}</pre>
                )}
              </div>

              <div className="admin-section">
                <label>3. Build memory</label>
                <div className="admin-train-row">
                  <span>Train:</span>
                  <button
                    type="button"
                    className={trainTarget === 'creator' ? 'admin-train-btn active' : 'admin-train-btn'}
                    onClick={() => setTrainTarget('creator')}
                  >
                    Creator
                  </button>
                  <button
                    type="button"
                    className={trainTarget === 'interviewer' ? 'admin-train-btn active' : 'admin-train-btn'}
                    onClick={() => setTrainTarget('interviewer')}
                  >
                    Interviewer
                  </button>
                  <button
                    type="button"
                    className={trainTarget === 'both' ? 'admin-train-btn active' : 'admin-train-btn'}
                    onClick={() => setTrainTarget('both')}
                  >
                    Both
                  </button>
                </div>
                <button type="button" onClick={handleBuildMemory}>Build memory</button>
              </div>

              <div className="admin-section">
                <label>4. Build corpus</label>
                <p className="admin-hint admin-hint--sm">Build corpus from docs in server/ai/corpus/docs.</p>
                <button type="button" onClick={handleBuildCorpus} disabled={buildingCorpus}>
                  {buildingCorpus ? 'Building…' : 'Build Corpus'}
                </button>
                {corpusLog && <pre className="admin-corpus-log">{corpusLog}</pre>}
              </div>

              <div className="admin-section">
                <label>5. Regenerate packs</label>
                <p className="admin-hint admin-hint--sm">Regenerate Question Bank templates with current CreatorAgent (richer diagrams, canonical components).</p>
                <button type="button" onClick={handleRegeneratePacks} disabled={regenerating}>
                  {regenerating ? 'Regenerating…' : 'Regenerate Packs'}
                </button>
                {regenerateLog && <pre className="admin-corpus-log">{regenerateLog}</pre>}
              </div>

              {mockTranscript && (
                <div className="admin-warning">
                  Whisper is not configured. A mock transcript was used. Set WHISPER_BIN for real transcription.
                </div>
              )}
              {status && <div className="admin-status">{status}</div>}
            </>
          )}
          {activeTab === 'corpus' && (
            <div className="admin-placeholder">
              Corpus: index of docs in server/ai/corpus/docs. Use Training tab to build.
            </div>
          )}
          {activeTab === 'status' && (
            <div className="admin-placeholder">
              Agent status and health checks.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
