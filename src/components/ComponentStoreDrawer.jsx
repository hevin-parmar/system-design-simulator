/**
 * Component Store: left-side drawer for adding diagram nodes.
 * Cmd/Ctrl+K opens. Categories: Compute, Storage, Caching, Messaging, Networking, Observability, Security.
 */
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  COMPONENT_REGISTRY,
  CATEGORIES,
  searchComponents,
} from '../data/componentRegistry'
import './ComponentStoreDrawer.css'

const ORDERED_CATS = ['Compute', 'Storage', 'Caching', 'Messaging', 'Networking', 'Observability', 'Security']

function ComponentStoreDrawer({ open, onClose, onAddNode, nodes }) {
  const [search, setSearch] = useState('')

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

  const handleAdd = useCallback((comp) => {
    const offset = (nodes?.length ?? 0) * 28
    const x = 280 + (offset % 220)
    const y = 180 + Math.floor(offset / 220) * 70
    onAddNode(comp.id, comp.label, { x, y })
  }, [nodes?.length, onAddNode])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  return (
    <>
      <div className="component-store-drawer__backdrop" onClick={() => onClose?.()} aria-hidden />
      <aside className="component-store-drawer" role="dialog" aria-label="Component Store">
        <div className="component-store-drawer__header">
          <h3>Component Store</h3>
          <button type="button" className="component-store-drawer__close" onClick={() => onClose?.()} aria-label="Close">×</button>
        </div>
        <input
          type="search"
          className="component-store-drawer__search"
          placeholder="Search components…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="component-store-drawer__palette">
          {ORDERED_CATS.filter((cat) => (byCategory[cat] || []).length > 0).map((cat) => {
            const items = byCategory[cat] || []
            return (
              <div key={cat} className="component-store-drawer__category">
                <div className="component-store-drawer__category-header">{cat}</div>
                <div className="component-store-drawer__items">
                  {items.map((comp) => (
                    <button
                      key={comp.id}
                      type="button"
                      className="component-store-drawer__item"
                      onClick={() => handleAdd(comp)}
                      title={comp.purpose}
                    >
                      <span className="component-store-drawer__item-name">{comp.label}</span>
                      <span className="component-store-drawer__item-purpose">{comp.purpose}</span>
                      {(comp.tags?.length) > 0 && (
                        <span className="component-store-drawer__item-tags">
                          {(comp.tags || []).slice(0, 3).join(', ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="component-store-drawer__hint">⌘K or Ctrl+K to toggle • Click to add</div>
      </aside>
    </>
  )
}

export default ComponentStoreDrawer
