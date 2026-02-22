/**
 * Canonical title normalization for packs/questions.
 * Single source of truth to prevent "Design Design Design a X" duplication.
 */

const MAX_TITLE = 80

/**
 * Normalize a design title to canonical form: "Design {topic}".
 * - Trims whitespace
 * - Strips repeated "Design"/"Designing" prefixes
 * - Collapses repeated words
 * - Adds exactly one "Design " prefix (unless already present)
 */
export function normalizeTitle(title) {
  if (!title || typeof title !== 'string') return 'System Design'
  let s = title.replace(/\s+/g, ' ').trim()
  if (!s) return 'System Design'
  s = s.replace(/^((?:Design|Designing)\s+)+/i, '')
  while (/[\s]+(?:Design|Designing)\s*$/i.test(s)) {
    s = s.replace(/[\s]+(?:Design|Designing)\s*$/i, '').trim()
  }
  s = s.replace(/\s+/g, ' ')
  s = s.replace(/(\b\w+\b)(?:\s+\1)+/gi, '$1')
  s = s.trim()
  if (!s) return 'System Design'
  if (!/^Design\s+/i.test(s)) s = `Design ${s}`
  return s.length > MAX_TITLE ? s.slice(0, MAX_TITLE - 1).trim() + '…' : s
}

/**
 * Derive stable pack id from normalized title.
 */
export function titleToPackId(title) {
  const normalized = normalizeTitle(title)
  const slug = normalized
    .toLowerCase()
    .replace(/^design\s+/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40)
  return `pack-${slug || 'untitled'}`
}
