/**
 * QuestionPack persistence: server/data/packs/<id>.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PACKS_DIR = path.join(__dirname, '../data/packs')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

ensureDir(PACKS_DIR)

export function listPacks() {
  try {
    if (!fs.existsSync(PACKS_DIR)) return []
    const files = fs.readdirSync(PACKS_DIR).filter((f) => f.endsWith('.json'))
    return files.map((f) => {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(PACKS_DIR, f), 'utf-8'))
        return { id: p.id, title: p.title }
      } catch {
        return null
      }
    }).filter(Boolean)
  } catch {
    return []
  }
}

export function getPack(id) {
  const p = path.join(PACKS_DIR, `${id}.json`)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

export function savePack(pack) {
  ensureDir(PACKS_DIR)
  const id = pack.id || `pack-${Date.now()}`
  const file = path.join(PACKS_DIR, `${id}.json`)
  fs.writeFileSync(file, JSON.stringify({ ...pack, id }, null, 2), 'utf-8')
  return { ...pack, id }
}
