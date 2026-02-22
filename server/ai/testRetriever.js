#!/usr/bin/env node
/**
 * Test retriever: run buildCorpus, query "cache ttl invalidation stampede", print top 3.
 * Run: node server/ai/testRetriever.js
 */
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { retrieve } from './runtime/retriever.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Run buildCorpus first
execSync('node server/ai/tools/buildCorpus.js', {
  cwd: path.join(__dirname, '../..'),
  stdio: 'pipe',
})

const query = 'cache ttl invalidation stampede'
const results = retrieve(query, { k: 6 })

console.log(`=== Retriever Test: "${query}" ===\n`)
console.log(`Top ${Math.min(3, results.length)} chunks:\n`)
for (let i = 0; i < Math.min(3, results.length); i++) {
  const r = results[i]
  const preview = (r.text || '').slice(0, 120).replace(/\n/g, ' ')
  console.log(`${i + 1}. ${r.id} (score: ${r.score})`)
  console.log(`   ${preview}...\n`)
}
if (results.length < 3) {
  console.warn('⚠ Expected at least 3 results')
} else {
  console.log('✓ Retriever OK')
}
