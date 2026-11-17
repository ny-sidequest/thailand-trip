import { Beer, Bed, Bus, Compass, PartyPopper, Receipt, ShoppingBag, Ticket, Utensils, type LucideIcon } from 'lucide-react'
import type { Currency } from './types'

export const CURRENCY_SYMBOL: Record<Currency, string> = { THB: '฿', INR: '₹' }

/** Format a decimal amount, e.g. 1234.5 + INR -> ₹1,234.50 */
export function formatMoney(amount: number, currency: Currency): string {
  const sign = amount < 0 ? '−' : ''
  const n = Math.abs(amount).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${sign}${CURRENCY_SYMBOL[currency]}${n}`
}
export const formatMinor = (minor: number, currency: Currency) => formatMoney(minor / 100, currency)

export const EXPENSE_CATEGORIES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'food', label: 'Food', icon: Utensils }, { value: 'drinks', label: 'Drinks', icon: Beer },
  { value: 'transport', label: 'Transport', icon: Bus }, { value: 'accommodation', label: 'Stay', icon: Bed },
  { value: 'activities', label: 'Activities', icon: Compass }, { value: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { value: 'nightlife', label: 'Nightlife', icon: PartyPopper }, { value: 'tickets', label: 'Tickets', icon: Ticket },
  { value: 'other', label: 'Other', icon: Receipt },
]
export const categoryMeta = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]

/** Default conversion rate (base currency per 1 unit of `currency`) from the trip's THB->INR default. */
export function defaultRate(currency: Currency, base: Currency, thbToInr: number): number {
  if (currency === base) return 1
  if (base === 'INR') return thbToInr            // THB -> INR
  return Math.round((1 / thbToInr) * 1e6) / 1e6  // INR -> THB
}

/** Parse a user-typed decimal ("1,250.50") into a number or NaN. */
export function parseAmount(s: string): number {
  const t = s.replace(/,/g, '').trim()
  return /^\d+(\.\d{0,2})?$/.test(t) ? Number(t) : NaN
}
