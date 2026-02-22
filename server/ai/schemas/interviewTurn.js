/**
 * Interview Turn contract: input and output schema for senior system design interviewer.
 */

export const VALID_INTENTS = ['clarify', 'drill_down', 'challenge', 'validate', 'next_topic', 'wrap_up']

/**
 * Validate and normalize Interview Turn input.
 */
export function validateTurnInput(obj) {
  const o = obj || {}
  return {
    questionPackSummary: {
      title: o.questionPackSummary?.title ?? o.title ?? '',
      problemStatement: o.questionPackSummary?.problemStatement ?? o.problemStatement ?? '',
      functionalRequirements: Array.isArray(o.questionPackSummary?.functionalRequirements) ? o.questionPackSummary.functionalRequirements : (o.functionalRequirements ?? []),
      nonFunctionalRequirements: Array.isArray(o.questionPackSummary?.nonFunctionalRequirements) ? o.questionPackSummary.nonFunctionalRequirements : (o.nonFunctionalRequirements ?? []),
    },
    diagramSnapshot: {
      nodes: Array.isArray(o.diagramSnapshot?.nodes) ? o.diagramSnapshot.nodes : (o.diagram?.nodes ?? o.nodes ?? []),
      edges: Array.isArray(o.diagramSnapshot?.edges) ? o.diagramSnapshot.edges : (o.diagram?.edges ?? o.edges ?? []),
      selectedNodeIds: Array.isArray(o.diagramSnapshot?.selectedNodeIds) ? o.diagramSnapshot.selectedNodeIds : [],
      highlightedIssues: Array.isArray(o.diagramSnapshot?.highlightedIssues) ? o.diagramSnapshot.highlightedIssues : [],
    },
    lastChangeEvent: o.lastChangeEvent || null,
    diagramChangeContext: o.diagramChangeContext || null,
    trafficLoad: typeof o.trafficLoad === 'number' ? o.trafficLoad : 1000,
    transcript: {
      lastTurns: Array.isArray(o.transcript?.lastTurns) ? o.transcript.lastTurns : (o.history ?? []).map((h) => ({ role: h.role, text: h.text || h.content })),
    },
  }
}

/**
 * Validate and normalize Interview Turn output.
 */
export function validateTurnOutput(obj) {
  const o = obj || {}
  const intent = VALID_INTENTS.includes(o.intent) ? o.intent : 'drill_down'
  return {
    interviewerMessage: typeof o.interviewerMessage === 'string' ? o.interviewerMessage : (o.question ?? o.questionText ?? ''),
    intent,
    target: {
      nodeIds: Array.isArray(o.target?.nodeIds) ? o.target.nodeIds : [],
      requirementTags: Array.isArray(o.target?.requirementTags) ? o.target.requirementTags : [],
    },
    evaluation: {
      answerQuality: typeof o.evaluation?.answerQuality === 'number' ? Math.min(5, Math.max(1, o.evaluation.answerQuality)) : 3,
      issues: Array.isArray(o.evaluation?.issues) ? o.evaluation.issues : [],
      missing: Array.isArray(o.evaluation?.missing) ? o.evaluation.missing : [],
    },
    nextActions: Array.isArray(o.nextActions) ? o.nextActions : [],
  }
}
