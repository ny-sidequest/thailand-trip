import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useTrip } from '@/context/TripContext'
import { Button, Card, Field, inputCls } from '@/components/ui'
import { safeUrl } from '@/lib/format'

export default function TripSettings() {
  const { trip, reload } = useTrip()
  const t = trip!
  const [f, setF] = useState({ name: t.name, tagline: t.tagline ?? '', start_date: t.start_date, end_date: t.end_date, rate: String(t.default_thb_to_inr), hero: t.hero_image_url ?? '', route: t.route_stops.join(', ') })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function save(e: FormEvent) {
    e.preventDefault()
    const rate = Number(f.rate)
    if (!f.name.trim()) return setMsg({ ok: false, text: 'Trip name is required.' })
    if (!(rate > 0 && rate < 1000)) return setMsg({ ok: false, text: 'Enter a valid exchange rate.' })
    if (f.end_date < f.start_date) return setMsg({ ok: false, text: 'End date must be on or after the start date.' })
    if (f.hero.trim() && !safeUrl(f.hero.trim())) return setMsg({ ok: false, text: 'Hero image must be an http(s) link.' })
    setBusy(true); setMsg(null)
    const route = f.route.split(/,|→|->/).map((s) => s.trim()).filter(Boolean)
    const { data, error } = await supabase.from('trips').update({ name: f.name.trim(), tagline: f.tagline.trim() || null, start_date: f.start_date, end_date: f.end_date, default_thb_to_inr: rate, hero_image_url: f.hero.trim() || null, route_stops: route }).eq('id', t.id).select('id')
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message })
    if (!data?.length) return setMsg({ ok: false, text: 'Not saved: only the trip admin can change settings.' })
    await reload(); setMsg({ ok: true, text: 'Saved. Everyone sees the update.' })
  }

  return (
    <form onSubmit={save} className="max-w-xl space-y-4">
      <h1 className="font-display text-3xl font-bold text-navy-800">Trip settings</h1>
      <Card className="p-5 space-y-4">
        <Field label="Trip name"><input className={inputCls} maxLength={120} value={f.name} onChange={set('name')} required /></Field>
        <Field label="Tagline"><input className={inputCls} maxLength={200} value={f.tagline} onChange={set('tagline')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date"><input type="date" className={inputCls} value={f.start_date} onChange={set('start_date')} required /></Field>
          <Field label="End date"><input type="date" className={inputCls} value={f.end_date} onChange={set('end_date')} required /></Field>
        </div>
        <Field label={`Default exchange rate: 1 THB = ? ${t.base_currency}`} hint="Pre-filled when someone adds a THB expense. Each expense stores the rate actually used, so changing this never alters past expenses.">
          <input className={inputCls} inputMode="decimal" value={f.rate} onChange={set('rate')} required />
        </Field>
        <Field label="Route overview" hint="Comma-separated, in order. e.g. Bangalore, Bangkok, Phuket, Krabi, Bangkok, Bangalore"><input className={inputCls} value={f.route} onChange={set('route')} /></Field>
        <Field label="Hero image link" hint="Optional. A photo link you have the rights to use (https://…)."><input className={inputCls} inputMode="url" value={f.hero} onChange={set('hero')} /></Field>
        {msg && <p role="status" className={msg.ok ? 'text-jungle-700 font-semibold' : 'text-red-700 font-semibold'}>{msg.text}</p>}
        <Button type="submit" busy={busy}>Save settings</Button>
      </Card>
    </form>
  )
}
