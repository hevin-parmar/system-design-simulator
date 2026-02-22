const MIN_BULLET_LENGTH = 6

/**
 * Clean requirement strings into bullet points.
 * - Split by ". " into multiple bullets
 * - Remove numbering prefixes (1., 2), -, *, etc.)
 * - Trim whitespace
 * - Remove duplicates (case-insensitive)
 * - Ignore bullets shorter than 6 characters
 */
export function cleanRequirementBullets(items) {
  if (!Array.isArray(items)) return []

  const stripPrefix = (s) =>
    String(s)
      .replace(/^[\s\-*•\u2022\u2023]+/, '')
      .replace(/^\(?\d+[).]\s*/, '')
      .replace(/^[a-z][).]\s*/i, '')
      .trim()

  const raw = items.flatMap((item) => {
    const trimmed = stripPrefix(item)
    if (!trimmed) return []
    return trimmed.split(/\.\s+/).map((s) => stripPrefix(s)).filter(Boolean)
  })

  const seen = new Set()
  return raw.filter((s) => {
    const cleaned = s.trim()
    if (cleaned.length < MIN_BULLET_LENGTH) return false
    const key = cleaned.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
