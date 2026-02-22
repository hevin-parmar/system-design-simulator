function NodeDetailsPanel({ node }) {
  if (!node) return null

  const { label, description } = node.data ?? {}

  return (
    <aside className="node-details-panel">
      <h2 className="node-details-panel__title">{label || 'Node'}</h2>
      {description && (
        <p className="node-details-panel__description">{description}</p>
      )}
    </aside>
  )
}

export default NodeDetailsPanel
