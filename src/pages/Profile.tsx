import { useRef, useState, type FormEvent } from 'react'
import { Camera } from 'lucide-react'
import { supabase, usernameLogin } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { Avatar, Button, Card, Field, inputCls } from '@/components/ui'

const IMG = ['image/jpeg', 'image/png', 'image/webp']

export default function Profile() {
  const { profile, session, refreshProfile, signOut } = useAuth()
  const { reload } = useTrip()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [emergency, setEmergency] = useState(profile?.emergency_contact ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [cur, setCur] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    const dn = name.trim()
    if (!dn || dn.length > 60) return setMsg({ ok: false, text: 'Name must be 1–60 characters.' })
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('profiles').update({ display_name: dn, phone: phone.trim() || null, emergency_contact: emergency.trim() || null }).eq('id', session!.user.id)
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message })
    await refreshProfile(); await reload()
    setMsg({ ok: true, text: 'Profile saved.' })
  }

  async function onAvatar(f: File | undefined) {
    if (!f) return
    if (!IMG.includes(f.type)) return setMsg({ ok: false, text: 'Use a JPEG, PNG or WebP image.' })
    if (f.size > 3 * 1024 * 1024) return setMsg({ ok: false, text: 'Image must be under 3 MB.' })
    setBusy(true); setMsg(null)
    const path = `${session!.user.id}/avatar-${Date.now()}.${f.type.split('/')[1]}`
    const up = await supabase.storage.from('avatars').upload(path, f, { contentType: f.type })
    if (up.error) { setBusy(false); return setMsg({ ok: false, text: up.error.message }) }
    const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', session!.user.id)
    if (!error && profile?.avatar_path) void supabase.storage.from('avatars').remove([profile.avatar_path])
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message })
    await refreshProfile(); await reload()
    setMsg({ ok: true, text: 'Photo updated.' })
  }

  async function changePw(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 10) return setPwMsg({ ok: false, text: 'New password must be at least 10 characters.' })
    if (pw !== pw2) return setPwMsg({ ok: false, text: 'New passwords do not match.' })
    setPwBusy(true); setPwMsg(null)
    try {
      await usernameLogin(profile!.username, cur) // re-verify current password server-side
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw error
      setCur(''); setPw(''); setPw2('')
      setPwMsg({ ok: true, text: 'Password changed.' })
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error && err.message !== 'Invalid username or password' ? err.message : 'Current password is incorrect.' })
    } finally { setPwBusy(false) }
  }

  const note = (m: { ok: boolean; text: string } | null) => m && <p role="status" className={m.ok ? 'text-jungle-700 font-semibold' : 'text-red-700 font-semibold'}>{m.text}</p>

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-navy-800">My profile</h1>
      <Card className="p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="relative">
            <Avatar profile={profile} size={72} />
            <button onClick={() => fileRef.current?.click()} aria-label="Change photo" className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-navy-800 text-white shadow"><Camera className="h-4 w-4" /></button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void onAvatar(e.target.files?.[0])} />
          </div>
          <div><p className="font-bold text-navy-800 text-lg">{profile?.display_name}</p><p className="text-navy-400">@{profile?.username}</p></div>
        </div>
        <form onSubmit={save} className="space-y-4">
          <Field label="Display name"><input className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Phone" hint="Visible to your trip group."><input className={inputCls} type="tel" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Emergency contact" hint="Name and number. Visible to your trip group."><input className={inputCls} value={emergency} maxLength={120} onChange={(e) => setEmergency(e.target.value)} /></Field>
          {note(msg)}
          <Button type="submit" busy={busy}>Save changes</Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-xl font-bold text-navy-800 mb-4">Change password</h2>
        <form onSubmit={changePw} className="space-y-4">
          <Field label="Current password"><input className={inputCls} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></Field>
          <Field label="New password" hint="At least 10 characters."><input className={inputCls} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
          <Field label="Repeat new password"><input className={inputCls} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></Field>
          {note(pwMsg)}
          <Button type="submit" busy={pwBusy}>Update password</Button>
        </form>
        <p className="text-sm text-navy-400 mt-3">Forgot your password? Ask the trip admin to reset it.</p>
      </Card>
      <Button variant="soft" onClick={() => void signOut()} className="w-full lg:hidden">Sign out</Button>
    </div>
  )
}
