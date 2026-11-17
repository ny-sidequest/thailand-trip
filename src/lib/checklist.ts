import type { ChecklistItem } from './types'
import { daysUntil } from './format'

export function groupByCategory(items: ChecklistItem[]) {
  const map = new Map<string, ChecklistItem[]>()
  for (const i of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    if (!map.has(i.category)) map.set(i.category, [])
    map.get(i.category)!.push(i)
  }
  return [...map.entries()].map(([category, list]) => ({ category, items: list }))
}

export const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0)

export type DueState = 'none' | 'done' | 'overdue' | 'soon' | 'later'
export function dueState(due: string | null, completed: boolean, now = new Date()): DueState {
  if (!due) return 'none'
  if (completed) return 'done'
  const d = daysUntil(due, now)
  return d < 0 ? 'overdue' : d <= 3 ? 'soon' : 'later'
}

/** Earliest deadline among items not yet completed. */
export function nextDeadline(items: ChecklistItem[], done: Set<string>): ChecklistItem | null {
  return items.filter((i) => i.due_date && !done.has(i.id)).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0] ?? null
}
