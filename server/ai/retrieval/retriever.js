/**
 * Corpus retriever with TF-IDF. No external dependencies.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CORPUS_DIR = path.join(__dirname, '../corpus')
const INDEX_PATH = path.join(CORPUS_DIR, 'index.json')
const CHUNKS_PATH = path.join(CORPUS_DIR, 'chunks.json')

let indexCache = null
let chunksCache = null
let invertedIndex = null

function loadIndex() {
  if (indexCache) return indexCache
  if (!fs.existsSync(INDEX_PATH)) return { docs: [] }
  indexCache = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))
  return indexCache
}

function loadChunks() {
  if (chunksCache) return chunksCache
  if (!fs.existsSync(CHUNKS_PATH)) return []
  chunksCache = JSON.parse(fs.readFileSync(CHUNKS_PATH, 'utf-8'))
  return chunksCache
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
}

/**
 * Build inverted index: term -> [{ chunkIdx, tf }]
 * Also compute docFreq: term -> number of chunks containing it
 */
function buildInvertedIndex() {
  if (invertedIndex) return invertedIndex
  const chunks = loadChunks()
  const index = new Map()
  const docFreq = new Map()

  for (let i = 0; i < chunks.length; i++) {
    const tokens = chunks[i].tokens || tokenize(chunks[i].text)
    const tf = new Map()
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1)
    }
    for (const [t, count] of tf) {
      if (!index.has(t)) index.set(t, [])
      index.get(t).push({ chunkIdx: i, tf: count })
      docFreq.set(t, (docFreq.get(t) || 0) + 1)
    }
  }
  invertedIndex = { index, docFreq, chunks }
  return invertedIndex
}

function extractSnippet(text, queryTokens, maxParagraphs = 3) {
  const paras = text.split(/\n\n+/).filter((p) => p.trim())
  if (paras.length === 0) return text.slice(0, 300)
  const qSet = new Set(queryTokens.map((t) => t.toLowerCase()))
  const scored = paras.map((p) => {
    const pt = tokenize(p)
    let hits = 0
    for (const t of pt) if (qSet.has(t)) hits++
    return { p, hits }
  })
  scored.sort((a, b) => b.hits - a.hits)
  return scored
    .slice(0, maxParagraphs)
    .map((s) => s.p)
    .join('\n\n')
    .slice(0, 500)
}

/**
 * Query corpus. Returns top K results.
 * @param {string} text - Query
 * @param {number} topK - Number of results
 * @returns {Array<{title, tags, snippet, content, score}>}
 */
export function query(text, topK = 6) {
  const idx = loadIndex()
  const docMap = new Map((idx.docs || []).map((d) => [d.id, d]))
  const { index, docFreq, chunks } = buildInvertedIndex()
  const qTokens = [...new Set(tokenize(text))]
  if (qTokens.length === 0) return []

  const N = chunks.length
  const scores = new Map()

  for (const t of qTokens) {
    const df = docFreq.get(t) || 1
    const idf = Math.log((N + 1) / df) + 1
    const posts = index.get(t) || []
    for (const { chunkIdx, tf } of posts) {
      const s = tf * idf
      scores.set(chunkIdx, (scores.get(chunkIdx) || 0) + s)
    }
  }

  const ranked = [...scores.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)

  return ranked.map(([chunkIdx, score]) => {
    const chunk = chunks[chunkIdx]
    const doc = docMap.get(chunk.docId) || {}
    return {
      title: doc.title || chunk.docId,
      tags: doc.tags || [],
      snippet: extractSnippet(chunk.text, qTokens),
      content: chunk.text,
      score,
    }
  })
}
