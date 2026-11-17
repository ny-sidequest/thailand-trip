import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  if (online) return null
  return (
    <div role="status" className="bg-amber-100 text-amber-900 px-4 py-2 text-center font-semibold flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />You're offline. The itinerary shows your last saved copy; other sections need a connection.
    </div>
  )
}
