const MAX_CHARS = 140
const IDEAL_CHARS = 110
const MAX_PER_SECTION = 10

const JUNK_PATTERNS = [
  /high\s*level\s*system\s*design/i,
  /database\s*schema/i,
  /capacity\s*estimation/i,
  /storage\s*estimation/i,
  /sharding|partition/i,
  /sql\s*vs\s*nosql|nosql\s*vs\s*sql/i,
  /schema\s*definition/i,
  /table\s*structure|column\s*def/i,
  /node\s*explanation|component\s*explanation/i,
  /^\d+\.\s/m,
]

const REQUIREMENT_STARTS = [
  /^users?\s+should/i,
  /^system\s+should/i,
  /^service\s+should/i,
  /^must\s+/i,
  /^should\s+/i,
]

const REQUIREMENT_VERBS = [
  'upload', 'view', 'search', 'follow', 'comment', 'like', 'message',
  'feed', 'notify', 'create', 'delete', 'edit', 'share', 'post', 'send',
]

const NF_KEYWORDS = [
  'availability', 'latency', 'durability', 'consistency',
  'scalability', 'reliability', 'throughput', 'performance',
]

const FILLER = /\b(should be able to|users? should|system should|the system should|that the|to be able to|in order to|so that|such that)\b/gi

function normalizeKey(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^\w]/g, '')
    .trim()
}

function isJunk(line) {
  const t = String(line).trim()
  if (t.length < 6) return true
  if (JUNK_PATTERNS.some((p) => p.test(t))) return true
  return false
}

function looksLikeRequirement(line) {
  const t = String(line).trim().toLowerCase()
  if (REQUIREMENT_STARTS.some((r) => r.test(t))) return true
  if (REQUIREMENT_VERBS.some((v) => t.includes(v))) return true
  return false
}

function isNonFunctional(line) {
  const t = String(line).trim().toLowerCase()
  return NF_KEYWORDS.some((k) => t.includes(k))
}

function compress(line) {
  let s = String(line)
    .replace(/^[\s\-*•\d.)]+/, '')
    .replace(FILLER, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return []

  let compressed = s
    .replace(/\b(users?|system|service)\s+(can|must|should)\s+/gi, '')
    .replace(/\b(be\s+able\s+to|to)\s+/gi, '')
    .replace(/\s+and\s+/gi, ', ')
    .replace(/\s+/g, ' ')
    .trim()

  if (compressed.length <= MAX_CHARS && compressed.length >= 6) {
    return [compressed]
  }

  const parts = []
  const segments = compressed.split(/[,;]/).map((x) => x.trim()).filter(Boolean)
  for (const seg of segments) {
    const short = seg.length > MAX_CHARS ? seg.slice(0, IDEAL_CHARS).replace(/\s+\S*$/, '') || seg.slice(0, MAX_CHARS) : seg
    if (short.length >= 6) parts.push(short)
  }
  if (parts.length === 0) {
    parts.push(compressed.slice(0, MAX_CHARS) + (compressed.length > MAX_CHARS ? '…' : ''))
  }
  return parts
}

function processSection(items, forNonFunctional = false) {
  const result = []
  const seen = new Set()
  const raw = Array.isArray(items) ? items : [String(items || '')]

  for (const item of raw) {
    const trimmed = String(item)
      .replace(/^[\s\-*•\d.)]+/, '')
      .trim()
    if (!trimmed || isJunk(trimmed)) continue

    const lines = trimmed.split(/\.\s+/).map((x) => x.trim()).filter(Boolean)

    for (const line of lines) {
      if (isJunk(line)) continue
      const isNF = isNonFunctional(line)
      if (forNonFunctional && !isNF) continue
      if (!forNonFunctional && isNF) continue
      if (!forNonFunctional && !looksLikeRequirement(line)) continue

      const compressed = compress(line)
      for (const c of compressed) {
        if (c.length < 6) continue
        const key = normalizeKey(c)
        if (seen.has(key)) continue
        seen.add(key)
        result.push(c.length > MAX_CHARS ? c.slice(0, MAX_CHARS) + '…' : c)
      }
    }
  }

  return result.slice(0, MAX_PER_SECTION)
}

/**
 * Normalize raw requirement text/arrays into short one-liners.
 * Accepts: { functional?, nonFunctional? } or rawSectionText string.
 */
export function normalizeRequirements(raw) {
  let funcRaw = []
  let nfRaw = []

  if (typeof raw === 'string' && raw.trim()) {
    const text = raw.trim()
    const funcMatch = text.match(/Functional\s*Requirements?\s*[:\-]?\s*([\s\S]*?)(?=Non-?Functional|$)/i)
    const nfMatch = text.match(/Non-?Functional\s*Requirements?\s*[:\-]?\s*([\s\S]*?)(?=Functional|$)/i)
    if (funcMatch) funcRaw = [funcMatch[1]]
    if (nfMatch) nfRaw = [nfMatch[1]]
    if (!funcMatch && !nfMatch) funcRaw = [text]
  } else if (raw && typeof raw === 'object') {
    funcRaw = Array.isArray(raw.functional) ? raw.functional : (raw.functional ? [raw.functional] : [])
    nfRaw = Array.isArray(raw.nonFunctional) ? raw.nonFunctional : (raw.nonFunctional ? [raw.nonFunctional] : [])
  }

  return {
    functional: processSection(funcRaw, false),
    nonFunctional: processSection(nfRaw, true),
  }
}
