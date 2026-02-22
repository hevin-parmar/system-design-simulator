/**
 * Lightweight knowledge map for scoring and hints.
 * Maps component types to requirement tags they help satisfy.
 */
export const COMPONENT_RULES = {
  Client: {
    helps: ['ui', 'user'],
    typicalFor: ['all'],
    duplicates: ['Client'],
  },
  'Load Balancer': {
    helps: ['availability', 'scale', 'latency', 'throughput'],
    typicalFor: ['all'],
    duplicates: ['Load Balancer'],
  },
  'App Server': {
    helps: ['business logic', 'api', 'scale'],
    typicalFor: ['all'],
    duplicates: ['App Server'],
  },
  Database: {
    helps: ['persistence', 'storage', 'data'],
    typicalFor: ['all'],
    duplicates: ['Database'],
  },
  Cache: {
    helps: ['latency', 'read-heavy', 'hot data', 'performance'],
    typicalFor: ['timeline', 'feed', 'profile', 'session'],
    duplicates: ['Cache'],
  },
  CDN: {
    helps: ['static', 'media', 'latency', 'bandwidth'],
    typicalFor: ['media', 'static-assets'],
    duplicates: ['CDN'],
  },
  'Message Queue': {
    helps: ['async', 'decouple', 'spikes', 'retries', 'throughput'],
    typicalFor: ['async-processing', 'notification'],
    duplicates: ['Message Queue'],
  },
  'Search Index': {
    helps: ['search', 'full-text', 'autocomplete'],
    typicalFor: ['search', 'discovery'],
    duplicates: ['Search Index'],
  },
  'Object Storage': {
    helps: ['media storage', 'large files', 'blob', 'upload'],
    typicalFor: ['media', 'photos', 'videos'],
    duplicates: ['Object Storage'],
  },
  'Primary Database': { helps: ['persistence', 'writes'], typicalFor: ['all'], duplicates: ['Primary Database'] },
  'Replica Database': { helps: ['read', 'availability', 'scale'], typicalFor: ['all'], duplicates: ['Replica Database'] },
  'Shard 1': { helps: ['scale', 'sharding'], typicalFor: ['all'], duplicates: ['Shard 1', 'Shard 2'] },
  'Shard 2': { helps: ['scale', 'sharding'], typicalFor: ['all'], duplicates: ['Shard 1', 'Shard 2'] },
  Worker: { helps: ['async', 'processing'], typicalFor: ['async-processing'], duplicates: ['Worker'] },
  'API Gateway': { helps: ['auth', 'rate-limit', 'security'], typicalFor: ['all'], duplicates: ['API Gateway'] },
  'Auth Service': { helps: ['auth', 'security'], typicalFor: ['all'], duplicates: ['Auth Service'] },
  'Metrics Store': { helps: ['observability', 'monitoring'], typicalFor: ['all'], duplicates: ['Metrics Store'] },
  'Log Aggregator': { helps: ['observability', 'logging'], typicalFor: ['all'], duplicates: ['Log Aggregator'] },
  'Rate Limiter': { helps: ['throttle', 'security'], typicalFor: ['all'], duplicates: ['Rate Limiter'] },
  Shard: { helps: ['scale', 'sharding'], typicalFor: ['all'], duplicates: ['Shard'] },
  'Read Replica': { helps: ['read', 'availability'], typicalFor: ['all'], duplicates: ['Read Replica'] },
}

/** Keywords in requirement text -> tags */
const REQUIREMENT_TAG_MAP = [
  [/low\s*latency|fast|response\s*time|real-?time/i, 'latency'],
  [/high\s*availability|reliable|99\.9|fault\s*tolerant/i, 'availability'],
  [/search|full-?text|autocomplete/i, 'search'],
  [/upload|photos?|videos?|media|images?/i, 'media'],
  [/asynchronous|async|queue|spikes?|retries?|decouple/i, 'async'],
  [/scale|million|throughput|concurrent/i, 'scale'],
  [/static|assets?|cdn/i, 'static'],
  [/storage|persistent|data\s*durability/i, 'storage'],
  [/read-?heavy|hot\s*data|frequent\s*read/i, 'read-heavy'],
  [/write|insert|update/i, 'writes'],
  [/business\s*logic|api|service/i, 'business logic'],
  [/user|client|browser/i, 'user'],
]

export function getRequirementTags(text) {
  if (!text || typeof text !== 'string') return []
  const tags = new Set()
  for (const [re, tag] of REQUIREMENT_TAG_MAP) {
    if (re.test(text)) tags.add(tag)
  }
  return [...tags]
}

export function getComponentHelps(label) {
  const rule = COMPONENT_RULES[label]
  return rule?.helps ?? []
}

export function getDuplicateTypes(label) {
  const rule = COMPONENT_RULES[label]
  return rule?.duplicates ?? [label]
}
