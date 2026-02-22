import { normalizeRequirements } from './normalizeRequirements'

/**
 * Process a question from API: store raw, run normalize, set cleaned.
 */
export function processQuestion(q) {
  if (!q) return q
  const funcRaw = q.functionalRequirementsRaw ?? q.functionalRequirements ?? []
  const nfRaw = q.nonFunctionalRequirementsRaw ?? q.nonFunctionalRequirements ?? []
  const rawArrays = {
    functional: Array.isArray(funcRaw) ? funcRaw : [funcRaw].filter(Boolean),
    nonFunctional: Array.isArray(nfRaw) ? nfRaw : [nfRaw].filter(Boolean),
  }
  const { functional, nonFunctional } = normalizeRequirements(rawArrays)
  return {
    ...q,
    functionalRequirementsRaw: rawArrays.functional,
    nonFunctionalRequirementsRaw: rawArrays.nonFunctional,
    functionalRequirements: functional,
    nonFunctionalRequirements: nonFunctional,
    rawSectionText: q.rawSectionText ?? '',
  }
}

export function processQuestions(questions) {
  return (questions || []).map(processQuestion)
}
