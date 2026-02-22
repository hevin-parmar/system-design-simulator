/**
 * Load knowledge base for CreatorAgent.
 * ESM-compatible; uses fs/path/fileURLToPath.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COMPONENTS_PATH = path.join(__dirname, 'components.json')
const PATTERNS_PATH = path.join(__dirname, 'patterns.md')

let componentsCache = null
let patternsCache = null

/**
 * Reads components.json and returns array of components.
 * @returns {Array<object>} Component objects with id, name, category, purpose, etc.
 */
export function loadComponents() {
  if (componentsCache) return componentsCache
  try {
    const raw = fs.readFileSync(COMPONENTS_PATH, 'utf-8')
    const data = JSON.parse(raw)
    componentsCache = Array.isArray(data.components) ? data.components : []
  } catch (e) {
    console.warn('loadKnowledge: could not load components.json', e?.message)
    componentsCache = []
  }
  return componentsCache
}

/**
 * Reads patterns.md and returns the full markdown string.
 * @returns {string} Raw markdown content
 */
export function loadPatternsMarkdown() {
  if (patternsCache !== null) return patternsCache
  try {
    patternsCache = fs.readFileSync(PATTERNS_PATH, 'utf-8')
  } catch (e) {
    console.warn('loadKnowledge: could not load patterns.md', e?.message)
    patternsCache = ''
  }
  return patternsCache
}
