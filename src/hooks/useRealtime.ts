import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/** Calls onChange (debounced) whenever any row in `tables` changes for this trip. RLS filters what is delivered. */
export function useRealtime(tripId: string | undefined, tables: string[], onChange: () => void) {
  const cb = useRef(onChange)
  cb.current = onChange
  const key = tables.join(',')
  useEffect(() => {
    if (!tripId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const fire = () => { clearTimeout(timer); timer = setTimeout(() => cb.current(), 250) }
    const ch = supabase.channel(`rt:${tripId}:${key}:${Math.random().toString(36).slice(2, 7)}`)
    for (const table of key.split(','))
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` }, fire)
    ch.subscribe()
    return () => { clearTimeout(timer); void supabase.removeChannel(ch) }
  }, [tripId, key])
}
