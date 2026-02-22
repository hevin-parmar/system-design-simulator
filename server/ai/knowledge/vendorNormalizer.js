/**
 * VendorNormalizer: map vendor/product names to generic component ids.
 * Uses synonyms from components.json. Output contains ONLY generic terms.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COMPONENTS_PATH = path.join(__dirname, 'components.json')

let synonymMap = null

function loadSynonymMap() {
  if (synonymMap) return synonymMap
  try {
    const raw = fs.readFileSync(COMPONENTS_PATH, 'utf-8')
    const { components = [] } = JSON.parse(raw)
    synonymMap = new Map()
    const ids = components.map((c) => (c.id || '').toLowerCase()).filter(Boolean)
    for (const c of components) {
      const id = c.id
      if (id) synonymMap.set(id.toLowerCase(), id)
      for (const s of c.synonyms || []) {
        const key = String(s).toLowerCase().trim().replace(/\s+/g, ' ')
        if (!key || synonymMap.has(key)) continue
        if (ids.some((i) => i !== key && (i.startsWith(key + '-') || i.endsWith('-' + key) || i.includes('-' + key + '-')))) continue
        synonymMap.set(key, id)
      }
    }
    return synonymMap
  } catch (e) {
    console.warn('VendorNormalizer: could not load components.json', e?.message)
    synonymMap = new Map()
    return synonymMap
  }
}

/**
 * Normalize a single term (e.g. "Redis", "S3") to component id or null.
 */
export function normalizeTerm(term) {
  if (!term || typeof term !== 'string') return null
  const map = loadSynonymMap()
  const key = term.toLowerCase().trim()
  return map.get(key) || null
}

/**
 * Replace vendor names in text with generic component ids.
 * Scans for known synonyms and substitutes.
 * Alias: normalizeVendorTerms (same behavior).
 */
export function normalizeText(text) {
  return normalizeVendorTermsImpl(text)
}

/**
 * Replace vendor names in text with canonical component ids.
 * Skips synonyms that are substrings of component ids to avoid wrong replacements.
 */
export function normalizeVendorTerms(text) {
  return normalizeVendorTermsImpl(text)
}

function normalizeVendorTermsImpl(text) {
  if (!text || typeof text !== 'string') return text
  const map = loadSynonymMap()
  let out = text
  const sorted = [...map.entries()].sort((a, b) => b[0].length - a[0].length)
  for (const [synonym, id] of sorted) {
    const re = new RegExp(`\\b${escapeRe(synonym)}\\b`, 'gi')
    out = out.replace(re, id)
  }
  return out
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Normalize node ids in a diagram. If a node id matches a synonym, replace with component id.
 */
export function normalizeDiagram(diagram) {
  if (!diagram?.nodes) return diagram
  const map = loadSynonymMap()
  const idMap = {}
  const nodes = diagram.nodes.map((n) => {
    const rawId = (n.id || n.type || '').toLowerCase().trim()
    const normalized = map.get(rawId)
    const newId = normalized || n.id
    idMap[n.id] = newId
    return { ...n, id: newId }
  })
  const edges = (diagram.edges || []).map((e) => ({
    ...e,
    source: idMap[e.source] ?? e.source,
    target: idMap[e.target] ?? e.target,
  }))
  return { ...diagram, nodes, edges }
}
