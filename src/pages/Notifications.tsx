import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { useNotifications } from '@/context/NotificationsContext'
import { Button, Card, EmptyState, ErrorState, Spinner, cx } from '@/components/ui'
import { timeAgo } from '@/lib/format'

export default function Notifications() {
  const { items, unread, loading, error, markRead, markAllRead, reload } = useNotifications()
  const nav = useNavigate()
  const open = async (id: string, link: string | null, read: boolean) => {
    if (!read) await markRead(id)
    if (link && link.startsWith('/') && !link.startsWith('//')) nav(link)
  }
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-navy-800">Notifications</h1>
        {unread > 0 && <Button variant="soft" onClick={() => void markAllRead()}><CheckCheck className="h-4 w-4" />Mark all read</Button>}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && items.length === 0 && <Spinner />}
      {!loading && !error && items.length === 0 && <Card><EmptyState icon={<BellOff className="h-8 w-8" />} title="You're all caught up" hint="Booking changes, announcements and replies will show up here." /></Card>}
      {items.length > 0 && (
        <Card className="divide-y divide-sand-200/70 overflow-hidden">
          {items.map((n) => (
            <button key={n.id} onClick={() => void open(n.id, n.link, !!n.read_at)} className={cx('w-full text-left flex gap-3 p-4 min-h-[64px] hover:bg-sand-50', !n.read_at && 'bg-jungle-50/60')}>
              <span className={cx('mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full', n.read_at ? 'bg-sand-100 text-navy-300' : 'bg-jungle-100 text-jungle-700')}><Bell className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className={cx('block text-navy-800', !n.read_at && 'font-semibold')}>{n.title}</span>
                {n.body && <span className="block text-navy-500 truncate">{n.body}</span>}
                <span className="block text-sm text-navy-400">{timeAgo(n.created_at)}</span>
              </span>
              {!n.read_at && <span className="mt-2 h-2.5 w-2.5 rounded-full bg-ember-500 shrink-0" aria-label="Unread" />}
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}
