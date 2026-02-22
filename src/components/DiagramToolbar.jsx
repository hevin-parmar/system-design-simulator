function DiagramToolbar({
  onDeleteSelected,
  onAutoLayout,
  onReset,
  onUndo,
  canUndo,
  onOpenComponentStore,
}) {
  return (
    <div className="diagram-toolbar diagram-toolbar--secondary">
      <div className="diagram-toolbar__group">
        {onOpenComponentStore && (
          <button
            type="button"
            className="diagram-toolbar__btn diagram-toolbar__btn--primary"
            onClick={onOpenComponentStore}
            title="Component Store (⌘K)"
          >
            + Components
          </button>
        )}
        <button
          type="button"
          className="diagram-toolbar__btn"
          onClick={onDeleteSelected}
        >
          Delete Selected
        </button>
        <button
          type="button"
          className="diagram-toolbar__btn diagram-toolbar__btn--primary"
          onClick={onAutoLayout}
        >
          Auto-Layout
        </button>
        {canUndo && (
          <button
            type="button"
            className="diagram-toolbar__btn"
            onClick={onUndo}
            title="Undo last add/delete"
          >
            Undo
          </button>
        )}
        <button
          type="button"
          className="diagram-toolbar__btn"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export default DiagramToolbar
