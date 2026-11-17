import { Phone, ShieldCheck } from 'lucide-react'
import { useTrip } from '@/context/TripContext'
import { Avatar, Card } from '@/components/ui'

export default function Group() {
  const { members, trip } = useTrip()
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-navy-800">Group</h1>
      <p className="text-navy-500 mt-1 mb-5">{members.length} travellers on {trip?.name}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {members.map((m) => (
          <Card key={m.user_id} className="p-5 flex gap-4 items-start">
            <Avatar profile={m.profile} size={56} />
            <div className="min-w-0">
              <p className="font-bold text-navy-800 text-lg">{m.profile.display_name}</p>
              <p className="text-navy-400 text-sm">@{m.profile.username}</p>
              {m.role === 'admin' && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-navy-100 text-navy-700 px-2.5 py-0.5 text-sm font-semibold"><ShieldCheck className="h-3.5 w-3.5" />Admin</span>}
              {m.profile.phone && <a className="mt-2 flex items-center gap-2 text-jungle-700 font-semibold min-h-[44px]" href={`tel:${m.profile.phone.replace(/[^+\d]/g, '')}`}><Phone className="h-4 w-4" />{m.profile.phone}</a>}
              {m.profile.emergency_contact && <p className="text-sm text-navy-500 mt-1">Emergency contact: {m.profile.emergency_contact}</p>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
