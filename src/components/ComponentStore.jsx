/**
 * Component Store: searchable, categorized palette for adding diagram nodes.
 * Replaces hardcoded Add Node buttons.
 */
import { useState, useMemo } from 'react'
import {
  COMPONENT_REGISTRY,
  CATEGORIES,
  getComponentsByCategory,
  searchComponents,
} from '../data/componentRegistry'
import './ComponentStore.css'

function ComponentStore({ onAddNode, nodes }) {
  const [search, setSearch] = useState('')
  const [expandedCategory, setExpandedCategory] = useState('Compute')

  const filtered = useMemo(() => searchComponents(search), [search])
  const byCategory = useMemo(() => {
    const list = search ? filtered : COMPONENT_REGISTRY
    const map = {}
    for (const c of list) {
      const cat = c.category || 'Compute'
      if (!map[cat]) map[cat] = []
      map[cat].push(c)
    }
    return map
  }, [search, filtered])

  const handleAdd = (comp) => {
    const offset = (nodes?.length ?? 0) * 24
    const x = 280 + (offset % 200)
    const y = 200 + Math.floor(offset / 200) * 60
    onAddNode(comp.id, comp.label, { x, y })
  }

  return (
    <div className="component-store">
      <input
        type="search"
        className="component-store__search"
        placeholder="Search components…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="component-store__palette">
        {CATEGORIES.filter((cat) => (byCategory[cat.id] || []).length > 0).map((cat) => {
          const items = byCategory[cat.id] || []
          const isExpanded = expandedCategory === cat.id
          return (
            <div key={cat.id} className="component-store__category">
              <button
                type="button"
                className="component-store__category-header"
                onClick={() => setExpandedCategory(isExpanded ? '' : cat.id)}
              >
                {cat.label}
              </button>
              {(isExpanded || search) && (
                <div className="component-store__items">
                  {items.map((comp) => (
                    <button
                      key={comp.id}
                      type="button"
                      className="component-store__item"
                      onClick={() => handleAdd(comp)}
                      title={comp.purpose}
                    >
                      {comp.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ComponentStore
