export const initialNodes = [
  {
    id: 'client',
    position: { x: 250, y: 0 },
    data: { label: 'Client', description: 'User device making requests' },
  },
  {
    id: 'load-balancer',
    position: { x: 250, y: 100 },
    data: { label: 'Load Balancer', description: 'Distributes traffic across servers' },
  },
  {
    id: 'app-server',
    position: { x: 250, y: 200 },
    data: { label: 'App Server', description: 'Handles business logic' },
  },
  {
    id: 'shard-1',
    position: { x: 150, y: 320 },
    data: {
      label: 'Shard 1',
      description: 'Stores subset of data (partitioned by user ID or hash).',
    },
  },
  {
    id: 'shard-2',
    position: { x: 350, y: 320 },
    data: {
      label: 'Shard 2',
      description: 'Stores another subset of data.',
    },
  },
  {
    id: 'message-queue',
    position: { x: 250, y: 360 },
    data: {
      label: 'Message Queue',
      description: 'Buffers and processes write requests asynchronously to prevent database overload.',
    },
  },
  {
    id: 'cache',
    position: { x: 250, y: 460 },
    data: {
      label: 'Cache',
      description: 'Stores frequently accessed data to reduce database load and latency.',
    },
  },
  {
    id: 'primary-database',
    position: { x: 200, y: 560 },
    data: { label: 'Primary Database', description: 'Handles writes.' },
  },
  {
    id: 'replica-database',
    position: { x: 400, y: 560 },
    data: { label: 'Replica Database', description: 'Handles read replication and failover.' },
  },
]

export const initialEdges = [
  { id: 'e-client-lb', source: 'client', target: 'load-balancer' },
  { id: 'e-lb-app', source: 'load-balancer', target: 'app-server' },
  { id: 'e-app-shard1', source: 'app-server', target: 'shard-1' },
  { id: 'e-app-shard2', source: 'app-server', target: 'shard-2' },
  { id: 'e-app-cache', source: 'app-server', target: 'cache' },
  { id: 'e-cache-shard1', source: 'cache', target: 'shard-1' },
  { id: 'e-cache-shard2', source: 'cache', target: 'shard-2' },
  { id: 'e-app-mq', source: 'app-server', target: 'message-queue', label: 'Write' },
  { id: 'e-mq-primary', source: 'message-queue', target: 'primary-database', label: 'Write' },
  { id: 'e-app-replica', source: 'app-server', target: 'replica-database', label: 'Read' },
  { id: 'e-shard1-primary', source: 'shard-1', target: 'primary-database', label: 'Write' },
  { id: 'e-shard2-primary', source: 'shard-2', target: 'primary-database', label: 'Write' },
  { id: 'e-primary-replica', source: 'primary-database', target: 'replica-database' },
]
