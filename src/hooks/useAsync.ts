import { useCallback, useEffect, useRef, useState } from 'react'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    let alive = true
    setState((s) => ({ data: s.data, loading: s.data === undefined }))
    fnRef.current()
      .then((data) => alive && setState({ data, loading: false }))
      .catch((e: unknown) => alive && setState((s) => ({ data: s.data, error: e instanceof Error ? e.message : String(e), loading: false })))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
