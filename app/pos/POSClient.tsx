'use client'

import { useState, useMemo, useCallback, memo, Fragment, useEffect } from 'react'
import Link from 'next/link'
import { MENU } from './menuData'
import { variantClass, groupOrderItems, addonLineId } from './utils'
import type {
  MenuItem,
  MenuCategory,
  OrderItem,
  Variant,
  Addon,
  DiscountLine,
  LineDiscountKind,
  LineDiscountScope,
} from './types'
import ManageMenuModal, { type DynamicCategory } from './ManageMenuModal'
import MenuItemPopup from './MenuItemPopup'
import CardActions from './CardActions'
import OrderReviewModal, { type CheckoutAction } from './OrderReviewModal'
import ReceiptPreviewModal from './ReceiptPreviewModal'
import ItemActionModal, { type ItemModalMode } from './ItemActionModal'
import ManagerPinModal from './ManagerPinModal'
import { watchIdle } from './watchIdle'
import { LockIcon, UnlockIcon } from './sales/icons'
import {
  DISCOUNT_KINDS,
  buildDiscountLines,
  totalDiscount,
  discountBadge,
  hasLineDiscount,
  pickLineDiscount,
} from './discounts'
import { buildSalePayload } from './salePayload'
import { postSale } from './postSale'
import { ADDON_CATEGORY_ID } from './constants'
import type { ReceiptBlock } from '@/lib/printer/receiptDocument'
import { buildCheckoutReceiptBlocks } from '@/lib/printer/receiptFromSale'
import type { PosMenu, PosMenuItem } from '@/lib/posMenu'

interface POSClientProps {
  /** The live menu, read on the server for this page load; null when it could not be read (the built-in menu shows). */
  initialMenu: PosMenu | null
}

/** Manager mode locks itself after this long with no tap or key press. */
const MANAGER_IDLE_LOCK_MS = 2 * 60 * 1000

export default function POSClient({ initialMenu }: POSClientProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [orderItems, setOrderItems]             = useState<OrderItem[]>([])
  const [showConfirm, setShowConfirm]           = useState(false)
  const [mobileDrawer, setMobileDrawer]         = useState(false)
  const [payment, setPayment]                   = useState<number | null>(null)
  const [customInput, setCustomInput]           = useState('')
  // Which checkout button is saving the sale, or null when none is.
  const [pendingAction, setPendingAction]       = useState<CheckoutAction | null>(null)
  const [submitError, setSubmitError]           = useState<string | null>(null)
  // The customer receipt of a sale just saved with "Complete + Print Receipt", previewed before printing.
  const [receiptBlocks, setReceiptBlocks]       = useState<ReceiptBlock[] | null>(null)
  const [notes, setNotes]                       = useState('')
  const [selectedLineId, setSelectedLineId]     = useState<string | null>(null)
  // The per-item modal (Customize / Add-ons / Discount): which line it is for and which
  // section it shows; null when closed. One at a time, opened from that line's buttons.
  const [itemModal, setItemModal]               = useState<{ lineId: string; mode: ItemModalMode } | null>(null)
  const [showManageMenu, setShowManageMenu]     = useState(false)
  // The menu as the server read it for this page load, then kept in step with edits made here.
  const [dynamicCategories, setDynamicCategories] = useState<DynamicCategory[]>(initialMenu?.categories ?? [])
  const [dynamicItems, setDynamicItems]         = useState<PosMenuItem[]>(initialMenu?.items ?? [])
  // Built-in items hidden from the POS; nothing on this page changes the list.
  const [hiddenBuiltInIds]                      = useState<string[]>(initialMenu?.hiddenItemIds ?? [])
  const [deletingItemId, setDeletingItemId]     = useState<string | null>(null)
  const [deleteError, setDeleteError]           = useState<string | null>(null)
  const [addItemCategory, setAddItemCategory]   = useState<string | null>(null)
  const [editingItem, setEditingItem]           = useState<{ item: MenuItem & { _sanityId: string }; categoryId: string } | null>(null)
  const [categoryOrder, setCategoryOrder]       = useState<string[]>(initialMenu?.categoryOrder ?? [])
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null)
  // Manager mode shows edit and delete on the menu items. It takes the POS PIN; Lock,
  // a reload, two idle minutes or the screen going off hide them again.
  const [managerUnlocked, setManagerUnlocked]   = useState(false)
  const [showManagerPin, setShowManagerPin]     = useState(false)

  // Locking also closes an item's edit form, so a form left open cannot be saved by someone else.
  const lockManager = useCallback(() => {
    setManagerUnlocked(false)
    setEditingItem(null)
  }, [])

  useEffect(() => {
    if (!managerUnlocked) return
    const stopWatching = watchIdle(window, MANAGER_IDLE_LOCK_MS, lockManager)
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') lockManager()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stopWatching()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [managerUnlocked, lockManager])

  // Close all modals when the page is restored from the browser's back-forward cache.
  // Without this, any overlay that was open before navigating away blocks all clicks.
  // Manager mode locks again too, the same as on a reload.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        setShowConfirm(false)
        setShowManageMenu(false)
        setMobileDrawer(false)
        setItemModal(null)
        setReceiptBlocks(null)
        setShowManagerPin(false)
        lockManager()
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [lockManager])

  const total = useMemo(
    () => orderItems.reduce((sum, i) => sum + i.price * i.qty, 0),
    [orderItems]
  )

  const itemCount = useMemo(
    () => orderItems.reduce((sum, i) => sum + i.qty, 0),
    [orderItems]
  )

  // One row per discount on each line — a single transaction can bundle several
  // customers' orders, each with its own PWD/Senior ID or Google review.
  const discountLines  = useMemo(() => buildDiscountLines(orderItems), [orderItems])
  const discountAmount = useMemo(() => totalDiscount(discountLines), [discountLines])
  const grandTotal     = useMemo(() => total - discountAmount, [total, discountAmount])

  const addItem = useCallback((item: MenuItem, variant: Variant | null, categoryId: string) => {
    const price =
      variant === 'ice' ? item.priceIce! :
      variant === 'hot' ? item.priceHot! :
      item.priceFixed!
    const lineId = `${item.id}__${variant ?? 'fixed'}`
    setOrderItems(prev => {
      const existing = prev.find(i => i.lineId === lineId)
      if (existing) {
        return prev.map(i => i.lineId === lineId ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { lineId, name: item.name, variant, price, qty: 1, categoryId }]
    })
    setSelectedLineId(lineId)
  }, [])

  // Attaches the add-on to the given line (the item whose Add-ons modal is open). With
  // no parent the add-on becomes its own standalone order line, rendered by OrderPanel's
  // "orphan add-ons" branch.
  function addAddon(addon: Addon, parentLineId: string | null) {
    const lineId = addonLineId(addon.id, parentLineId)
    setOrderItems(prev => {
      const existing = prev.find(i => i.lineId === lineId)
      if (existing) {
        return prev.map(i => i.lineId === lineId ? { ...i, qty: i.qty + 1 } : i)
      }
      return [
        ...prev,
        {
          lineId,
          name: addon.name,
          variant: null,
          price: addon.price,
          qty: 1,
          ...(parentLineId ? { parentLineId } : {}),
        },
      ]
    })
  }

  function adjustQty(lineId: string, delta: number) {
    const target = orderItems.find(i => i.lineId === lineId)
    const willRemove = target !== undefined && target.qty + delta <= 0
    setOrderItems(prev => {
      const trimmed = prev
        .map(i => i.lineId === lineId ? { ...i, qty: i.qty + delta } : i)
        .filter(i => i.qty > 0)
      return willRemove ? trimmed.filter(i => i.parentLineId !== lineId) : trimmed
    })
    if (willRemove && selectedLineId === lineId) setSelectedLineId(null)
    if (willRemove && itemModal?.lineId === lineId) setItemModal(null)
  }

  // A line's 📝 / + / % buttons open the per-item modal on that section for that exact
  // item — and select the line, so the panel highlights what the modal is editing.
  function openItemModal(lineId: string, mode: ItemModalMode) {
    setSelectedLineId(lineId)
    setItemModal({ lineId, mode })
  }

  // A chip tap on one line: the active chip again clears that kind, the other scope switches it,
  // the other kind stacks. The modal stays open so PWD and the review promo combine in two taps.
  function pickItemDiscount(lineId: string, kind: LineDiscountKind, scope: LineDiscountScope) {
    setOrderItems(prev => pickLineDiscount(prev, lineId, kind, scope))
  }

  function setItemNote(lineId: string, note: string) {
    setOrderItems(prev => prev.map(i => i.lineId === lineId ? { ...i, note: note.trim() || undefined } : i))
  }

  function clearOrder() {
    setOrderItems([])
    setShowConfirm(false)
    setMobileDrawer(false)
    setPayment(null)
    setCustomInput('')
    setSubmitError(null)
    setNotes('')
    setSelectedLineId(null)
    setItemModal(null)
  }

  async function completeSale(action: CheckoutAction) {
    if (pendingAction) return
    const payload = buildSalePayload({ items: orderItems, discountLines, subtotal: total, grandTotal, payment, notes })
    setPendingAction(action)
    setSubmitError(null)
    const result = await postSale(payload)
    setPendingAction(null)
    if (!result.ok) {
      setSubmitError(result.error)
      return
    }

    clearOrder()
    // Lets a Sales tab already open elsewhere pick up the new sale.
    const bc = new BroadcastChannel('pos-sales-update')
    bc.postMessage({ type: 'sale-completed' })
    bc.close()
    // With a receipt, its preview opens and the cashier stays here for the next
    // customer once it is printed or closed. A plain completion moves on to Sales
    // as a full page load, like the Sales link: an in-app navigation would let Back
    // bring this page back with the menu it was first loaded with.
    if (action === 'receipt') setReceiptBlocks(buildCheckoutReceiptBlocks(payload, new Date()))
    else window.location.assign('/pos/sales')
  }

  function handleSetPayment(amount: number | null, raw: string) {
    setPayment(amount)
    setCustomInput(raw)
  }

  function handleItemAdded(item: MenuItem & { category: string }) {
    setDynamicItems((prev) => [
      ...prev,
      {
        _id: item._sanityId!,
        name: item.name,
        subtitle: item.subtitle ?? null,
        category: item.category,
        priceHot: item.priceHot,
        priceIce: item.priceIce,
        priceFixed: item.priceFixed,
        addonType: item.addonType ?? null,
        hiddenFromPos: item.hiddenFromPos ?? false,
        applicableCategories: item.applicableCategories ?? null,
      },
    ])
    setActiveCategoryId(item.category)
  }

  function handleItemDeleted(sanityId: string) {
    setDynamicItems((prev) => prev.filter((i) => i._id !== sanityId))
  }

  function handleItemUpdated(item: MenuItem & { category: string }) {
    setDynamicItems((prev) => prev.map((i) => i._id === item._sanityId ? {
      _id: item._sanityId!,
      name: item.name,
      subtitle: item.subtitle ?? null,
      category: item.category,
      priceHot: item.priceHot,
      priceIce: item.priceIce,
      priceFixed: item.priceFixed,
      addonType: item.addonType ?? null,
      hiddenFromPos: item.hiddenFromPos ?? false,
      applicableCategories: item.applicableCategories ?? null,
    } : i))
  }

  // A menu item's edit (✎) and delete (×) buttons: only in manager mode, and only for
  // items stored in Sanity — the built-in ones have no record to edit or delete.
  function editItemAction(item: MenuItem, categoryId: string): (() => void) | undefined {
    const sanityId = item._sanityId
    if (!managerUnlocked || !sanityId) return undefined
    return () => setEditingItem({ item: { ...item, _sanityId: sanityId }, categoryId })
  }

  function deleteItemAction(item: MenuItem): (() => void) | undefined {
    const sanityId = item._sanityId
    if (!managerUnlocked || !sanityId) return undefined
    return () => handleDeleteItem(sanityId)
  }

  async function handleDeleteItem(sanityId: string) {
    setDeleteError(null)
    setDeletingItemId(sanityId)
    try {
      const res  = await fetch(`/api/menu/${sanityId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) { setDeleteError(data.error ?? 'Failed to delete item.'); return }
      handleItemDeleted(sanityId)
    } catch {
      setDeleteError('Network error. Try again.')
    } finally {
      setDeletingItemId(null)
    }
  }

  function handleCategoryAdded(cat: DynamicCategory) {
    setDynamicCategories((prev) => [...prev, cat].sort((a, b) => a.order - b.order))
  }

  function handleCategoryDeleted(sanityId: string) {
    setDynamicCategories((prev) => prev.filter((c) => c._sanityId !== sanityId))
    setActiveCategoryId(null)
  }

  async function persistCategoryOrder(order: string[]) {
    try {
      const res  = await fetch('/api/menu/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryOrder: order }),
      })
      const data = await res.json()
      if (data.success) setCategoryOrder(data.categoryOrder ?? order)
    } catch {
      // best-effort — tab order is still applied locally even if this fails
    }
  }

  function handleCategoryDrop(targetId: string) {
    const draggedId = draggedCategoryId
    setDraggedCategoryId(null)
    setDragOverCategoryId(null)
    if (!draggedId || draggedId === targetId) return

    const currentOrder = sortedMenu.map((c) => c.id)
    const next = currentOrder.filter((id) => id !== draggedId)
    const targetIndex = next.indexOf(targetId)
    next.splice(targetIndex, 0, draggedId)

    setCategoryOrder(next)
    persistCategoryOrder(next)
  }

  const mergedMenu = useMemo<MenuCategory[]>(() => {
    if (dynamicCategories.length === 0) {
      return MENU.map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => !hiddenBuiltInIds.includes(item.id)),
      }))
    }
    // Discard Sanity items that share a name with a hardcoded item but sit in a
    // different category — stale duplicates saved under the wrong tab.
    // A Sanity entry only replaces a hardcoded item when name AND category match.
    const hardcodedCategoryByName = new Map<string, string>()
    MENU.forEach((cat) => {
      cat.items.forEach((item) => {
        hardcodedCategoryByName.set(item.name.toLowerCase().trim(), cat.id)
      })
    })
    const validDynamicItems = dynamicItems.filter((i) => {
      const canonical = hardcodedCategoryByName.get(i.name.toLowerCase().trim())
      return canonical === undefined || i.category === canonical
    })
    const validSanityNames = new Set(validDynamicItems.map((i) => i.name.toLowerCase().trim()))

    return dynamicCategories.map((cat) => {
      const hardcoded = (MENU.find((m) => m.id === cat.id)?.items ?? [])
        .filter((item) => !hiddenBuiltInIds.includes(item.id))
      const sanityItems: MenuItem[] = validDynamicItems
        .filter((i) => i.category === cat.id)
        .map((i) => ({
          id: i._id,
          _sanityId: i._id,
          name: i.name,
          subtitle: i.subtitle ?? '',
          priceHot: i.priceHot,
          priceIce: i.priceIce,
          priceFixed: i.priceFixed,
          addonType: i.addonType,
          hiddenFromPos: i.hiddenFromPos ?? false,
          applicableCategories: i.applicableCategories ?? null,
        }))
      const uniqueHardcoded = hardcoded.filter(
        (item) => !validSanityNames.has(item.name.toLowerCase().trim())
      )
      return { id: cat.id, label: cat.label, items: [...uniqueHardcoded, ...sanityItems] }
    })
  }, [dynamicCategories, dynamicItems, hiddenBuiltInIds])

  // Reflects any saved drag-and-drop reorder of the category tabs. Categories
  // not yet in categoryOrder (new ones) keep their mergedMenu relative order,
  // appended at the end.
  const sortedMenu = useMemo<MenuCategory[]>(() => {
    if (categoryOrder.length === 0) return mergedMenu
    const orderIndex = new Map(categoryOrder.map((id, i) => [id, i]))
    return [...mergedMenu].sort((a, b) => {
      const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER
      const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER
      return ai - bi
    })
  }, [mergedMenu, categoryOrder])

  const category = sortedMenu.find((c) => c.id === activeCategoryId) ?? sortedMenu[0]

  const categoriesForModal = useMemo<DynamicCategory[]>(() => (
    dynamicCategories.length > 0
      ? dynamicCategories
      : MENU.map((m, i) => ({ id: m.id, label: m.label, type: (i < 3 ? 'drink' : 'food') as 'drink' | 'food', order: i + 1, isBuiltIn: true }))
  ), [dynamicCategories])

  // Items filed under the "Add ons" category are the attachable add-ons shown
  // in the per-item modal — not orderable menu items in their own right.
  // The 'addon__' id prefix is load-bearing: order-line detection elsewhere
  // (utils.ts isAddonLine — used by groupOrderItems and discounts.ts) matches it.
  // Smart-filtered for the item whose modal is open: only add-ons whose
  // `applicableCategories` includes that line's source category (or that have
  // no restriction set at all) are offered — narrows an 11-item add-on list
  // down to the handful relevant to the item. With no category known the full
  // list shows.
  const modalItem = useMemo(
    () => (itemModal ? orderItems.find((i) => i.lineId === itemModal.lineId) : undefined),
    [orderItems, itemModal]
  )
  const modalCategoryId = modalItem?.categoryId

  const addonAttachItems = useMemo<Addon[]>(() => {
    const addonCategory = mergedMenu.find((c) => c.id === ADDON_CATEGORY_ID)
    return (addonCategory?.items ?? [])
      .filter((i) => i.priceFixed !== null && !i.hiddenFromPos)
      .filter((i) => {
        if (!modalCategoryId) return true
        const restrictions = i.applicableCategories
        return !restrictions || restrictions.length === 0 || restrictions.includes(modalCategoryId)
      })
      .map((i) => ({
        id:        `addon__${i._sanityId ?? i.id}`,
        _sanityId: i._sanityId,
        name:      i.name,
        label:     `+${i.priceFixed} ${i.name}`,
        price:     i.priceFixed!,
        type:      i.addonType ?? null,
      }))
  }, [mergedMenu, modalCategoryId])

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden select-none">

      {/* ── Header ── */}
      <header className="bg-foreground flex items-center justify-between px-6 py-4 shrink-0">
        <Link href="/" className="font-logo text-2xl lowercase tracking-tight text-cream hover:text-cream/70 transition-colors">unwnd. pos</Link>
        <div className="flex items-center gap-4">
          {/* Manager mode: the PIN shows edit and delete on the menu items; tapping again locks them away */}
          <button
            onClick={() => (managerUnlocked ? lockManager() : setShowManagerPin(true))}
            aria-pressed={managerUnlocked}
            aria-label="Manager mode"
            title={managerUnlocked ? 'Lock: hide edit and delete on menu items' : 'Manager PIN: show edit and delete on menu items'}
            className={`h-9 px-3 flex items-center gap-2 rounded-full text-xs uppercase tracking-[0.2em] transition-colors ${
              managerUnlocked
                ? 'bg-amber-400 text-foreground font-bold hover:bg-amber-300'
                : 'text-cream/55 hover:text-cream/85 hover:bg-cream/10'
            }`}
          >
            {managerUnlocked ? <UnlockIcon width={14} height={14} /> : <LockIcon width={14} height={14} />}
            <span className="hidden sm:inline">{managerUnlocked ? 'Lock' : 'Manager'}</span>
          </button>
          <a
            href="/pos/sales"
            className="hidden lg:block text-xs uppercase tracking-[0.2em] text-cream/55 hover:text-cream/85 transition-colors"
          >
            Sales ↗
          </a>
          <button
            className="lg:hidden flex items-center gap-3 text-sm text-cream/85 hover:text-cream transition-colors py-2 px-4 border border-cream/30 rounded-sm"
            onClick={() => setMobileDrawer(true)}
          >
            {itemCount > 0 && (
              <span className="bg-cream text-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {itemCount}
              </span>
            )}
            Order ›
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: menu */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">

          {/* The live menu could not be read for this page load. Say so: the built-in menu's prices can be out of date. */}
          {!initialMenu && (
            <div role="status" className="flex items-center justify-between gap-3 px-6 py-2.5 bg-amber-50 border-b border-amber-200 shrink-0">
              <span className="text-xs text-amber-800 font-medium">
                Could not load the live menu. Showing the built-in menu, whose prices may be out of date.
              </span>
              <button
                onClick={() => {
                  if (orderItems.length === 0 || window.confirm('Reload the POS? The order in progress will be cleared.')) window.location.reload()
                }}
                className="h-9 px-3 shrink-0 rounded-sm border border-amber-300 text-[11px] font-bold uppercase tracking-widest text-amber-800 hover:bg-amber-100 transition-colors"
              >
                Reload
              </button>
            </div>
          )}

          {/* Category tabs — draggable to reorder */}
          <div className="flex gap-2 px-6 py-4 border-b border-foreground/10 shrink-0 overflow-x-auto scrollbar-none">
            {sortedMenu.map((cat) => (
              <button
                key={cat.id}
                draggable
                onClick={() => setActiveCategoryId(cat.id)}
                onDragStart={() => setDraggedCategoryId(cat.id)}
                onDragEnter={() => { if (draggedCategoryId && draggedCategoryId !== cat.id) setDragOverCategoryId(cat.id) }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={() => { setDraggedCategoryId(null); setDragOverCategoryId(null) }}
                onDrop={(e) => { e.preventDefault(); handleCategoryDrop(cat.id) }}
                className={`px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap rounded-sm transition-all duration-200 cursor-grab active:cursor-grabbing ${
                  (activeCategoryId ?? sortedMenu[0]?.id) === cat.id
                    ? 'bg-foreground text-cream border border-foreground'
                    : 'text-foreground border border-foreground/30 hover:border-foreground/60 bg-transparent'
                } ${draggedCategoryId === cat.id ? 'opacity-40' : ''} ${
                  dragOverCategoryId === cat.id ? 'border-l-4 border-l-emerald-500' : ''
                }`}
              >
                {cat.label}
              </button>
            ))}
            {/* Menu editing needs the live menu: on the built-in fallback a new tab would replace all the others */}
            {initialMenu && (
              <button
                onClick={() => setShowManageMenu(true)}
                title="Manage menu"
                className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap rounded-sm border border-dashed border-foreground/25 text-foreground/35 hover:border-foreground/55 hover:text-foreground/55 transition-all duration-200 shrink-0"
              >
                +
              </button>
            )}
          </div>

          {/* Delete error banner */}
          {deleteError && (
            <div className="flex items-center justify-between gap-3 px-6 py-2.5 bg-red-50 border-b border-red-200 shrink-0">
              <span className="text-xs text-red-600 font-medium">{deleteError}</span>
              <button
                onClick={() => setDeleteError(null)}
                className="text-red-400 hover:text-red-600 text-sm leading-none shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            {category?.id === ADDON_CATEGORY_ID ? (
              (category?.items ?? []).map(item => (
                <AddonTile
                  key={item.id}
                  item={item}
                  onAttach={item.priceFixed !== null && !item.hiddenFromPos ? () => addAddon({
                    id: `addon__${item._sanityId ?? item.id}`,
                    name: item.name,
                    label: `+${item.priceFixed} ${item.name}`,
                    price: item.priceFixed!,
                  }, selectedLineId) : undefined}
                  hasSelection={!!selectedLineId}
                  onEdit={editItemAction(item, category.id)}
                  onDelete={deleteItemAction(item)}
                  isDeleting={deletingItemId === item._sanityId}
                />
              ))
            ) : (
              (category?.items ?? []).map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onAdd={(item, variant) => addItem(item, variant, category.id)}
                  onEdit={editItemAction(item, category.id)}
                  onDelete={deleteItemAction(item)}
                  isDeleting={deletingItemId === item._sanityId}
                />
              ))
            )}
            {category && initialMenu && (
              <button
                onClick={() => setAddItemCategory(category.id)}
                className="flex flex-col items-center justify-center gap-2 min-h-38 border-2 border-dashed border-foreground/15 hover:border-foreground/35 rounded-xl text-foreground/30 hover:text-foreground/55 transition-all duration-200"
              >
                <span className="text-3xl leading-none font-light">+</span>
                <span className="text-[10px] uppercase tracking-widest font-semibold">Add Item</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: order panel — desktop only */}
        <aside data-order-panel className="hidden lg:flex w-100 xl:w-110 flex-col border-l border-foreground/10 bg-white shrink-0">
          <OrderPanel
            items={orderItems}
            total={total}
            grandTotal={grandTotal}
            discountLines={discountLines}
            selectedLineId={selectedLineId}
            itemModal={itemModal}
            payment={payment}
            customInput={customInput}
            notes={notes}
            onAdjust={adjustQty}
            onClear={clearOrder}
            onCharge={() => setShowConfirm(true)}
            onSetPayment={handleSetPayment}
            onNotesChange={setNotes}
            onSelectItem={setSelectedLineId}
            onOpenItemModal={openItemModal}
          />
        </aside>
      </div>

      {/* ── Mobile: floating order button ── */}
      {itemCount > 0 && !mobileDrawer && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={() => setMobileDrawer(true)}
            className="bg-foreground text-cream text-sm uppercase tracking-widest font-bold px-8 py-4 rounded-full shadow-2xl flex items-center gap-3"
          >
            <span className="bg-cream text-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              {itemCount}
            </span>
            View Order · ₱{grandTotal.toFixed(0)}
          </button>
        </div>
      )}

      {/* ── Mobile: order drawer ── */}
      {mobileDrawer && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileDrawer(false)} />
          <div data-order-panel className="relative z-50 bg-white border-t border-foreground/10 flex flex-col max-h-[85vh] rounded-t-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/10 shrink-0">
              <span className="text-sm font-bold uppercase tracking-widest text-foreground">Your Order</span>
              <button
                className="text-foreground/50 hover:text-foreground text-2xl leading-none w-10 h-10 flex items-center justify-center transition-colors"
                onClick={() => setMobileDrawer(false)}
              >
                ✕
              </button>
            </div>
            <OrderPanel
              items={orderItems}
              total={total}
              grandTotal={grandTotal}
              discountLines={discountLines}
              selectedLineId={selectedLineId}
              itemModal={itemModal}
              payment={payment}
              customInput={customInput}
              notes={notes}
              onAdjust={adjustQty}
              onClear={clearOrder}
              onCharge={() => { setMobileDrawer(false); setShowConfirm(true) }}
              onSetPayment={handleSetPayment}
              onNotesChange={setNotes}
              onSelectItem={setSelectedLineId}
              onOpenItemModal={openItemModal}
            />
          </div>
        </div>
      )}

      {/* ── Manage menu modal ── */}
      {showManageMenu && (
        <ManageMenuModal
          categories={categoriesForModal}
          onClose={() => setShowManageMenu(false)}
          onCategoryAdded={handleCategoryAdded}
          onCategoryDeleted={handleCategoryDeleted}
        />
      )}

      {/* ── Add / edit menu item popup ── */}
      {(addItemCategory || editingItem) && (
        <MenuItemPopup
          categoryId={editingItem?.categoryId ?? addItemCategory!}
          categoryLabel={mergedMenu.find((c) => c.id === (editingItem?.categoryId ?? addItemCategory))?.label ?? ''}
          categoryType={categoriesForModal.find((c) => c.id === (editingItem?.categoryId ?? addItemCategory))?.type ?? 'drink'}
          allCategories={categoriesForModal.filter((c) => c.id !== ADDON_CATEGORY_ID)}
          item={editingItem?.item}
          onSaved={editingItem ? handleItemUpdated : handleItemAdded}
          onClose={() => { setAddItemCategory(null); setEditingItem(null) }}
        />
      )}

      {/* ── Order review modal (centered card, shown to the customer before charging) ── */}
      {showConfirm && (
        <OrderReviewModal
          orderItems={orderItems}
          itemCount={itemCount}
          total={total}
          grandTotal={grandTotal}
          discountLines={discountLines}
          discountAmount={discountAmount}
          payment={payment}
          notes={notes}
          pendingAction={pendingAction}
          submitError={submitError}
          onCancel={() => { setShowConfirm(false); setSubmitError(null) }}
          onComplete={completeSale}
        />
      )}

      {/* ── Customer receipt preview after "Complete + Print Receipt"; closing it stays on /pos ── */}
      {receiptBlocks && (
        <ReceiptPreviewModal blocks={receiptBlocks} onClose={() => setReceiptBlocks(null)} />
      )}

      {/* ── Manager PIN, before the menu's edit and delete buttons show ── */}
      {showManagerPin && (
        <ManagerPinModal
          onUnlock={() => { setManagerUnlocked(true); setShowManagerPin(false) }}
          onClose={() => setShowManagerPin(false)}
        />
      )}

      {/* ── Per-item modal: Customize / Add-ons / Discount for one line, above either order panel ── */}
      {itemModal && modalItem && (
        <ItemActionModal
          key={`${itemModal.mode}-${itemModal.lineId}`}
          mode={itemModal.mode}
          item={modalItem}
          attachedAddons={orderItems.filter(i => i.parentLineId === modalItem.lineId)}
          addonOptions={addonAttachItems}
          discountLines={discountLines}
          onPickDiscount={(kind, scope) => pickItemDiscount(modalItem.lineId, kind, scope)}
          onSaveNote={note => setItemNote(modalItem.lineId, note)}
          onAddAddon={addon => addAddon(addon, modalItem.lineId)}
          onClose={() => setItemModal(null)}
        />
      )}
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

const ItemCard = memo(function ItemCard({
  item,
  onAdd,
  onEdit,
  onDelete,
  isDeleting,
}: {
  item: MenuItem
  onAdd: (item: MenuItem, variant: Variant | null) => void
  onEdit?: () => void
  onDelete?: () => void
  isDeleting?: boolean
}) {
  const isFood = item.priceFixed !== null
  const hasHot = item.priceHot !== null
  const hasIce = item.priceIce !== null
  const isHidden = item.hiddenFromPos ?? false

  return (
    <div className={`relative bg-white text-foreground flex flex-col overflow-hidden border border-foreground/10 hover:border-foreground/22 hover:shadow-md transition-all duration-200 rounded-xl ${isDeleting ? 'opacity-40 pointer-events-none' : ''} ${isHidden ? 'opacity-55' : ''}`}>
      <CardActions onEdit={onEdit} onDelete={onDelete} isBusy={isDeleting} />

      {/* Name + subtitle */}
      <div className="flex-1 px-5 pt-5 pb-5">
        <p className="font-bold text-[1.05rem] leading-snug tracking-tight text-foreground">
          {item.name}
        </p>
        {item.subtitle && (
          <p className="text-[11px] text-foreground/55 mt-2.5 leading-relaxed line-clamp-2">
            {item.subtitle}
          </p>
        )}
      </div>

      {/* Action row */}
      {isHidden ? (
        <div
          title="Hidden from POS ordering — still visible on /menu"
          className="flex items-center justify-between px-5 py-5 bg-foreground/10 text-foreground/50 rounded-b-xl"
        >
          <span className="text-[11px] uppercase tracking-widest font-semibold">Hidden from POS</span>
          <span className="font-bold text-xl tracking-tight">₱{item.priceFixed ?? item.priceHot ?? item.priceIce}</span>
        </div>
      ) : isFood ? (
        <button
          onClick={() => onAdd(item, null)}
          className="flex items-center justify-between px-5 py-5 bg-foreground text-cream hover:bg-foreground/85 active:bg-foreground/95 transition-colors rounded-b-xl"
        >
          <span className="text-[11px] uppercase tracking-widest text-cream/65 font-semibold">Add</span>
          <span className="font-bold text-xl tracking-tight">₱{item.priceFixed}</span>
        </button>
      ) : (
        <div className={`grid ${hasHot && hasIce ? 'grid-cols-2' : 'grid-cols-1'} gap-2 px-2 pb-2`}>
          {hasHot && (
            <button
              onClick={() => onAdd(item, 'hot')}
              className="flex flex-col items-center justify-center gap-1.5 py-5 bg-foreground text-cream hover:bg-foreground/85 active:bg-foreground/95 transition-colors rounded-xl"
            >
              <span className="text-[11px] uppercase tracking-widest text-cream/65 font-semibold">Hot</span>
              <span className="font-bold text-xl tracking-tight">₱{item.priceHot}</span>
            </button>
          )}
          {hasIce && (
            <button
              onClick={() => onAdd(item, 'ice')}
              className="flex flex-col items-center justify-center gap-1.5 py-5 bg-[#1A5535] text-cream hover:bg-[#164829] active:bg-[#123d22] transition-colors rounded-xl"
            >
              <span className="text-[11px] uppercase tracking-widest text-cream/65 font-semibold">Ice</span>
              <span className="font-bold text-xl tracking-tight">₱{item.priceIce}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
})

// ─── Addon Tile ───────────────────────────────────────────────────────────────
// Items filed under the "Add ons" category attach to whichever order line is
// selected — or, with nothing selected (including an empty cart), add as their
// own standalone order line. Either way they render as plain tiles instead of
// ItemCard's hot/ice/buy buttons.

const AddonTile = memo(function AddonTile({
  item,
  onAttach,
  hasSelection,
  onEdit,
  onDelete,
  isDeleting,
}: {
  item: MenuItem
  onAttach?: () => void
  hasSelection?: boolean
  onEdit?: () => void
  onDelete?: () => void
  isDeleting?: boolean
}) {
  const isFoodAddon = item.addonType === 'food'
  const isHidden = item.hiddenFromPos ?? false

  return (
    <div className={`relative bg-white text-foreground flex flex-col overflow-hidden border border-foreground/10 hover:border-foreground/22 hover:shadow-md transition-all duration-200 rounded-xl ${isDeleting ? 'opacity-40 pointer-events-none' : ''} ${isHidden ? 'opacity-55' : ''}`}>
      <CardActions onEdit={onEdit} onDelete={onDelete} isBusy={isDeleting} />

      <div className="flex-1 px-5 pt-5 pb-5">
        <p className="font-bold text-[1.05rem] leading-snug tracking-tight text-foreground">{item.name}</p>
        {item.subtitle && (
          <p className="text-[11px] text-foreground/55 mt-2.5 leading-relaxed line-clamp-2">{item.subtitle}</p>
        )}
      </div>

      {isHidden ? (
        <div
          title="Hidden from POS — still visible on /menu"
          className="flex items-center justify-between px-5 py-5 bg-foreground/10 text-foreground/50 rounded-b-xl"
        >
          <span className="text-[11px] uppercase tracking-widest font-semibold">Hidden from POS</span>
          <span className="font-bold text-xl tracking-tight">+₱{item.priceFixed}</span>
        </div>
      ) : onAttach && (
        <button
          onClick={onAttach}
          title={hasSelection ? 'Attach to selected item' : 'Add as a new item'}
          className={`flex items-center justify-between px-5 py-5 text-cream transition-colors rounded-b-xl disabled:opacity-40 disabled:cursor-not-allowed ${
            isFoodAddon ? 'bg-[#8b5e3c] hover:bg-[#6f4a2f]' : 'bg-foreground hover:bg-foreground/85'
          } active:bg-foreground/95`}
        >
          <span className="text-[11px] uppercase tracking-widest text-cream/65 font-semibold">
            {item.addonType ? (isFoodAddon ? 'Food' : 'Drink') : 'Add-on'}
          </span>
          <span className="font-bold text-xl tracking-tight">+₱{item.priceFixed}</span>
        </button>
      )}
    </div>
  )
})

// ─── Order Panel ──────────────────────────────────────────────────────────────

function OrderPanel({
  items,
  total,
  grandTotal,
  discountLines,
  selectedLineId,
  itemModal,
  payment,
  customInput,
  notes,
  onAdjust,
  onClear,
  onCharge,
  onSetPayment,
  onNotesChange,
  onSelectItem,
  onOpenItemModal,
}: {
  items: OrderItem[]
  total: number
  grandTotal: number
  discountLines: DiscountLine[]
  selectedLineId: string | null
  itemModal: { lineId: string; mode: ItemModalMode } | null
  payment: number | null
  customInput: string
  notes: string
  onAdjust: (lineId: string, delta: number) => void
  onClear: () => void
  onCharge: () => void
  onSetPayment: (amount: number | null, raw: string) => void
  onNotesChange: (value: string) => void
  onSelectItem: (lineId: string) => void
  onOpenItemModal: (lineId: string, mode: ItemModalMode) => void
}) {
  const modalOpenFor = (lineId: string, mode: ItemModalMode) =>
    itemModal !== null && itemModal.lineId === lineId && itemModal.mode === mode

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Panel header */}
      <div className="px-6 py-3 border-b border-foreground/10 shrink-0">
        <p className="text-[10px] uppercase tracking-[0.28em] text-foreground/60 font-semibold">Current Order</p>
      </div>

      {/* Order items */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-12 gap-2">
            <p className="text-foreground/20 text-4xl font-light">—</p>
            <p className="text-foreground/40 text-sm">No items added yet</p>
          </div>
        ) : (() => {
          const { parentItems, addonsByParent, orphanAddons } = groupOrderItems(items)
          return (
            <>
              {parentItems.map(item => {
                const hasDiscount  = hasLineDiscount(item)
                const isSelected   = item.lineId === selectedLineId
                const childAddons  = addonsByParent.get(item.lineId) ?? []

                return (
                  <Fragment key={item.lineId}>
                    {/* Parent item row */}
                    <div
                      data-item-row
                      onClick={() => onSelectItem(item.lineId)}
                      className={`flex items-start gap-3 py-2.5 border-b border-foreground/[0.07] cursor-pointer transition-all ${
                        isSelected ? 'border-l-2 border-l-emerald-500 pl-1 -ml-1' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.9rem] font-semibold leading-tight text-foreground">{item.name}</p>
                        {item.variant && (
                          <p className={`text-[10px] uppercase tracking-wider mt-0.5 font-bold ${variantClass(item.variant)}`}>
                            {item.variant}
                          </p>
                        )}
                        {DISCOUNT_KINDS.map(kind => {
                          const scope = item.discounts?.[kind]
                          return scope ? (
                            <p key={kind} className="text-[10px] text-emerald-600 font-semibold mt-0.5 tracking-wide">
                              {discountBadge(kind, item, scope, 'short')} applied
                            </p>
                          ) : null
                        })}
                        {item.note && (
                          <p className="text-[10px] text-amber-600 font-semibold mt-0.5 tracking-wide truncate">
                            📝 {item.note}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); onOpenItemModal(item.lineId, 'addons') }}
                          title="Add-ons and customizations (extra shot, less sweet, etc.)"
                          className={`w-8 h-8 flex items-center justify-center text-base font-bold rounded-full border transition-colors ${
                            childAddons.length > 0 || item.note
                              ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                              : 'bg-sky-50 border-sky-300 text-sky-600 hover:bg-sky-100 hover:border-sky-500'
                          } ${modalOpenFor(item.lineId, 'addons') ? 'ring-2 ring-sky-300 ring-offset-1' : ''}`}
                        >
                          +
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onOpenItemModal(item.lineId, 'discount') }}
                          title="Discount (PWD/Senior 20%, Google Review 10% — all units or one)"
                          className={`w-8 h-8 flex items-center justify-center text-[10px] font-bold rounded-full border transition-colors ${
                            hasDiscount
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-500'
                          } ${modalOpenFor(item.lineId, 'discount') ? 'ring-2 ring-emerald-300 ring-offset-1' : ''}`}
                        >
                          %
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={e => { e.stopPropagation(); onAdjust(item.lineId, -1) }}
                            className="w-8 h-8 flex items-center justify-center text-foreground/50 hover:text-foreground border border-foreground/12 hover:border-foreground/30 rounded-sm text-base transition-colors"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm tabular-nums font-bold text-foreground">{item.qty}</span>
                          <button
                            data-qty-plus
                            onClick={e => { e.stopPropagation(); onAdjust(item.lineId, 1) }}
                            className="w-8 h-8 flex items-center justify-center text-foreground/50 hover:text-foreground border border-foreground/12 hover:border-foreground/30 rounded-sm text-base transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm tabular-nums w-16 text-right font-bold text-foreground">
                          ₱{(item.price * item.qty).toFixed(0)}
                        </span>
                      </div>
                    </div>

                    {/* Attached add-ons — a light-blue "+ name" chip, same look as the Review Your Order
                        screen, with editable qty/price alongside since this cart is still live. */}
                    {childAddons.map(addon => (
                      <div key={addon.lineId} className="flex items-center gap-2 py-1.5 pl-3">
                        <span className="inline-flex min-w-0 shrink items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                          <span className="text-sky-500">+</span>
                          <span className="truncate">{addon.name}</span>
                        </span>
                        <div className="ml-auto flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onAdjust(addon.lineId, -1)}
                            className="w-7 h-7 flex items-center justify-center text-foreground/35 hover:text-foreground border border-foreground/10 hover:border-foreground/25 rounded-sm text-sm transition-colors"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-xs tabular-nums text-foreground/55">{addon.qty}</span>
                          <button
                            onClick={() => onAdjust(addon.lineId, 1)}
                            className="w-7 h-7 flex items-center justify-center text-foreground/35 hover:text-foreground border border-foreground/10 hover:border-foreground/25 rounded-sm text-sm transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs tabular-nums w-16 text-right text-foreground/45 shrink-0">
                          ₱{(addon.price * addon.qty).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </Fragment>
                )
              })}

              {/* Orphaned add-ons (legacy / no parent) */}
              {orphanAddons.map(addon => (
                <div key={addon.lineId} className="flex items-center gap-3 py-2.5 border-b border-foreground/[0.07]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.85rem] font-medium text-foreground/60">+ {addon.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => onAdjust(addon.lineId, -1)} className="w-8 h-8 flex items-center justify-center text-foreground/50 hover:text-foreground border border-foreground/12 hover:border-foreground/30 rounded-sm text-base transition-colors">−</button>
                    <span className="w-6 text-center text-sm tabular-nums font-bold text-foreground">{addon.qty}</span>
                    <button onClick={() => onAdjust(addon.lineId, 1)} className="w-8 h-8 flex items-center justify-center text-foreground/50 hover:text-foreground border border-foreground/12 hover:border-foreground/30 rounded-sm text-base transition-colors">+</button>
                  </div>
                  <span className="text-sm tabular-nums w-16 text-right font-bold text-foreground">₱{(addon.price * addon.qty).toFixed(0)}</span>
                </div>
              ))}
            </>
          )
        })()}
      </div>

      {/* Customer name — stored as the sale's notes and printed as "Name" on the receipt */}
      <div className="px-6 py-2 border-t border-foreground/10 shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Customer name…"
            value={notes}
            disabled={items.length === 0}
            maxLength={100}
            onChange={e => onNotesChange(e.target.value)}
            className={`w-full border border-foreground/13 rounded-sm px-2.5 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 disabled:opacity-30 bg-transparent ${notes.length > 70 ? 'pr-7' : ''}`}
          />
          {notes.length > 70 && (
            <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums pointer-events-none ${notes.length >= 95 ? 'text-red-400' : 'text-foreground/30'}`}>
              {100 - notes.length}
            </span>
          )}
        </div>
      </div>

      {/* Footer: discount breakdown + total + payment + actions */}
      <div className="px-6 pt-3 pb-3 border-t border-foreground/10 shrink-0 space-y-2.5">

        {/* Discount breakdown — one row per discount, shown whenever any applies */}
        {discountLines.length > 0 && (
          <div className="space-y-1 px-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold">Subtotal</span>
              <span className="text-xs tabular-nums text-foreground/50">₱{total.toFixed(0)}</span>
            </div>
            {discountLines.map(d => (
              <div key={`${d.lineId}:${d.kind}`} className="flex justify-between items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold truncate">{d.label} ({d.name})</span>
                <span className="text-xs tabular-nums text-emerald-600 font-bold shrink-0">−₱{d.amount}</span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase tracking-widest text-foreground/60 font-semibold">Total</span>
          <span className="font-display font-semibold text-4xl tabular-nums text-foreground">₱{grandTotal.toFixed(0)}</span>
        </div>

        {/* Payment presets */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/60 font-semibold">Payment</p>
          <div className="flex gap-1.5">
            {[500, 1000, 2000].map(amt => (
              <button
                key={amt}
                onClick={() => onSetPayment(amt, String(amt))}
                disabled={items.length === 0}
                className={`flex-1 py-2 text-xs font-bold tabular-nums rounded-sm border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                  payment === amt
                    ? 'bg-foreground text-cream border-foreground'
                    : 'border-foreground/15 text-foreground hover:border-foreground/35 hover:bg-foreground/4'
                }`}
              >
                ₱{amt}
              </button>
            ))}
          </div>
        </div>

        {/* Custom amount */}
        <input
          type="number"
          inputMode="numeric"
          placeholder="Custom amount"
          value={customInput}
          disabled={items.length === 0}
          onChange={e => {
            const raw = e.target.value
            const val = parseFloat(raw)
            onSetPayment(isNaN(val) ? null : val, raw)
          }}
          className="w-full border border-foreground/13 rounded-sm px-2.5 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 disabled:opacity-30 bg-transparent"
        />

        {/* Change / Short indicator */}
        {payment !== null && items.length > 0 && (
          payment >= grandTotal ? (
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/60 font-semibold">Change</span>
              <span className="font-display font-semibold text-2xl tracking-tight text-foreground tabular-nums">
                ₱{(payment - grandTotal).toFixed(0)}
              </span>
            </div>
          ) : (
            <p className="text-xs text-red-500 uppercase tracking-widest font-semibold">
              Short ₱{(grandTotal - payment).toFixed(0)}
            </p>
          )
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={onClear}
            disabled={items.length === 0}
            className="flex-none border border-foreground/13 text-foreground/55 text-xs uppercase tracking-widest py-3 px-4 hover:border-foreground/25 hover:text-foreground/75 transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-sm font-semibold"
          >
            Clear
          </button>
          <button
            onClick={onCharge}
            disabled={items.length === 0}
            className="flex-1 bg-foreground text-cream text-sm uppercase tracking-widest py-3.5 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
          >
            Charge ₱{grandTotal.toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  )
}
