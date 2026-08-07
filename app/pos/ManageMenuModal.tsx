'use client'

import { useState } from 'react'

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
  onCategoryAdded: (cat: DynamicCategory) => void
  onCategoryDeleted: (sanityId: string) => void
}

export default function ManageMenuModal({
  categories,
  onClose,
  onCategoryAdded,
  onCategoryDeleted,
}: ManageMenuModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 bg-white border border-foreground/12 w-full max-w-md rounded-sm shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/10 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/60 font-semibold">Manage Categories</p>
          <button
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground text-2xl leading-none w-8 h-8 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <CategoriesTab
            categories={categories}
            onAdded={onCategoryAdded}
            onDeleted={onCategoryDeleted}
          />
        </div>

      </div>
    </div>
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
