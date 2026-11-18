import { useEffect, useState } from 'react'

/** Re-renders once a minute (aligned to the minute) so countdowns stay live. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => { setNow(new Date()); timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50) }
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    return () => clearTimeout(timer)
  }, [])
  return now
}
