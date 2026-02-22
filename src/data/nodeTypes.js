export const NODE_TYPES = [
  { id: 'client', label: 'Client' },
  { id: 'load-balancer', label: 'Load Balancer' },
  { id: 'app-server', label: 'App Server' },
  { id: 'database', label: 'Database' },
  { id: 'cache', label: 'Cache' },
  { id: 'message-queue', label: 'Message Queue' },
  { id: 'cdn', label: 'CDN' },
  { id: 'object-storage', label: 'Object Storage' },
  { id: 'search-index', label: 'Search Index' },
]

export const NODE_DESCRIPTIONS = {
  client: 'User device making requests',
  'load-balancer': 'Distributes traffic across servers',
  'app-server': 'Handles business logic',
  database: 'Stores persistent data',
  cache: 'Stores frequently accessed data',
  'message-queue': 'Buffers and processes requests asynchronously',
  cdn: 'Serves static assets from edge locations',
  'object-storage': 'Stores blobs and files',
  'search-index': 'Full-text search capability',
}
