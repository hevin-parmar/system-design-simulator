import { NODE_TYPES } from '../data/nodeTypes'

function NodePalette({ onAddNode }) {
  return (
    <div className="node-palette">
      <span className="node-palette__label">Add node:</span>
      <div className="node-palette__list">
        {NODE_TYPES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="node-palette__item"
            onClick={() => onAddNode(id, label)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default NodePalette
