/**
 * Regenerate question packs with current CreatorAgent + components knowledge.
 * Produces richer diagrams (edge/app/data/async/observability/security layers),
 * canonical component IDs, and node notes (what, why, defaults, risks).
 *
 * Run: node server/ai/tools/regeneratePacks.js
 * Or via POST /api/admin/regenerate-packs
 */
import { readPacks, writePackToDir, isPackStale, PACK_VERSION } from '../../storage/index.js'
import { synthesize } from '../designSynthesizer.js'
import { validateQuestionPack } from '../schemas/questionPack.js'

/**
 * Extract constraints from pack NFRs/constraints for synthesize.
 */
function extractConstraints(pack) {
  const nfr = (pack.nonFunctionalRequirements || []).join(' ')
  const cs = pack.constraintsAssumptions || pack.constraints || []
  const all = [nfr, ...cs].join(' ')
  const rps = all.match(/(\d+)\s*(?:k|K)?\s*(?:qps|rps|requests?\/sec)/i)?.[0] || ''
  const storage = all.match(/(\d+)\s*(?:TB|GB|PB|records)/i)?.[0] || ''
  const latency = all.match(/(?:p99|latency)[^\d]*(\d+)\s*ms/i)?.[0] || all.match(/\d+\s*ms/i)?.[0] || ''
  const availability = all.match(/\d+(?:\.\d+)?%/)?.find((m) => parseFloat(m) >= 99) || ''
  return { traffic: rps || undefined, storage: storage || undefined, latency: latency || undefined, availability: availability || undefined }
}

/**
 * Regenerate a single pack using CreatorAgent/synthesize.
 */
function regeneratePack(pack) {
  const functional = pack.functionalRequirements || []
  const nonFunctional = pack.nonFunctionalRequirements || []
  const constraints = extractConstraints(pack)
  const rawTitle = pack.title || pack.id
  const title = typeof rawTitle === 'string' ? rawTitle.replace(/^Design(ing)?\s+/i, '').trim() || rawTitle : rawTitle
  const synthesized = synthesize({
    title: title || pack.id,
    problem: pack.problemStatement || pack.problem || '',
    functional: Array.isArray(functional) ? functional : [],
    nonFunctional: Array.isArray(nonFunctional) ? nonFunctional : [],
    constraints,
  })
  let finalTitle = pack.title || synthesized.title
  if (typeof finalTitle === 'string' && /^Design(ing)?\s+Design(ing)?\s+/i.test(finalTitle)) {
    finalTitle = finalTitle.replace(/^Design(ing)?\s+/i, '')
  }
  const merged = {
    ...pack,
    id: pack.id,
    title: finalTitle,
    problemStatement: synthesized.problemStatement || pack.problemStatement,
    functionalRequirements: synthesized.functionalRequirements || pack.functionalRequirements,
    nonFunctionalRequirements: synthesized.nonFunctionalRequirements || pack.nonFunctionalRequirements,
    constraintsAssumptions: synthesized.constraintsAssumptions ?? pack.constraintsAssumptions,
    diagramSpec: synthesized.diagramSpec,
    validation: synthesized.validation,
    qualityReport: synthesized.qualityReport,
    apiSketch: synthesized.apiSketch ?? pack.apiSketch,
    dataModel: synthesized.dataModel ?? pack.dataModel,
    scoringRubric: pack.scoringRubric,
    antiPatterns: pack.antiPatterns,
    starterHints: pack.starterHints,
  }
  const validated = validateQuestionPack(merged)
  return { ...validated, packVersion: PACK_VERSION }
}

/**
 * Regenerate all packs. Returns { updated, skipped, errors }.
 */
export async function regenerateAllPacks(options = {}) {
  const { force = false } = options
  const packs = readPacks()
  const result = { updated: 0, skipped: 0, errors: [] }
  for (const pack of packs) {
    const id = pack?.id
    if (!id) {
      result.errors.push({ id: 'unknown', message: 'Pack missing id' })
      continue
    }
    if (!force && !isPackStale(pack)) {
      result.skipped++
      continue
    }
    try {
      const regenerated = regeneratePack(pack)
      writePackToDir(regenerated)
      result.updated++
    } catch (err) {
      result.errors.push({ id, message: err?.message || String(err) })
    }
  }
  return result
}

/**
 * CLI entry point.
 */
async function main() {
  const force = process.argv.includes('--force')
  console.log(`Regenerating packs (PACK_VERSION=${PACK_VERSION}, force=${force})...`)
  const result = await regenerateAllPacks({ force })
  console.log(`Updated: ${result.updated}, Skipped: ${result.skipped}`)
  if (result.errors.length) console.error('Errors:', result.errors)
}

if (process.argv[1]?.endsWith('regeneratePacks.js')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
