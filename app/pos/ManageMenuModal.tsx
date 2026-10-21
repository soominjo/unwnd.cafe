'use client'

import { useState } from 'react'
import { MAX_CATEGORY_LABEL, categoryIdFromLabel } from '@/lib/menuCategoryLabel'
import { deletePrompt, deleteTabUrl } from './categoryEdits'

export interface DynamicCategory {
  id: string
  label: string
  type: 'drink' | 'food'
  order: number
  _sanityId: string
}

interface ManageMenuModalProps {
  /** Every tab, in tab-bar order. */
  categories: DynamicCategory[]
  /** How many items each tab holds, by tab id. */
  itemCounts: Readonly<Record<string, number>>
  onClose: () => void
  onCategoryAdded: (tab: DynamicCategory) => void
  onCategoryRenamed: (tab: DynamicCategory) => void
  onCategoryDeleted: (tab: DynamicCategory) => void
}

export default function ManageMenuModal({
  categories,
  itemCounts,
  onClose,
  onCategoryAdded,
  onCategoryRenamed,
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
            itemCounts={itemCounts}
            onAdded={onCategoryAdded}
            onRenamed={onCategoryRenamed}
            onDeleted={onCategoryDeleted}
          />
        </div>

      </div>
    </div>
  )
}

// ─── One tab in the list ─────────────────────────────────────────────────────

type RowMode = 'view' | 'rename' | 'confirm'

interface CategoryRowProps {
  tab: DynamicCategory
  itemCount: number
  mode: RowMode
  busy: boolean
  onRename: () => void
  onDelete: () => void
  onCancel: () => void
  onSave: (label: string) => void
  onConfirmDelete: () => void
}

const ROW_BUTTON = 'shrink-0 text-[10px] px-2 py-0.5 rounded-sm border transition-colors disabled:opacity-40'

/** A tab with Rename and Delete; renaming edits its name in place, and Delete asks first. */
export function CategoryRow({ tab, itemCount, mode, busy, onRename, onDelete, onCancel, onSave, onConfirmDelete }: CategoryRowProps) {
  const [name, setName] = useState(tab.label)

  if (mode === 'rename') {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); onSave(name.trim()) }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_CATEGORY_LABEL}
          aria-label={`New name for ${tab.label}`}
          autoFocus
          className="min-w-0 flex-1 border border-foreground/20 rounded-sm px-2 py-1 text-xs text-foreground focus:outline-none focus:border-foreground/50 bg-transparent"
        />
        <button type="submit" disabled={busy || name.trim() === ''} className={`${ROW_BUTTON} border-foreground/30 text-foreground hover:border-foreground/60`}>Save</button>
        <button type="button" onClick={onCancel} disabled={busy} className={`${ROW_BUTTON} border-foreground/15 text-foreground/55 hover:text-foreground`}>Cancel</button>
      </form>
    )
  }

  if (mode === 'confirm') {
    const { question, loyaltyLine } = deletePrompt(tab, itemCount)
    return (
      <div role="alertdialog" aria-label={`Delete ${tab.label}`} className="space-y-1.5 rounded-sm border border-red-200 bg-red-50 px-3 py-2">
        <p className="text-xs font-semibold text-red-700">{question}</p>
        {loyaltyLine && <p className="text-[11px] text-red-700/80">{loyaltyLine}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onConfirmDelete} disabled={busy} className={`${ROW_BUTTON} border-red-400 bg-red-600 text-white hover:bg-red-700`}>
            {busy ? '…' : 'Delete'}
          </button>
          <button type="button" onClick={onCancel} disabled={busy} className={`${ROW_BUTTON} border-foreground/15 text-foreground/60 hover:text-foreground`}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="text-xs font-semibold text-foreground">{tab.label}</span>
        <span className="text-[10px] text-foreground/35 ml-1.5">{tab.type}</span>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" onClick={onRename} disabled={busy} className={`${ROW_BUTTON} border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/45`}>Rename</button>
        <button type="button" onClick={onDelete} disabled={busy} className={`${ROW_BUTTON} border-red-200 text-red-400 hover:text-red-600 hover:border-red-400`}>Delete</button>
      </div>
    </div>
  )
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({
  categories,
  itemCounts,
  onAdded,
  onRenamed,
  onDeleted,
}: {
  categories: DynamicCategory[]
  itemCounts: Readonly<Record<string, number>>
  onAdded: (tab: DynamicCategory) => void
  onRenamed: (tab: DynamicCategory) => void
  onDeleted: (tab: DynamicCategory) => void
}) {
  // The one tab being renamed or confirmed for delete, if any.
  const [editing, setEditing] = useState<{ id: string; mode: 'rename' | 'confirm' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  // Add-form state
  const [label, setLabel] = useState('')
  const [type, setType]   = useState<'drink' | 'food'>('drink')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const previewId = categoryIdFromLabel(label)

  function open(id: string, mode: 'rename' | 'confirm') {
    setRowError(null)
    setEditing({ id, mode })
  }

  // Sends one tab change; on success hands the result on and closes the row.
  async function send(tab: DynamicCategory, method: 'PATCH' | 'DELETE', body?: { label: string }) {
    setRowError(null)
    setBusy(true)
    try {
      const url = method === 'DELETE' ? deleteTabUrl(tab, itemCounts[tab.id] ?? 0) : `/api/menu/categories/${tab._sanityId}`
      const res  = await fetch(url, {
        method,
        ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setRowError(data.error ?? 'Could not save. Try again.'); return }
      if (method === 'PATCH') onRenamed(data.category)
      else onDeleted(tab)
      setEditing(null)
    } catch {
      setRowError('Network error. Try again.')
    } finally {
      setBusy(false)
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

      {/* Every tab: all are saved in Sanity, so each can be renamed or deleted */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/45 font-semibold">
          Categories
        </p>
        {rowError && <p className="text-xs text-red-500">{rowError}</p>}
        {categories.length === 0 ? (
          <p className="text-xs text-foreground/35 py-1">No categories yet.</p>
        ) : (
          <div className="space-y-1.5">
            {categories.map((tab) => (
              <CategoryRow
                key={tab.id}
                tab={tab}
                itemCount={itemCounts[tab.id] ?? 0}
                mode={editing?.id === tab.id ? editing.mode : 'view'}
                busy={busy}
                onRename={() => open(tab.id, 'rename')}
                onDelete={() => open(tab.id, 'confirm')}
                onCancel={() => setEditing(null)}
                onSave={(name) => void send(tab, 'PATCH', { label: name })}
                onConfirmDelete={() => void send(tab, 'DELETE')}
              />
            ))}
          </div>
        )}
      </div>

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
            maxLength={MAX_CATEGORY_LABEL}
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
