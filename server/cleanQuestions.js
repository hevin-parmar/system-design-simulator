/**
 * Server-side requirement cleanup. Converts verbose PDF text into short one-liners.
 * Falls back to heuristic if OpenAI key missing or API fails.
 */

const MAX_FUNC = 10
const MAX_NF = 10
const MAX_CHARS = 110
const JUNK = /(what is|high level|database schema|capacity estimation|constraints|storage estimate|for details|take a look|sharding|partition|sql vs nosql)/i

function stripPrefix(s) {
  return String(s)
    .replace(/^[\s\-*•\u2022\u2023]+/, '')
    .replace(/^\(?\d+[).]\s*/, '')
    .replace(/^[a-z][).]\s*/i, '')
    .trim()
}

function compressOneLiner(s) {
  let t = stripPrefix(s).replace(/\s+/g, ' ').trim()
  if (!t || t.length < 8) return ''
  if (JUNK.test(t)) return ''
  if (t.length > MAX_CHARS) t = t.slice(0, MAX_CHARS - 1).trim() + '…'
  return t
}

function dedupeAndLimit(list, max) {
  const out = []
  const seen = new Set()
  for (const x of list || []) {
    const t = compressOneLiner(x)
    if (!t) continue
    const key = t.toLowerCase().replace(/\s+/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= max) break
  }
  return out
}

function extractShortDescription(sectionText) {
  if (!sectionText || typeof sectionText !== 'string') return ''
  const intro = sectionText
    .split(/(?:Functional|Non[-\s]*Functional)\s*Requirements?/i)[0]
    .trim()
  if (!intro || intro.length < 20) return ''
  const lines = intro.split(/[.\n]/).map((s) => s.trim()).filter(Boolean)
  const first = lines[0] || ''
  if (first.length > 200) return first.slice(0, 197) + '…'
  if (lines.length >= 2) return lines.slice(0, 2).join('. ')
  return first
}

/**
 * Heuristic cleanup: one-liners, dedupe, limit, shortDescription.
 */
function cleanQuestionHeuristic(q) {
  const func = dedupeAndLimit(q.functionalRequirements || [], MAX_FUNC)
  const nf = dedupeAndLimit(q.nonFunctionalRequirements || [], MAX_NF)
  const sectionText = q.rawSectionText || [q.functionalRequirements, q.nonFunctionalRequirements].flat().join('\n')
  const shortDescription = q.shortDescription || extractShortDescription(sectionText)
  return {
    ...q,
    shortDescription: shortDescription || '',
    functionalRequirements: func,
    nonFunctionalRequirements: nf,
  }
}

/**
 * Optional OpenAI cleanup. Returns null on failure.
 */
async function cleanQuestionWithOpenAI(q) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null

  try {
    const mod = await import('openai').catch(() => null)
    const OpenAI = mod?.default
    if (!OpenAI) return null
    const client = new OpenAI({ apiKey: key })
    const sectionText =
      q.rawSectionText ||
      `Functional: ${(q.functionalRequirements || []).join('\n')}\nNon-Functional: ${(q.nonFunctionalRequirements || []).join('\n')}`

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content:
            'Extract requirements from the given text. Return valid JSON only: { "shortDescription": "1-3 lines", "functionalRequirements": ["item1","item2"], "nonFunctionalRequirements": ["item1","item2"] }. Keep each item <= 110 chars. Max 10 functional, 10 non-functional.',
        },
        { role: 'user', content: sectionText.slice(0, 4000) },
      ],
    })

    const text = completion.choices?.[0]?.message?.content?.trim() || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    const func = (parsed.functionalRequirements || []).slice(0, MAX_FUNC)
    const nf = (parsed.nonFunctionalRequirements || []).slice(0, MAX_NF)
    const shortDescription = String(parsed.shortDescription || '').slice(0, 300)

    return {
      ...q,
      shortDescription,
      functionalRequirements: func,
      nonFunctionalRequirements: nf,
    }
  } catch (err) {
    console.warn('OpenAI cleanup failed, using heuristic:', err?.message || err)
    return null
  }
}

/**
 * Clean a single question. Tries OpenAI if key exists, else heuristic.
 */
export async function cleanQuestion(q) {
  const aiResult = await cleanQuestionWithOpenAI(q)
  if (aiResult) return aiResult
  return cleanQuestionHeuristic(q)
}

/**
 * Clean all questions. Runs in parallel but limits concurrency.
 */
export async function cleanQuestions(questions) {
  if (!Array.isArray(questions)) return []
  const results = await Promise.all(questions.map(cleanQuestion))
  return results
}
