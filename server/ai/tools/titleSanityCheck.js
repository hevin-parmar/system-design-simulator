/**
 * Sanity check for pack title normalization and de-duplication.
 * Run: node server/ai/tools/titleSanityCheck.js
 */
import { normalizeTitle, titleToPackId } from '../../utils/titleUtils.js'
import { synthesize } from '../designSynthesizer.js'
import { readPacks, savePack } from '../../storage/index.js'

const TEST_TITLE = 'Design Design a Chat System Design Design'

function testNormalizeTitle() {
  const out = normalizeTitle(TEST_TITLE)
  const expected = 'Design a Chat System'
  const ok = out === expected
  console.log('1) normalizeTitle:')
  console.log(`   Input:  "${TEST_TITLE}"`)
  console.log(`   Output: "${out}"`)
  console.log(`   Expected: "${expected}"`)
  console.log(`   ${ok ? 'PASS' : 'FAIL'}\n`)
  return ok
}

function testStablePackId() {
  const id1 = titleToPackId(TEST_TITLE)
  const id2 = titleToPackId('Design a Chat System')
  const ok = id1 === id2
  console.log('2) titleToPackId (stable):')
  console.log(`   "${TEST_TITLE}" -> ${id1}`)
  console.log(`   "Design a Chat System" -> ${id2}`)
  console.log(`   Same id: ${ok ? 'PASS' : 'FAIL'}\n`)
  return ok
}

async function testNoDuplicatePacks() {
  const title = 'Design a Chat System'
  const pack1 = synthesize({
    title: 'Design Design a Chat System Design Design',
    problem: 'Test',
    functional: ['Send message'],
    nonFunctional: [],
    constraints: {},
  })
  const pack2 = synthesize({
    title: 'Design a Chat System',
    problem: 'Test',
    functional: ['Send message'],
    nonFunctional: [],
    constraints: {},
  })
  const sameId = pack1.id === pack2.id
  const sameTitle = pack1.title === pack2.title
  console.log('3) Generate twice -> same pack:')
  console.log(`   Pack1 id: ${pack1.id}, title: ${pack1.title}`)
  console.log(`   Pack2 id: ${pack2.id}, title: ${pack2.title}`)
  console.log(`   Same id: ${sameId ? 'PASS' : 'FAIL'}`)
  console.log(`   Same title: ${sameTitle ? 'PASS' : 'FAIL'}`)

  const before = readPacks().length
  savePack(pack1)
  const after1 = readPacks().length
  savePack(pack2)
  const after2 = readPacks().length
  const noNewEntry = after1 === after2
  console.log(`   Packs before: ${before}, after save1: ${after1}, after save2: ${after2}`)
  console.log(`   No duplicate entry: ${noNewEntry ? 'PASS' : 'FAIL'}\n`)
  return sameId && sameTitle && noNewEntry
}

async function run() {
  console.log('=== Title & Pack Sanity Check ===\n')
  const a = testNormalizeTitle()
  const b = testStablePackId()
  const c = await testNoDuplicatePacks()
  const all = a && b && c
  console.log(all ? 'All checks PASSED' : 'Some checks FAILED')
  process.exit(all ? 0 : 1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
