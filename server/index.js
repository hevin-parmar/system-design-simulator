// server/index.js
import express from 'express'
import multer from 'multer'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

import { normalizeTitle } from './utils/titleUtils.js'
import { readStore, writeStore, safeInitStore, deleteInterviewSession, getOrCreateDesignState, resetDesignState, getDesignState, updateDesignState } from './store.js'
import { readPacks, getPack, savePack, getSession, saveSession, isPackStale, PACK_VERSION } from './storage/index.js'
import { regenerateAllPacks } from './ai/tools/regeneratePacks.js'
import { createFromText, formatPack } from './ai/agents/CreatorAgent.js'
import { synthesize } from './ai/designSynthesizer.js'
import { getNextAction } from './ai/agents/InterviewerAgent.js'
import { COMPONENT_LAYOUT } from './ai/knowledge/layeredLayout.js'
import { getUploadPath, runTranscribe, buildMemory } from './ai/admin.js'
import { ensureSession, onDiagramChanged, onUserAnswer } from './ai/interviewSession.js'
import { buildCorpus } from './ai/tools/buildCorpus.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, 'data', 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

safeInitStore()

// Auto-regenerate stale packs on server start (version mismatch)
;(async () => {
  try {
    const packs = readPacks()
    const anyStale = packs.some(isPackStale)
    if (anyStale && packs.length > 0) {
      const result = await regenerateAllPacks({ force: false })
      if (result.updated > 0) console.log(`[Packs] Auto-regenerated ${result.updated} stale packs (v${PACK_VERSION})`)
    }
  } catch (err) {
    console.warn('[Packs] Auto-regeneration failed:', err?.message)
  }
})()

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `upload-${Date.now()}-${file.originalname || 'video'}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
})

const fileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `upload-${Date.now()}-${file.originalname || 'file'}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
})

/**
 * Map store question to API format (functionalRequirements, etc.)
 */
function toApiQuestion(q) {
  if (!q) return null
  return {
    ...q,
    functionalRequirements: q.functional ?? q.functionalRequirements ?? [],
    nonFunctionalRequirements: q.nonFunctional ?? q.nonFunctionalRequirements ?? [],
    rawSectionText: q.rawText ?? q.rawSectionText ?? '',
    shortDescription: q.summary ?? q.shortDescription ?? '',
  }
}

/**
 * Merge new questions into existing. Dedupe by id or title.
 */
function upsertQuestions(existing, newOnes) {
  const result = existing.map((q) => ({ ...q }))
  for (const nq of newOnes) {
    const idKey = (nq.id || '').toLowerCase()
    const titleKey = (nq.title || '').toLowerCase()
    const idx = result.findIndex(
      (q) =>
        (q.id || '').toLowerCase() === idKey ||
        (q.title || '').toLowerCase() === titleKey
    )
    const toAdd = {
      id: nq.id,
      title: nq.title,
      rawText: nq.rawText ?? nq.rawSectionText,
      summary: nq.summary ?? nq.shortDescription,
      functional: nq.functional ?? nq.functionalRequirements ?? [],
      nonFunctional: nq.nonFunctional ?? nq.nonFunctionalRequirements ?? [],
    }
    if (idx >= 0) result[idx] = { ...result[idx], ...toAdd }
    else result.push(toAdd)
  }
  return result
}

async function extractTextFromPdfBuffer(buffer) {
  const uint8 = new Uint8Array(buffer)
  const loadingTask = pdfjsLib.getDocument({ data: uint8, disableWorker: true })
  const pdf = await loadingTask.promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map((item) => item.str).join(' ') + '\n'
  }
  return { text: fullText, numPages: pdf.numPages }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname?.toLowerCase().endsWith('.pdf')) cb(null, true)
    else cb(new Error('Only PDF files allowed'), false)
  },
})

function extractDesignProblems(text, maxProblems = 10) {
  const matches = [...text.matchAll(/(?:^|\n)\s*Designing\s+([^\n]+)\s*/gi)].slice(0, maxProblems)
  const cleanLine = (s) => s.replace(/^[\s\-*•\u2022]+/, '').replace(/^\(?\d+[\).]\s*/, '').trim()
  const parseBulletLines = (block) => {
    if (!block) return []
    return block
      .split('\n')
      .map(cleanLine)
      .filter((s) => s.length >= 4)
      .filter((s) => !/^requirements?$/i.test(s) && !/^functional$/i.test(s) && !/^non[-\s]*functional$/i.test(s))
      .slice(0, 20)
  }

  return matches.map((match, i) => {
    const titleRaw = match[1].trim()
    const canonicalTitle = normalizeTitle(titleRaw)
    const startIdx = match.index ?? 0
    const endIdx = matches[i + 1]?.index ?? text.length
    const sectionText = text.slice(startIdx, endIdx)
    const funcMatch = sectionText.match(/Functional\s*Requirements?\s*[:\-]?\s*([\s\S]*?)(?=Non[-\s]*Functional\s*Requirements?|(?:^|\n)\s*Designing\s+|$)/i)
    const nfMatch = sectionText.match(/Non[-\s]*Functional\s*Requirements?\s*[:\-]?\s*([\s\S]*?)(?=(?:^|\n)\s*Designing\s+|$)/i)
    const safeSlug = canonicalTitle.toLowerCase().replace(/^design\s+/i, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40)
    return {
      id: `design-${i + 1}-${safeSlug}`,
      title: canonicalTitle,
      rawSectionText: sectionText,
      functionalRequirements: parseBulletLines(funcMatch?.[1] || ''),
      nonFunctionalRequirements: parseBulletLines(nfMatch?.[1] || ''),
    }
  })
}

// No-cache headers for design API (prevent stale diagrams from browser cache)
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}

// ---- Design (designId-centric) ----
const LAYER_NAMES = { 1: 'edge', 2: 'app', 3: 'async', 4: 'data', 5: 'observability' }

function randomId() {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function enrichNodeWithLayer(node) {
  const id = node.id || node.type
  const layout = COMPONENT_LAYOUT[id]
  let layerName = node.data?.layer
  if (!layerName) {
    if (id === 'cache' || id === 'cache-invalidation') layerName = 'caching'
    else {
      const layerNum = layout?.layer ?? 2
      layerName = LAYER_NAMES[layerNum] || 'app'
    }
  }
  const data = { ...(node.data || {}), layer: layerName }
  return { ...node, data }
}

function packToDiagramState(pack) {
  const { draft, baseline, baselineDesign, suggestedNodes, suggestedEdges, diagramSpec } = pack || {}
  let graph = draft || baseline
  if (!graph?.nodes?.length && baselineDesign?.nodes?.length) graph = baselineDesign
  if (!graph?.nodes?.length && diagramSpec?.nodes?.length) {
    graph = {
      nodes: (diagramSpec.nodes || []).map((n, i) => {
        const node = {
          id: n.id ?? n.type ?? `node-${i}`,
          position: n.position ?? { x: 250, y: i * 80 },
          data: { label: n.label ?? n.id, ...(n.details || {}), ...(n.data || {}) },
        }
        return enrichNodeWithLayer(node)
      }),
      edges: (diagramSpec.edges || []).map((e, i) => ({
        id: `e-${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
      })),
    }
  }
  if (!graph?.nodes?.length && suggestedNodes?.length) {
    graph = {
      nodes: (suggestedNodes || []).map((n, i) => ({
        id: n.type ?? n.id ?? `node-${i}`,
        position: { x: 250, y: i * 80 },
        data: { label: n.label || n.type },
      })),
      edges: (suggestedEdges || []).map((e, i) => ({
        id: `e-${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
      })),
    }
  }
  return graph?.nodes?.length ? { nodes: graph.nodes, edges: graph.edges || [] } : { nodes: [], edges: [] }
}

app.post('/api/design/new', (req, res) => {
  try {
    const designId = randomId()
    const state = resetDesignState(designId)
    res.set(NO_CACHE_HEADERS)
    return res.json({ designId, state })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to create design' })
  }
})

app.post('/api/design/from-pack', (req, res) => {
  try {
    const { packId } = req.body || {}
    if (!packId) return res.status(400).json({ error: 'packId required' })
    const pack = getPack(packId)
    if (!pack) return res.status(404).json({ error: 'Pack not found' })
    const store = readStore()
    const id = pack.id || packId
    const packWithDraft = { ...pack, draft: store.drafts?.[id] || null, baseline: store.baselines?.[id] || null }
    const { nodes = [], edges = [] } = packToDiagramState(packWithDraft)
    const designId = randomId()
    updateDesignState(designId, {
      nodes,
      edges,
      packId: pack.id || packId,
      requirements: {
        functional: pack.functionalRequirements || [],
        nonFunctional: pack.nonFunctionalRequirements || [],
        problemStatement: pack.problemStatement || '',
      },
      interview: { messages: [], selectedQuestion: null },
    })
    const state = getDesignState(designId)
    res.set(NO_CACHE_HEADERS)
    return res.json({ designId, state, pack: { ...pack, draft: null, baseline: null } })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to create design from pack' })
  }
})

app.get('/api/design/:designId', (req, res) => {
  try {
    const { designId } = req.params
    const state = getDesignState(designId)
    if (!state) return res.status(404).json({ error: 'Design not found' })
    res.set(NO_CACHE_HEADERS)
    return res.json(state)
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.get('/api/design/:designId/state', (req, res) => {
  try {
    const { designId } = req.params
    const state = getDesignState(designId)
    if (!state) return res.status(404).json({ error: 'Design not found' })
    res.set(NO_CACHE_HEADERS)
    return res.json(state)
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/design/:designId/reset', (req, res) => {
  try {
    const { designId } = req.params
    const state = resetDesignState(designId)
    res.set(NO_CACHE_HEADERS)
    return res.json(state)
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/design/:designId/state', (req, res) => {
  try {
    const { designId } = req.params
    const { nodes, edges, requirements, interview, packId } = req.body || {}
    const updates = {}
    if (Array.isArray(nodes)) updates.nodes = nodes
    if (Array.isArray(edges)) updates.edges = edges
    if (requirements && typeof requirements === 'object') updates.requirements = requirements
    if (interview && typeof interview === 'object') updates.interview = interview
    if (packId !== undefined) updates.packId = packId
    const state = updateDesignState(designId, updates)
    res.set(NO_CACHE_HEADERS)
    return res.json(state)
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

// ---- API Endpoints ----

app.get('/', (req, res) => res.send('Backend is running ✅'))

app.get('/api/knowledge/components', (req, res) => {
  try {
    const compPath = path.join(__dirname, 'ai', 'knowledge', 'components.json')
    if (!fs.existsSync(compPath)) return res.status(404).json({ error: 'Components not found' })
    const raw = fs.readFileSync(compPath, 'utf-8')
    return res.json(JSON.parse(raw))
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.get('/api/questions', (req, res) => {
  try {
    const store = readStore()
    const questions = (store.questions || []).map(toApiQuestion)
    return res.json({ questions })
  } catch (err) {
    console.error('GET /api/questions error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to load questions' })
  }
})

app.get('/api/questions/:id', (req, res) => {
  try {
    const store = readStore()
    const q = (store.questions || []).find((x) => (x.id || '').toLowerCase() === (req.params.id || '').toLowerCase())
    if (!q) return res.status(404).json({ error: 'Question not found' })
    const question = toApiQuestion(q)
    const baseline = store.baselines?.[q.id]
    const draft = store.drafts?.[q.id]
    return res.json({ question, baseline: baseline || null, draft: draft || null })
  } catch (err) {
    console.error('GET /api/questions/:id error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to load question' })
  }
})

function saveDraftOrBaseline(id, key, nodes, edges) {
  const store = readStore()
  store[key] = store[key] || {}
  store[key][id] = { nodes, edges }
  writeStore(store)
}

app.post('/api/questions/:id/baseline', (req, res) => {
  try {
    const { nodes = [], edges = [] } = req.body || {}
    saveDraftOrBaseline(req.params.id, 'baselines', nodes, edges)
    return res.json({ ok: true })
  } catch (err) {
    console.error('POST baseline error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to save baseline' })
  }
})

app.post('/api/packs/:id/baseline', (req, res) => {
  try {
    const { nodes = [], edges = [] } = req.body || {}
    saveDraftOrBaseline(req.params.id, 'baselines', nodes, edges)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/questions/:id/draft', (req, res) => {
  try {
    const { nodes = [], edges = [] } = req.body || {}
    saveDraftOrBaseline(req.params.id, 'drafts', nodes, edges)
    return res.json({ ok: true })
  } catch (err) {
    console.error('POST draft error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to save draft' })
  }
})

app.post('/api/packs/:id/draft', (req, res) => {
  try {
    const { nodes = [], edges = [] } = req.body || {}
    saveDraftOrBaseline(req.params.id, 'drafts', nodes, edges)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

function handleReset(id) {
  const pack = getPack(id)
  const store = readStore()
  let nodes = []
  let edges = []
  if (pack?.baselineDesign?.nodes?.length) {
    nodes = (pack.baselineDesign.nodes || []).map(enrichNodeWithLayer)
    edges = pack.baselineDesign.edges || []
  } else if (pack?.diagramSpec?.nodes?.length) {
    const { diagramSpec } = pack
    nodes = (diagramSpec.nodes || []).map((n, i) => enrichNodeWithLayer({
      id: n.id ?? n.type ?? `node-${i}`,
      position: n.position ?? { x: 250, y: i * 80 },
      data: { label: n.label ?? n.id, ...(n.details || {}), ...(n.data || {}) },
    }))
    edges = (diagramSpec.edges || []).map((e, i) => ({ id: `e-${i}-${e.source}-${e.target}`, source: e.source, target: e.target }))
  } else if (pack?.suggestedNodes?.length && pack?.suggestedEdges) {
    nodes = (pack.suggestedNodes || []).map((n, i) => enrichNodeWithLayer({
      id: n.type ?? n.id ?? `node-${i}`,
      position: { x: 250, y: i * 80 },
      data: { label: n.label || n.type },
    }))
    edges = (pack.suggestedEdges || []).map((e, i) => ({
      id: `e-${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
    }))
  } else {
    const baseline = store.baselines?.[id]
    nodes = (baseline?.nodes ?? []).map(enrichNodeWithLayer)
    edges = baseline?.edges ?? []
  }
  store.drafts = store.drafts || {}
  store.drafts[id] = { nodes, edges }
  writeStore(store)
  return { nodes, edges }
}

app.post('/api/questions/:id/reset', (req, res) => {
  try {
    const { nodes, edges } = handleReset(req.params.id)
    return res.json({ nodes, edges })
  } catch (err) {
    console.error('POST reset error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to reset' })
  }
})

app.post('/api/packs/:id/reset', (req, res) => {
  try {
    const { nodes, edges } = handleReset(req.params.id)
    return res.json({ nodes, edges })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/ingest', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF uploaded (field: file)' })
  try {
    const { text, numPages } = await extractTextFromPdfBuffer(req.file.buffer)
    if (!text.trim()) {
      return res.json({ packId: null, pack: null, meta: { pages: numPages, textLength: 0 } })
    }
    const pack = await createFromText(text)
    savePack(pack)
    return res.json({ packId: pack.id, pack, meta: { pages: numPages, textLength: text.length } })
  } catch (err) {
    console.error('Ingest error:', err)
    return res.status(500).json({ error: 'Failed to process PDF', details: err?.message })
  }
})

app.post('/api/summarizeRequirements', async (req, res) => {
  try {
    const { rawText } = req.body || {}
    if (!rawText) return res.status(400).json({ error: 'rawText required' })
    const key = process.env.OPENAI_API_KEY
    if (key) {
      try {
        const mod = await import('openai').catch(() => null)
        const OpenAI = mod?.default
        if (OpenAI) {
          const client = new OpenAI({ apiKey: key })
          const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 600,
            messages: [
              { role: 'system', content: 'Return JSON only: { "summary": "1-3 lines", "functional": ["item"], "nonFunctional": ["item"] }. Max 12 per section, each item <= 120 chars.' },
              { role: 'user', content: String(rawText).slice(0, 4000) },
            ],
          })
          const text = completion.choices?.[0]?.message?.content?.trim() || ''
          const m = text.match(/\{[\s\S]*\}/)
          if (m) {
            const p = JSON.parse(m[0])
            return res.json({ summary: p.summary || '', functional: p.functional || [], nonFunctional: p.nonFunctional || [] })
          }
        }
      } catch (e) { console.warn('OpenAI summarize failed:', e?.message) }
    }
    const funcMatch = rawText.match(/Functional\s*Requirements?\s*[:\-]?\s*([\s\S]*?)(?=Non[-\s]*Functional|$)/i)
    const nfMatch = rawText.match(/Non[-\s]*Functional\s*Requirements?\s*[:\-]?\s*([\s\S]*?)(?=Functional|$)/i)
    const extract = (block) => {
      if (!block) return []
      return block.split(/\n|(?<=[.!?])\s+/).map((s) => s.replace(/^[\s\-*•\d.)]+/, '').trim()).filter((s) => s.length >= 8 && /should|must|\d+\./i.test(s)).slice(0, 12)
    }
    const seen = new Set()
    const dedupe = (arr) => arr.filter((x) => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    const functional = dedupe(extract(funcMatch?.[1] || rawText))
    const nonFunctional = dedupe(extract(nfMatch?.[1] || ''))
    const summary = rawText.split(/Functional|Non[-\s]*Functional/i)[0].trim().slice(0, 300)
    return res.json({ summary, functional, nonFunctional })
  } catch (err) {
    console.error('Summarize error:', err)
    return res.status(500).json({ error: err?.message || 'Failed' })
  }
})

// ---- Dual AI / Packs / Admin ----

app.get('/api/packs', (req, res) => {
  try {
    const packs = readPacks()
    return res.json({ packs })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.get('/api/packs/:id', (req, res) => {
  const pack = getPack(req.params.id)
  if (!pack) return res.status(404).json({ error: 'Pack not found' })
  const store = readStore()
  const id = pack.id || req.params.id
  const draft = store.drafts?.[id]
  const baseline = store.baselines?.[id]
  return res.json({ ...pack, draft: draft || null, baseline: baseline || null })
})

app.post('/api/creator/from-text', async (req, res) => {
  try {
    const { text } = req.body || {}
    const pack = await createFromText(text || '')
    savePack(pack)
    return res.json(pack)
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/creator/format', (req, res) => {
  try {
    const { text } = req.body || {}
    const pack = formatPack(text || '')
    return res.json(pack)
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/wizard/generate', async (req, res) => {
  try {
    const {
      designId,
      title,
      problemStatement,
      functionalRequirements = [],
      nonFunctionalRequirements = [],
      constraints = {},
    } = req.body || {}
    if (!title?.trim()) return res.status(400).json({ error: 'title required' })

    const functional = Array.isArray(functionalRequirements) ? functionalRequirements.filter((f) => typeof f === 'string' && f.trim()) : []
    const nonFunctional = Array.isArray(nonFunctionalRequirements) ? nonFunctionalRequirements.filter((f) => typeof f === 'string' && f.trim()) : []
    const c = constraints || {}
    const pack = synthesize({
      title: title.trim(),
      problem: problemStatement?.trim() || '',
      functional,
      nonFunctional,
      constraints: {
        rps: c.traffic || c.rps,
        storage: c.storage,
        latency: c.latency,
        availability: c.availability,
      },
    })
    savePack(pack)
    if (designId) {
      const diagramSpec = pack.diagramSpec || {}
      const nodes = (diagramSpec.nodes || []).map((n, i) => ({
        id: n.id ?? n.type ?? `node-${i}`,
        position: n.position ?? { x: 250, y: i * 80 },
        data: { label: n.label ?? n.id, ...(n.details || {}), ...(n.data || {}) },
      }))
      const edges = (diagramSpec.edges || []).map((e, i) => ({
        id: `e-${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
      }))
      updateDesignState(designId, {
        nodes,
        edges,
        packId: pack.id,
        requirements: {
          functional: pack.functionalRequirements || [],
          nonFunctional: pack.nonFunctionalRequirements || [],
          problemStatement: pack.problemStatement || '',
        },
      })
      return res.json({ ...pack, designId })
    }
    return res.json(pack)
  } catch (err) {
    console.error('Wizard generate error:', err)
    return res.status(500).json({ error: err?.message || 'Generate failed' })
  }
})

app.post('/api/interviewer/next', async (req, res) => {
  try {
    const { packId, pack: packFromBody, phase, userAnswer, currentGraph, lastDiff, lastAskedQuestion } = req.body || {}
    const pack = packFromBody || (typeof packId === 'string' ? getPack(packId) : packId) || { id: packId }
    const action = await getNextAction(pack, phase, userAnswer, currentGraph, lastDiff, lastAskedQuestion)
    return res.json(action)
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.get('/api/sessions/:packId', (req, res) => {
  try {
    const session = getSession(req.params.packId)
    return res.json(session || { phase: 'requirements', history: [], currentQuestion: null })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/sessions/:packId', (req, res) => {
  try {
    const { phase, history, currentQuestion } = req.body || {}
    const session = { phase: phase || 'requirements', history: history || [], currentQuestion: currentQuestion || null }
    saveSession(req.params.packId, session)
    return res.json({ ok: true, session })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

// ---- Interview game loop ----
app.post('/api/interview/start', (req, res) => {
  try {
    const { packId, designId } = req.body || {}
    const effectivePackId = packId || (designId ? getDesignState(designId)?.packId : null)
    if (!effectivePackId) return res.status(400).json({ error: 'packId or designId with pack required' })
    const sessionKey = designId ? `interview-${designId}` : `interview-${effectivePackId}`
    const session = ensureSession(sessionKey, effectivePackId)
    return res.json({ sessionId: session.sessionId, history: session.history || [] })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/interview/diagramChanged', async (req, res) => {
  try {
    const { sessionId, packId, diagram, changeMeta } = req.body || {}
    if (!packId || !diagram) return res.status(400).json({ error: 'packId and diagram required' })
    const result = await onDiagramChanged(sessionId, packId, diagram, changeMeta)
    return res.json(result || { history: [] })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/interview/answer', async (req, res) => {
  try {
    const { sessionId, packId, text, diagramSnapshot, trafficLoad } = req.body || {}
    if (!packId) return res.status(400).json({ error: 'packId required' })
    const result = await onUserAnswer(sessionId, packId, text || '', {
      diagramSnapshot,
      trafficLoad,
    })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/interview/reset', (req, res) => {
  try {
    const { packId } = req.body || {}
    if (!packId) return res.status(400).json({ error: 'packId required' })
    const sid = `interview-${packId}`
    deleteInterviewSession(sid)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'admin123'

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-passcode']
  if (token === ADMIN_PASSCODE) return next()
  res.status(403).json({ error: 'Admin passcode required' })
}

app.post('/api/admin/verify', (req, res) => {
  try {
    const { passcode } = req.body || {}
    const ok = passcode === ADMIN_PASSCODE
    return res.json({ ok })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/admin/upload-video', requireAdmin, videoUpload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video uploaded (field: video)' })
  return res.json({ uploadId: req.file.filename, path: req.file.path })
})

app.post('/api/admin/upload', requireAdmin, fileUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field: file)' })
  return res.json({ uploadId: req.file.filename, path: req.file.path })
})

app.post('/api/admin/transcribe', requireAdmin, async (req, res) => {
  try {
    const { uploadId } = req.body || {}
    if (!uploadId) return res.status(400).json({ error: 'uploadId required' })
    const { transcript, mockTranscript } = await runTranscribe(uploadId)
    return res.json({ transcript, mockTranscript: !!mockTranscript })
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/admin/build-memory', requireAdmin, (req, res) => {
  try {
    const { trainTarget = 'both' } = req.body || {}
    const result = buildMemory(trainTarget)
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ error: err?.message })
  }
})

app.post('/api/admin/build-corpus', requireAdmin, (req, res) => {
  try {
    const chunks = buildCorpus()
    const docCount = new Set(chunks.map((c) => c.source || c.docId)).size
    return res.json({ ok: true, chunks: chunks.length, docs: docCount, log: `Corpus built: ${chunks.length} chunks from ${docCount} docs` })
  } catch (err) {
    console.error('Build corpus error:', err)
    return res.status(500).json({ error: err?.message || 'Build failed', log: err?.message })
  }
})

app.post('/api/admin/regenerate-packs', requireAdmin, async (req, res) => {
  try {
    const { force } = req.body || {}
    const result = await regenerateAllPacks({ force: !!force })
    return res.json({
      ok: true,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      packVersion: PACK_VERSION,
    })
  } catch (err) {
    console.error('Regenerate packs error:', err)
    return res.status(500).json({ error: err?.message || 'Regeneration failed' })
  }
})

app.post('/api/challenges', (req, res) => {
  try {
    const {
      title,
      problemStatement,
      scaleAssumptions,
      functionalText,
      nonFunctionalText,
      constraintsText,
      notesText,
    } = req.body || {}
    if (!title?.trim()) return res.status(400).json({ error: 'title required' })
    if (!problemStatement?.trim()) return res.status(400).json({ error: 'problemStatement required' })
    if (!functionalText?.trim()) return res.status(400).json({ error: 'functionalText required' })
    if (!nonFunctionalText?.trim()) return res.status(400).json({ error: 'nonFunctionalText required' })

    const slug = String(title).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40)
    const id = `custom-${Date.now()}-${slug || 'challenge'}`

    const pack = {
      id,
      title: title.trim(),
      source: 'user',
      createdAt: new Date().toISOString(),
      shortDescription: problemStatement.trim(),
      functionalRequirements: functionalText.trim().split('\n').filter(Boolean).map((s) => s.trim()),
      nonFunctionalRequirements: nonFunctionalText.trim().split('\n').filter(Boolean).map((s) => s.trim()),
      rawSectionText: [problemStatement, scaleAssumptions, functionalText, nonFunctionalText, constraintsText, notesText].filter(Boolean).join('\n\n'),
      input: {
        problemStatement: problemStatement.trim(),
        scaleAssumptions: (scaleAssumptions || '').trim() || undefined,
        functionalText: functionalText.trim(),
        nonFunctionalText: nonFunctionalText.trim(),
        constraintsText: (constraintsText || '').trim() || undefined,
        notesText: (notesText || '').trim() || undefined,
      },
    }
    savePack(pack)
    return res.json(pack)
  } catch (err) {
    console.error('POST /api/challenges error:', err)
    return res.status(500).json({ error: err?.message || 'Failed to save challenge' })
  }
})

app.post('/generate', (req, res) => {
  res.json({
    nodes: ['Client', 'Load Balancer', 'App Server', 'Database'],
    edges: [
      { source: 'Client', target: 'Load Balancer' },
      { source: 'Load Balancer', target: 'App Server' },
      { source: 'App Server', target: 'Database' },
    ],
  })
})

// 404 and error handlers return JSON (avoid "Unexpected token '<'" from HTML)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', details: `${req.method} ${req.path}` })
})

app.use((err, req, res, next) => {
  console.error('Server error:', err?.message || err)
  res.status(err?.status || 500).json({ error: err?.message || 'Internal server error', details: err?.stack || '' })
})

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`
Port ${PORT} is already in use. To fix:
  1. Find the process: lsof -i :${PORT}
  2. Kill it: kill -9 <pid>
  3. Restart the server
`)
  }
  throw err
})
