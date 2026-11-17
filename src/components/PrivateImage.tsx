import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const cache = new Map<string, { url: string; exp: number }>()
/** Image from a private bucket via a cached short-lived signed URL. */
export default function PrivateImage({ bucket, path, alt, className }: { bucket: string; path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    const k = `${bucket}/${path}`, hit = cache.get(k)
    if (hit && hit.exp > Date.now()) { setUrl(hit.url); return }
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
      if (!alive) return
      if (!data) return setFailed(true)
      cache.set(k, { url: data.signedUrl, exp: Date.now() + 3_000_000 }); setUrl(data.signedUrl)
    })
    return () => { alive = false }
  }, [bucket, path])
  if (failed) return <div className={`grid place-items-center bg-sand-100 text-navy-400 text-sm ${className ?? ''}`}>Photo unavailable</div>
  if (!url) return <div className={`animate-pulse bg-navy-100/60 ${className ?? ''}`} style={{ minHeight: 160 }} />
  return <img src={url} alt={alt} loading="lazy" className={className} />
}
