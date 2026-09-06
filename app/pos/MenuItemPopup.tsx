'use client'

import { useState } from 'react'
import type { MenuItem, AddonType } from './types'
import { ADDON_CATEGORY_ID } from './constants'

interface MenuItemPopupProps {
  categoryId: string
  categoryLabel: string
  categoryType: 'drink' | 'food'
  allCategories: { id: string; label: string }[]
  item?: MenuItem & { _sanityId: string }
  onSaved: (item: MenuItem & { category: string }) => void
  onClose: () => void
}

export default function MenuItemPopup({
  categoryId,
  categoryLabel,
  categoryType,
  allCategories,
  item,
  onSaved,
  onClose,
}: MenuItemPopupProps) {
  const isEdit = !!item
  const isAddon = categoryId === ADDON_CATEGORY_ID

  const [name, setName] = useState(item?.name ?? '')
  const [subtitle, setSubtitle] = useState(item?.subtitle ?? '')
  const [priceHot, setPriceHot] = useState(item?.priceHot != null ? String(item.priceHot) : '')
  const [priceIce, setPriceIce] = useState(item?.priceIce != null ? String(item.priceIce) : '')
  const [priceFixed, setPriceFixed] = useState(item?.priceFixed != null ? String(item.priceFixed) : '')
  const [addonType, setAddonType] = useState<AddonType>(item?.addonType ?? 'drink')
  const [hiddenFromPos, setHiddenFromPos] = useState(item?.hiddenFromPos ?? false)
  const [applicableCategories, setApplicableCategories] = useState<string[]>(item?.applicableCategories ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleApplicableCategory(id: string) {
    setApplicableCategories((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id])
  }

  const isDrink = categoryType === 'drink'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError('Item name is required.'); return }

    const ph = priceHot !== '' ? parseFloat(priceHot) : null
    const pi = priceIce !== '' ? parseFloat(priceIce) : null
    const pf = priceFixed !== '' ? parseFloat(priceFixed) : null

    if (isDrink && ph === null && pi === null) { setError('Enter at least one price (hot or cold).'); return }
    if (!isDrink && (pf === null || isNaN(pf))) { setError('Enter a price.'); return }

    setSaving(true)
    try {
      const res = await fetch(isEdit ? `/api/menu/${item._sanityId}` : '/api/menu', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          subtitle: subtitle.trim() || undefined,
          category: categoryId,
          priceHot: isDrink ? ph : null,
          priceIce: isDrink ? pi : null,
          priceFixed: isDrink ? null : pf,
          addonType: isAddon ? addonType : null,
          hiddenFromPos,
          applicableCategories: isAddon && applicableCategories.length > 0 ? applicableCategories : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error ?? 'Failed to save.'); return }
      onSaved({
        id:            data.item._id,
        _sanityId:     data.item._id,
        name:          data.item.name,
        subtitle:      data.item.subtitle ?? '',
        priceHot:      data.item.priceHot,
        priceIce:      data.item.priceIce,
        priceFixed:    data.item.priceFixed,
        addonType:     data.item.addonType ?? null,
        hiddenFromPos: data.item.hiddenFromPos ?? false,
        applicableCategories: data.item.applicableCategories ?? null,
        category:      categoryId,
      })
      onClose()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 bg-white border border-foreground/12 w-full max-w-sm rounded-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/60 font-semibold">{isEdit ? 'Edit Item' : 'New Item'}</p>
            <p className="text-xs text-foreground/40 mt-0.5">{categoryLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground text-2xl leading-none w-8 h-8 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brown Sugar Oat Latte"
              maxLength={80}
              autoFocus
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

          {isDrink ? (
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
                <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Cold Price (₱)</label>
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
          ) : (
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

          {isAddon && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Add-on Type</label>
              <div className="flex gap-3">
                {(['drink', 'food'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={t}
                      checked={addonType === t}
                      onChange={() => setAddonType(t)}
                      className="accent-foreground"
                    />
                    <span className="text-sm text-foreground capitalize">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {isAddon && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-foreground/55 font-semibold mb-1.5">Show for categories</label>
              <p className="text-[11px] text-foreground/40 mb-2">Leave all unchecked to show this add-on everywhere.</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {allCategories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applicableCategories.includes(c.id)}
                      onChange={() => toggleApplicableCategory(c.id)}
                      className="accent-foreground"
                    />
                    <span className="text-sm text-foreground">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={hiddenFromPos}
              onChange={(e) => setHiddenFromPos(e.target.checked)}
              className="accent-foreground mt-0.5"
            />
            <span className="text-xs text-foreground/70 leading-relaxed">
              Hide from POS ordering — stays visible on the customer-facing /menu page
            </span>
          </label>

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-foreground text-cream text-xs uppercase tracking-widest py-3 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </form>
      </div>
    </div>
  )
}
