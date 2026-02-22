#!/usr/bin/env node
/**
 * Validate CreatorAgent outputs and starter packs conform to schema and one-liner limits.
 * Run: node server/ai/testCreatorPacks.js
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { validateQuestionPack, validateQuestionPackConstraints } from './schemas/questionPack.js'
import { formatPack, createFromText } from './agents/CreatorAgent.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PACKS_DIR = path.join(__dirname, '../data/packs')
const MAX_TITLE = 80
const MAX_ONELINER = 110

function loadAllPacks() {
  if (!fs.existsSync(PACKS_DIR)) return []
  return fs.readdirSync(PACKS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(PACKS_DIR, f), 'utf-8'))
      } catch (e) {
        return null
      }
    })
    .filter(Boolean)
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  console.log('=== Creator Pack Validation ===\n')

  // 1. Load and validate starter packs
  const packs = loadAllPacks()
  console.log(`Loaded ${packs.length} packs from ${PACKS_DIR}`)
  assert(packs.length >= 15, `Expected at least 15 packs, got ${packs.length}`)

  let pass = 0
  let fail = 0
  for (const raw of packs) {
    const pack = validateQuestionPack(raw)
    const errs = validateQuestionPackConstraints(pack)
    if (errs.length > 0) {
      console.log(`  ✗ ${pack.id}: ${errs.join('; ')}`)
      fail++
    } else {
      pass++
    }
    assert((pack.title || '').length <= MAX_TITLE, `${pack.id}: title exceeds ${MAX_TITLE}`)
    for (const s of pack.functionalRequirements || []) {
      assert((s || '').length <= MAX_ONELINER, `${pack.id}: FR item exceeds ${MAX_ONELINER}`)
    }
    for (const s of pack.nonFunctionalRequirements || []) {
      assert((s || '').length <= MAX_ONELINER, `${pack.id}: NFR item exceeds ${MAX_ONELINER}`)
    }
    if (pack.diagramSpec?.nodes) {
      assert(pack.diagramSpec.nodes.length >= 2, `${pack.id}: diagramSpec needs at least 2 nodes`)
    }
  }
  console.log(`  Pack validation: ${pass} pass, ${fail} fail\n`)

  // 2. formatOnly mode
  const messy = `
    Designing a URL Shortener. This is a very long paragraph that should be shortened.
    Functional Requirements: Shorten URL, Redirect, Custom alias, Expiration, Analytics.
    Non-Functional: 99.99% availability, p99 under 100ms, 10K redirects/sec.
  `
  const formatted = formatPack(messy)
  assert(formatted.title?.length <= MAX_TITLE, 'formatPack: title too long')
  assert(Array.isArray(formatted.functionalRequirements), 'formatPack: FR must be array')
  assert(Array.isArray(formatted.nonFunctionalRequirements), 'formatPack: NFR must be array')
  for (const s of formatted.functionalRequirements || []) {
    assert((s || '').length <= MAX_ONELINER, 'formatPack: FR item too long')
  }
  console.log('  formatPack: OK (one-liners enforced)\n')

  // 3. createFromText heuristic
  const created = await createFromText('Design a Cache. Read-heavy. TTL. Invalidation.')
  assert(created.id, 'createFromText: needs id')
  assert(created.title?.length <= MAX_TITLE, 'createFromText: title too long')
  assert((created.functionalRequirements || []).length >= 1, 'createFromText: needs FR')
  assert((created.nonFunctionalRequirements || []).length >= 1, 'createFromText: needs NFR')
  console.log('  createFromText: OK\n')

  console.log('=== All tests passed ===')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
