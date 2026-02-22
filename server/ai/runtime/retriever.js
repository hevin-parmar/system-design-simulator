/**
 * Offline corpus retriever. No external deps.
 * Loads from corpus/build/chunks.json.
 * Score: token overlap + keyword/tag/domain boost.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHUNKS_PATH = path.join(__dirname, '../corpus/build/chunks.json')

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
  'these', 'those', 'it', 'its', 'as', 'if', 'when', 'than', 'because', 'while', 'what',
  'how', 'why', 'where', 'which', 'who', 'user', 'ask', 'deep', 'followup',
])

const DOMAIN_KEYWORDS = {
  cache: ['cache', 'ttl', 'invalidation', 'stampede', 'write-through', 'write-back'],
  shard: ['shard', 'sharding', 'partition', 'hot-partition', 'resharding'],
  queue: ['queue', 'message', 'dlq', 'backpressure', 'idempotency', 'delivery'],
  'load-balancer': ['load', 'balancer', 'lb', 'l4', 'l7', 'health-check'],
  database: ['database', 'db', 'replication', 'primary', 'replica'],
}

let chunksCache = null

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
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

function getQueryDomain(queryTokens) {
  const q = new Set(queryTokens)
  for (const [domain, kws] of Object.entries(DOMAIN_KEYWORDS)) {
    if (kws.some((kw) => q.has(kw) || [...q].some((t) => t.includes(kw) || kw.includes(t)))) {
      return domain
    }
  }
  return null
}

function chunkInDomain(chunk, domain) {
  if (!domain) return false
  const kws = DOMAIN_KEYWORDS[domain] || []
  const chunkText = ((chunk.text || '') + ' ' + (chunk.tags || []).join(' ') + ' ' + (chunk.keywords || []).join(' ')).toLowerCase()
  return kws.some((kw) => chunkText.includes(kw))
}

/**
 * Retrieve top-k chunks for query.
 * @param {string} query - Search query
 * @param {object} opts - { k: 6 }
 * @returns {Array<{id, docId, title, tags, text, score}>}
 */
export function retrieve(query, opts = {}) {
  const k = opts.k ?? 6
  const chunks = loadChunks()
  if (chunks.length === 0) return []

  const qTokens = [...new Set(tokenize(query))]
  if (qTokens.length === 0) return []

  const qTagSet = new Set(qTokens)
  const qKwSet = new Set(qTokens)
  const domain = getQueryDomain(qTokens)

  const scored = chunks.map((chunk) => {
    const text = chunk.text || ''
    const tags = chunk.tags || []
    const keywords = chunk.keywords || []
    const chunkTokens = new Set(tokenize(text))
    const chunkTagSet = new Set(tags.map((t) => t.toLowerCase().replace(/-/g, ' ').split(/\s+/)).flat())
    const chunkKwSet = new Set((keywords || []).map((k) => k.toLowerCase()))

    let score = 0
    for (const t of qTokens) {
      if (chunkTokens.has(t)) score += 2
      if (chunkKwSet.has(t)) score += 6
      if (chunkTagSet.has(t) || tags.some((tag) => tag.toLowerCase().includes(t))) score += 4
    }
    if (domain && chunkInDomain(chunk, domain)) score += 8

    return { chunk, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ chunk, score }) => ({
      id: chunk.id,
      docId: chunk.docId,
      title: chunk.title,
      tags: chunk.tags || [],
      text: chunk.text,
      score,
    }))
}
