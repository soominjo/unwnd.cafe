'use client'

import { useState } from 'react'
import type { MenuItem, MenuCategory } from './types'

export interface DynamicCategory {
  id: string
  label: string
  type: 'drink' | 'food'
  order: number
  isBuiltIn: boolean
  _sanityId?: string
}

interface ManageMenuModalProps {
  categories: DynamicCategory[]
  onClose: () => void
  onItemAdded: (item: MenuItem & { category: string }) => void
  onItemDeleted: (sanityId: string) => void
  onCategoryAdded: (cat: DynamicCategory) => void
  onCategoryDeleted: (sanityId: string) => void
  mergedMenu: MenuCategory[]
  hiddenBuiltInIds: string[]
  onHiddenItemsChanged: (ids: string[]) => void
}

type Tab = 'item' | 'category' | 'items'

const TAB_LABELS: Record<Tab, string> = {
  item:     'Add Item',
  category: 'Categories',
  items:    'All Items',
}

export default function ManageMenuModal({
  categories,
  onClose,
  onItemAdded,
  onItemDeleted,
  onCategoryAdded,
  onCategoryDeleted,
  mergedMenu,
  hiddenBuiltInIds,
  onHiddenItemsChanged,
}: ManageMenuModalProps) {
  const [tab, setTab] = useState<Tab>('item')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 bg-white border border-foreground/12 w-full max-w-md rounded-sm shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/10 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/60 font-semibold">Manage Menu</p>
          <button
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground text-2xl leading-none w-8 h-8 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-foreground/10 shrink-0">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                tab === t
                  ? 'text-foreground border-b-2 border-foreground'
                  : 'text-foreground/40 hover:text-foreground/60'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'item' && (
            <AddItemForm categories={categories} onAdded={onItemAdded} />
          )}
          {tab === 'category' && (
            <CategoriesTab
              categories={categories}
              onAdded={onCategoryAdded}
              onDeleted={onCategoryDeleted}
            />
          )}
          {tab === 'items' && (
            <AllItemsList
              mergedMenu={mergedMenu}
              hiddenBuiltInIds={hiddenBuiltInIds}
              onDeleteItem={onItemDeleted}
              onHiddenItemsChanged={onHiddenItemsChanged}
            />
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Add Item Form ────────────────────────────────────────────────────────────

function AddItemForm({
  categories,
  onAdded,
}: {
  categories: DynamicCategory[]
  onAdded: (item: MenuItem & { category: string }) => void
}) {
  const [selectedCat, setSelectedCat] = useState('')
  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [priceHot, setPriceHot] = useState('')
  const [priceIce, setPriceIce] = useState('')
  const [priceFixed, setPriceFixed] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const catType = categories.find((c) => c.id === selectedCat)?.type ?? null
  const isDrink = catType === 'drink'
  const isFood = catType === 'food'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedCat) { setError('Select a category.'); return }
    if (!name.trim()) { setError('Item name is required.'); return }

    const ph = priceHot !== '' ? parseFloat(priceHot) : null
    const pi = priceIce !== '' ? parseFloat(priceIce) : null
    const pf = priceFixed !== '' ? parseFloat(priceFixed) : null

    if (isDrink && ph === null && pi === null) { setError('Enter at least one price (hot or iced).'); return }
    if (isFood && (pf === null || isNaN(pf))) { setError('Enter a fixed price.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          subtitle: subtitle.trim() || undefined,
          category: selectedCat,
          priceHot: isDrink ? ph : null,
          priceIce: isDrink ? pi : null,
          priceFixed: isFood ? pf : null,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error ?? 'Failed to save.'); return }
      onAdded({
        id:        data.item._id,
        _sanityId: data.item._id,
        name:      data.item.name,
        subtitle:  data.item.subtitle ?? '',
        priceHot:  data.item.priceHot,
        priceIce:  data.item.priceIce,
        priceFixed: data.item.priceFixed,
        category:  selectedCat,
      })
      setName('')
      setSubtitle('')
      setPriceHot('')
      setPriceIce('')
      setPriceFixed('')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Category</label>
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="w-full border border-foreground/20 rounded-sm px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/50 bg-transparent"
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Brown Sugar Oat Latte"
          maxLength={80}
          className="w-full border border-foreground/20 rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 bg-transparent"
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Description (optional)</label>
        <input
          type="text"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Ingredients or short description"
          maxLength={200}
          className="w-full border border-foreground/20 rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 bg-transparent"
        />
      </div>

      {isDrink && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Hot Price (₱)</label>
            <input
              type="number"
              inputMode="numeric"
              value={priceHot}
              onChange={(e) => setPriceHot(e.target.value)}
              placeholder="—"
              min={0}
              className="w-full border border-foreground/20 rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 bg-transparent"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Ice Price (₱)</label>
            <input
              type="number"
              inputMode="numeric"
              value={priceIce}
              onChange={(e) => setPriceIce(e.target.value)}
              placeholder="—"
              min={0}
              className="w-full border border-foreground/20 rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 bg-transparent"
            />
          </div>
        </div>
      )}

      {isFood && (
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Price (₱)</label>
          <input
            type="number"
            inputMode="numeric"
            value={priceFixed}
            onChange={(e) => setPriceFixed(e.target.value)}
            placeholder="e.g. 150"
            min={0}
            className="w-full border border-foreground/20 rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 bg-transparent"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-foreground text-cream text-xs uppercase tracking-widest py-3 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving…' : 'Add Item'}
      </button>
    </form>
  )
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({
  categories,
  onAdded,
  onDeleted,
}: {
  categories: DynamicCategory[]
  onAdded: (cat: DynamicCategory) => void
  onDeleted: (sanityId: string) => void
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Add-form state
  const [label, setLabel] = useState('')
  const [type, setType]   = useState<'drink' | 'food'>('drink')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const previewId = label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  async function handleDelete(sanityId: string) {
    setDeleteError(null)
    setDeletingId(sanityId)
    try {
      const res  = await fetch(`/api/menu/categories/${sanityId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) { setDeleteError(data.error ?? 'Failed to delete.'); return }
      onDeleted(sanityId)
    } catch {
      setDeleteError('Network error. Try again.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddError(null)
    if (!label.trim()) { setAddError('Category label is required.'); return }
    setSaving(true)
    try {
      const res  = await fetch('/api/menu/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), type }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setAddError(data.error ?? 'Failed to save.'); return }
      onAdded(data.category)
      setLabel('')
      setType('drink')
    } catch {
      setAddError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-6 py-5 space-y-5">

      {/* Custom categories only — built-ins can't be deleted so they're not shown */}
      {(() => {
        const custom = categories.filter((c) => !c.isBuiltIn && c._sanityId)
        return (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/45 font-semibold">
              Custom Categories
            </p>
            {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
            {custom.length === 0 ? (
              <p className="text-xs text-foreground/35 py-1">No custom categories yet.</p>
            ) : (
              <div className="space-y-1.5">
                {custom.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-foreground">{cat.label}</span>
                      <span className="text-[10px] text-foreground/35 ml-1.5">{cat.type}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(cat._sanityId!)}
                      disabled={deletingId === cat._sanityId}
                      className="shrink-0 text-[10px] text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-0.5 rounded-sm transition-colors disabled:opacity-40"
                    >
                      {deletingId === cat._sanityId ? '…' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      <div className="border-t border-foreground/10" />

      {/* Add new category */}
      <form onSubmit={handleAdd} className="space-y-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/45 font-semibold">
          Add Category
        </p>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Frappe"
            maxLength={40}
            className="w-full border border-foreground/20 rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 bg-transparent"
          />
          {previewId && (
            <p className="text-[10px] text-foreground/35 mt-1">ID: <span className="font-mono">{previewId}</span></p>
          )}
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Type</label>
          <div className="flex gap-3">
            {(['drink', 'food'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="accent-foreground"
                />
                <span className="text-sm text-foreground capitalize">{t}</span>
              </label>
            ))}
          </div>
        </div>

        {addError && <p className="text-xs text-red-500 font-medium">{addError}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-foreground text-cream text-xs uppercase tracking-widest py-3 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Add Category'}
        </button>
      </form>

    </div>
  )
}

// ─── All Items List ───────────────────────────────────────────────────────────

const PAGE_SIZE = 10

function AllItemsList({
  mergedMenu,
  hiddenBuiltInIds,
  onDeleteItem,
  onHiddenItemsChanged,
}: {
  mergedMenu: MenuCategory[]
  hiddenBuiltInIds: string[]
  onDeleteItem: (sanityId: string) => void
  onHiddenItemsChanged: (ids: string[]) => void
}) {
  const [selectedCat, setSelectedCat] = useState(mergedMenu[0]?.id ?? '')
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [page, setPage]               = useState(0)

  // If the active category was removed, fall back to the first one
  const activeCat = mergedMenu.some((c) => c.id === selectedCat)
    ? selectedCat
    : (mergedMenu[0]?.id ?? '')

  const catItems     = mergedMenu.find((c) => c.id === activeCat)?.items ?? []
  const visibleItems = catItems.filter((i) => !hiddenBuiltInIds.includes(i.id))
  const hiddenItems  = catItems.filter((i) => !i._sanityId && hiddenBuiltInIds.includes(i.id))
  const combined     = [...visibleItems, ...hiddenItems]

  const totalPages = Math.ceil(combined.length / PAGE_SIZE)
  const paged      = combined.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleCatChange(catId: string) {
    setSelectedCat(catId)
    setPage(0)
  }

  async function handleDeleteSanityItem(sanityId: string) {
    setError(null)
    setDeletingId(sanityId)
    try {
      const res  = await fetch(`/api/menu/${sanityId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error ?? 'Failed to delete.'); return }
      onDeleteItem(sanityId)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleHideBuiltIn(itemId: string) {
    setError(null)
    setDeletingId(itemId)
    try {
      const res  = await fetch('/api/menu/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action: 'hide' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error ?? 'Failed to hide item.'); return }
      onHiddenItemsChanged(data.hiddenItemIds)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRestoreBuiltIn(itemId: string) {
    setError(null)
    setDeletingId(itemId)
    try {
      const res  = await fetch('/api/menu/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action: 'restore' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error ?? 'Failed to restore item.'); return }
      onHiddenItemsChanged(data.hiddenItemIds)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="px-6 py-5 space-y-4">

      {/* Category sub-tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {mergedMenu.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCatChange(cat.id)}
            className={`shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${
              activeCat === cat.id
                ? 'bg-foreground text-cream'
                : 'border border-foreground/20 text-foreground/55 hover:border-foreground/40 hover:text-foreground/80'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Items */}
      {paged.length === 0 ? (
        <p className="text-xs text-foreground/40 text-center py-4">No items in this category.</p>
      ) : (
        <div className="space-y-1.5">
          {paged.map((item) => {
            const isHidden = !item._sanityId && hiddenBuiltInIds.includes(item.id)
            const isBusy   = deletingId === (item._sanityId ?? item.id)
            return (
              <div
                key={item._sanityId ?? item.id}
                className={`flex items-center justify-between gap-2 ${isHidden ? 'opacity-40' : ''}`}
              >
                <div className="min-w-0">
                  <span className={`text-xs font-semibold text-foreground truncate ${isHidden ? 'line-through' : ''}`}>
                    {item.name}
                  </span>
                  {isHidden && (
                    <span className="text-[10px] text-foreground/35 ml-1.5">hidden</span>
                  )}
                </div>
                {item._sanityId ? (
                  <button
                    onClick={() => handleDeleteSanityItem(item._sanityId!)}
                    disabled={isBusy}
                    className="shrink-0 text-[10px] text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-0.5 rounded-sm transition-colors disabled:opacity-40"
                  >
                    {isBusy ? '…' : 'Delete'}
                  </button>
                ) : isHidden ? (
                  <button
                    onClick={() => handleRestoreBuiltIn(item.id)}
                    disabled={isBusy}
                    className="shrink-0 text-[10px] text-foreground/50 hover:text-foreground border border-foreground/20 hover:border-foreground/50 px-2 py-0.5 rounded-sm transition-colors disabled:opacity-40"
                  >
                    {isBusy ? '…' : 'Restore'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleHideBuiltIn(item.id)}
                    disabled={isBusy}
                    className="shrink-0 text-[10px] text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-0.5 rounded-sm transition-colors disabled:opacity-40"
                  >
                    {isBusy ? '…' : 'Delete'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-[10px] uppercase tracking-widest text-foreground/50 hover:text-foreground disabled:opacity-30 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-[10px] text-foreground/40">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-[10px] uppercase tracking-widest text-foreground/50 hover:text-foreground disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}

    </div>
  )
}
