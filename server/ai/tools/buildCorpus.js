#!/usr/bin/env node
/**
 * Build corpus chunks from docs.
 * Chunks by ## and ### headings; infers tags from section titles.
 * Output: corpus/build/chunks.json, chunks.jsonl, meta.json
 * Chunk fields: id, title, text, tags[], topic, component, source
 * Run: node server/ai/tools/buildCorpus.js
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CORPUS_DIR = path.join(__dirname, '../corpus')
const BUILD_DIR = path.join(CORPUS_DIR, 'build')
const INDEX_PATH = path.join(CORPUS_DIR, 'index.json')
const DOCS_DIR = path.join(CORPUS_DIR, 'docs')

const MIN_CHUNK_CHARS = 200
const MAX_CHUNK_CHARS = 900

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
  'these', 'those', 'it', 'its', 'as', 'if', 'when', 'than', 'because', 'while',
])

const DOC_ID_TO_TOPIC = {
  caching: 'caching', cache: 'caching',
  load_balancing: 'load-balancing', '04_load_balancing': 'load-balancing',
  databases: 'databases', '06_databases': 'databases',
  sharding: 'sharding', '07_sharding': 'sharding',
  messaging_queues: 'messaging', '08_messaging_queues': 'messaging',
  consistency: 'consistency', reliability: 'reliability',
  observability: 'observability', security: 'security',
  foundations: 'fundamentals', fundamentals: 'fundamentals',
  queues: 'messaging',
}

function inferTopicAndComponent(docId) {
  const base = String(docId).replace(/^\d+_/, '').toLowerCase().replace(/-/g, '_')
  const topic = DOC_ID_TO_TOPIC[base] || base.replace(/_/g, '-')
  const componentMap = { caching: 'cache', 'load-balancing': 'lb', databases: 'database', sharding: 'shard', messaging: 'queue' }
  const component = componentMap[topic] || 'default'
  return { topic, component }
}

function inferTagsFromTitle(title) {
  if (!title) return []
  const t = title.toLowerCase().replace(/[^\w\s-]/g, ' ').split(/\s+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w))
  return [...new Set(t)]
}

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}

function extractKeywords(text, maxKeywords = 12) {
  const tokens = tokenize(text).filter((t) => !STOPWORDS.has(t) && t.length >= 3)
  const freq = new Map()
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1)
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([t]) => t)
}

/** Split by ## and ### headings; returns { heading, subHeading?, text } for each chunk */
function splitByHeadings(content) {
  const sections = []
  const lines = content.split('\n')
  let current = []
  let currentH2 = ''
  let currentH3 = ''

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current.length) {
        sections.push({ heading: currentH2, subHeading: currentH3 || null, text: current.join('\n').trim() })
        current = []
        currentH3 = ''
      }
      currentH2 = line.replace(/^##\s+/, '').trim()
      current.push(line)
    } else if (line.startsWith('### ')) {
      if (current.length && currentH3) {
        sections.push({ heading: currentH2, subHeading: currentH3, text: current.join('\n').trim() })
        current = []
      }
      currentH3 = line.replace(/^###\s+/, '').trim()
      current.push(line)
    } else {
      current.push(line)
    }
  }
  if (current.length) sections.push({ heading: currentH2, subHeading: currentH3 || null, text: current.join('\n').trim() })
  return sections
}

function splitLongSection(text, maxChars = MAX_CHUNK_CHARS) {
  const chunks = []
  const paras = text.split(/\n\n+/).filter((p) => p.trim())
  let current = []
  let currentLen = 0

  for (const p of paras) {
    const pLen = p.length + 2
    if (currentLen + pLen > maxChars && current.length > 0) {
      chunks.push(current.join('\n\n'))
      current = [p]
      currentLen = pLen
    } else {
      current.push(p)
      currentLen += pLen
    }
  }
  if (current.length) chunks.push(current.join('\n\n'))
  return chunks
}

function splitIntoChunks(content) {
  const sections = splitByHeadings(content)
  const result = []
  for (const { heading, subHeading, text } of sections) {
    if (!text.trim()) continue
    const displayHeading = subHeading ? `${heading}: ${subHeading}` : heading
    if (text.length <= MAX_CHUNK_CHARS) {
      result.push({ heading: displayHeading, text })
    } else {
      const subChunks = splitLongSection(text)
      for (const t of subChunks) result.push({ heading: displayHeading, text: t })
    }
  }
  return result.filter((c) => c.text.trim().length >= MIN_CHUNK_CHARS || c.text.trim().length > 0)
}

function buildCorpus() {
  let index = { docs: [] }
  if (fs.existsSync(INDEX_PATH)) {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))
  }
  const docs = index.docs || []
  const allMdFiles = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))
  const docIdsFromFs = new Set(allMdFiles.map((f) => f.replace(/\.md$/, '')))
  const docSet = new Map(docs.map((d) => [d.id, d]))
  for (const id of docIdsFromFs) {
    if (!docSet.has(id)) docSet.set(id, { id, title: id.replace(/^\d+_/, '').replace(/_/g, ' '), tags: [] })
  }
  const allChunks = []
  const meta = { docs: [], totalChunks: 0 }

  for (const doc of docSet.values()) {
    const docPath = path.join(DOCS_DIR, `${doc.id}.md`)
    if (!fs.existsSync(docPath)) continue

    const content = fs.readFileSync(docPath, 'utf-8')
    const rawChunks = splitIntoChunks(content)
    const { topic, component } = inferTopicAndComponent(doc.id)
    const baseTags = [...(doc.tags || []), topic, component]
    let chunkIdx = 0

    for (const { heading, text } of rawChunks) {
      if (!text.trim()) continue
      chunkIdx++
      const id = `${doc.id}#${chunkIdx}`
      const keywords = extractKeywords(text)
      const headingTags = inferTagsFromTitle(heading)
      const tags = [...new Set([...baseTags, ...headingTags])]
      allChunks.push({
        id,
        title: heading || doc.title || doc.id,
        text,
        tags,
        topic,
        component,
        source: doc.id,
        docId: doc.id,
        keywords,
      })
    }

    meta.docs.push({
      id: doc.id,
      title: doc.title,
      chunkCount: chunkIdx,
    })
  }

  meta.totalChunks = allChunks.length
  fs.mkdirSync(BUILD_DIR, { recursive: true })
  fs.writeFileSync(path.join(BUILD_DIR, 'chunks.json'), JSON.stringify(allChunks, null, 2), 'utf-8')
  fs.writeFileSync(path.join(BUILD_DIR, 'chunks.jsonl'), allChunks.map((c) => JSON.stringify(c)).join('\n'), 'utf-8')
  fs.writeFileSync(path.join(BUILD_DIR, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')
  return allChunks
}

// CLI: run when executed directly (node buildCorpus.js)
if (process.argv[1]?.includes('buildCorpus')) {
  const chunks = buildCorpus()
  console.log(`Corpus built: ${chunks.length} chunks from ${chunks.reduce((s, c) => s.add(c.source || c.docId), new Set()).size} docs`)
  console.log(`Output: ${BUILD_DIR}/chunks.json, ${BUILD_DIR}/chunks.jsonl, ${BUILD_DIR}/meta.json`)
}

export { buildCorpus }
