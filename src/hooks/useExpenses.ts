import { supabase, unwrap } from '@/lib/supabase'
import { useAsync } from './useAsync'
import { useRealtime } from './useRealtime'
import type { Expense, Settlement } from '@/lib/types'

export function useExpenses(tripId: string) {
  const q = useAsync(async () => {
    const [ex, st] = await Promise.all([
      supabase.from('expenses').select('*, splits:expense_splits(user_id,share_amount,percentage)')
        .eq('trip_id', tripId).is('deleted_at', null).order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('settlements').select('*').eq('trip_id', tripId).is('deleted_at', null)
        .order('settled_on', { ascending: false }).order('created_at', { ascending: false }),
    ])
    return { expenses: unwrap(ex) as unknown as Expense[], settlements: unwrap(st) as Settlement[] }
  }, [tripId])
  useRealtime(tripId, ['expenses', 'expense_splits', 'settlements'], q.reload)
  return q
}
