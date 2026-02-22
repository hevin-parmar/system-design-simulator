/**
 * Interview session memory: in-memory + persisted via session object.
 * Keyed by sessionId; fallback single global if no id.
 * Tracks askedTopics[], lastQuestionId, mode, skillEstimate for no-repeat and dynamic behavior.
 */
const DEFAULT_SESSION = {
  askedHashes: [],
  askedTopics: [],
  lastTopics: [],
  lastQuestionId: '',
  difficulty: 1,
  userSkill: 0,
  skillEstimate: 0,
  mode: 'ASK',
  lastUserAnswer: '',
  lastActionSummary: '',
  lastQuestionHash: '',
  noOpJustifyAttempts: 0,
  coachFollowUpIndex: 0,
}

const MAX_TOPICS = 5
const DIFFICULTY_RANGE = [1, 5]

function clamp(min, max, val) {
  return Math.max(min, Math.min(max, val))
}

export function getOrInitSessionMemory(session) {
  const s = session || {}
  return {
    askedHashes: Array.isArray(s.askedHashes) ? s.askedHashes : [...DEFAULT_SESSION.askedHashes],
    askedTopics: Array.isArray(s.askedTopics) ? s.askedTopics : [...DEFAULT_SESSION.askedTopics],
    lastTopics: Array.isArray(s.lastTopics) ? s.lastTopics.slice(-MAX_TOPICS) : [...DEFAULT_SESSION.lastTopics],
    lastQuestionId: String(s.lastQuestionId ?? s.lastQuestionHash ?? ''),
    difficulty: clamp(1, 5, s.difficulty ?? DEFAULT_SESSION.difficulty),
    userSkill: s.userSkill ?? DEFAULT_SESSION.userSkill,
    skillEstimate: s.skillEstimate ?? s.userSkill ?? DEFAULT_SESSION.skillEstimate,
    mode: String(s.mode ?? DEFAULT_SESSION.mode),
    lastUserAnswer: String(s.lastUserAnswer ?? ''),
    lastActionSummary: String(s.lastActionSummary ?? ''),
    lastQuestionHash: String(s.lastQuestionHash ?? ''),
    noOpJustifyAttempts: (s.noOpJustifyAttempts ?? 0) | 0,
    coachFollowUpIndex: (s.coachFollowUpIndex ?? 0) | 0,
  }
}

export function updateUserSkill(mem, userAnswer) {
  const t = (userAnswer || '').trim()
  if (!t || t.length < 5) return mem

  let delta = 0
  if (/\d+\s*(ms|qps|%|ttl|replicas?|rpo|rto|seconds?|mb|gb)/i.test(t)) delta += 1
  if (/latency\s*vs|consistency\s*vs|cost\s*vs|tradeoff|trade-off/i.test(t)) delta += 1
  if (t.length < 20 || /\b(idk|dont know|don't know|not sure)\b/i.test(t)) delta -= 1

  const skill = mem.userSkill + delta
  const difficulty = clamp(1, 5, 1 + Math.floor(Math.max(0, skill) / 2))
  return { ...mem, userSkill: Math.max(0, skill), difficulty }
}

export function recordQuestion(mem, mainQuestion, topic) {
  const h = questionHash(mainQuestion)
  const asked = [...mem.askedHashes]
  if (!asked.includes(h)) asked.push(h)
  const askedTopics = [...(mem.askedTopics || []), topic].filter(Boolean).slice(-20)
  const topics = [...mem.lastTopics, topic].slice(-MAX_TOPICS)
  return { ...mem, askedHashes: asked, askedTopics, lastTopics: topics, lastQuestionHash: h, lastQuestionId: h }
}

export function questionHash(text) {
  const main = (text || '').split('\n')[0].trim().slice(0, 100)
  return main.toLowerCase().replace(/\s+/g, ' ')
}

export function wasAsked(mem, mainQuestion) {
  const h = questionHash(mainQuestion)
  return (mem.askedHashes || []).includes(h)
}

/** Check if we asked about this topic recently (for no-repeat). */
export function wasTopicAsked(mem, topic) {
  return (mem.askedTopics || []).slice(-10).includes(topic)
}

export function toPersistable(mem) {
  return {
    askedHashes: mem.askedHashes || [],
    askedTopics: mem.askedTopics || [],
    lastTopics: mem.lastTopics || [],
    lastQuestionId: mem.lastQuestionId ?? mem.lastQuestionHash ?? '',
    difficulty: mem.difficulty ?? 1,
    userSkill: mem.userSkill ?? 0,
    skillEstimate: mem.skillEstimate ?? mem.userSkill ?? 0,
    mode: mem.mode ?? 'ASK',
    lastUserAnswer: mem.lastUserAnswer ?? '',
    lastActionSummary: mem.lastActionSummary ?? '',
    lastQuestionHash: mem.lastQuestionHash ?? '',
    noOpJustifyAttempts: mem.noOpJustifyAttempts ?? 0,
    coachFollowUpIndex: mem.coachFollowUpIndex ?? 0,
  }
}
