const TITLE_MAX = 60

function truncate(str, max) {
  if (!str || str.length <= max) return str
  return str.slice(0, max).trim() + '…'
}

function QuestionSidebar({
  questions,
  selectedQuestion,
  onSelect,
  search,
  onSearchChange,
  hideTitle = false,
}) {
  const filtered = questions.filter((q) =>
    (q.title || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside className="question-sidebar">
      {!hideTitle && <h2 className="question-sidebar__title">Question Bank</h2>}
      <input
        type="text"
        className="question-sidebar__search"
        placeholder="Search questions..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="question-sidebar__list">
        {filtered.length === 0 ? (
          <div className="question-sidebar__empty">
            {questions.length === 0
              ? 'No questions yet. Use New Design to create one.'
              : 'No matches for your search.'}
          </div>
        ) : (
          filtered.map((q) => (
            <button
              key={q.id}
              type="button"
              className={`question-sidebar__item ${
                selectedQuestion?.id === q.id ? 'question-sidebar__item--active' : ''
              }`}
              onClick={() => onSelect(q)}
            >
              <span className="question-sidebar__item-title">
                {truncate(q.title, TITLE_MAX)}
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}

export default QuestionSidebar
