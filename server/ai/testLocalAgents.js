/**
 * Test local agents (Creator + Interviewer) without internet.
 * Run: node server/ai/testLocalAgents.js
 */
import { createFromText } from './agents/CreatorAgent.js'
import { getNextAction } from './agents/InterviewerAgent.js'
import { isConfigured } from './runtime/llamaRuntime.js'

function log(msg, data = null) {
  console.log('\n' + '─'.repeat(60))
  console.log(msg)
  if (data != null) {
    console.log(JSON.stringify(data, null, 2))
  }
  console.log('─'.repeat(60))
}

async function main() {
  console.log('\n=== Local AI Agents Test (no internet) ===\n')

  if (!isConfigured()) {
    console.log('⚠️  LLM runtime is NOT configured.')
    console.log('')
    console.log('   Configure ONE of:')
    console.log('   • LLAMA_SERVER_URL  - e.g. http://localhost:8080')
    console.log('   • LLAMA_BIN + MODEL_PATH - path to llama.cpp binary and model file')
    console.log('')
    console.log('   Both agents will use heuristic stubs until configured.')
    console.log('')
  } else {
    console.log('✓ LLM runtime is configured.')
  }

  // --- CreatorAgent ---
  const sampleText = `Designing a URL Shortener

Functional Requirements:
- Users can create short URLs from long URLs
- Redirect short URL to original
- Support 1 million daily requests

Non-Functional Requirements:
- Low latency under 200ms
- High availability 99.9%`

  log('1. CreatorAgent (createFromText)', null)
  try {
    const pack = await createFromText(sampleText)
    log('   CreatorAgent response:', {
      id: pack.id,
      title: pack.title,
      functionalRequirements: pack.functionalRequirements,
      suggestedNodes: pack.suggestedNodes?.length,
    })
    console.log('   ✓ CreatorAgent responded.\n')
  } catch (err) {
    console.log('   ✗ CreatorAgent error:', err.message)
  }

  // --- InterviewerAgent ---
  const samplePack = {
    id: 'test-pack',
    functionalRequirements: ['Shorten URLs', 'Redirect to original'],
    nonFunctionalRequirements: ['Low latency', 'High availability'],
    problemStatement: 'Design a URL shortener.',
  }
  const sampleGraph = {
    nodes: [
      { id: 'client', data: { label: 'Client' } },
      { id: 'lb', data: { label: 'Load Balancer' } },
      { id: 'app', data: { label: 'App Server' } },
      { id: 'db', data: { label: 'Database' } },
    ],
    edges: [],
  }

  log('2. InterviewerAgent (getNextAction)', null)
  try {
    const action = await getNextAction(
      samplePack,
      'requirements',
      'I would use a hash function to generate short codes.',
      sampleGraph,
      {},
      'Have you captured all requirements?'
    )
    log('   InterviewerAgent response:', {
      action: action.action,
      question: action.question,
      targetArea: action.targetArea,
    })
    console.log('   ✓ InterviewerAgent responded.\n')
  } catch (err) {
    console.log('   ✗ InterviewerAgent error:', err.message)
  }

  console.log('=== Test complete ===\n')
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
