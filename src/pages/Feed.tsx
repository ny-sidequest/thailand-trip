import { Link, useParams } from 'react-router-dom'
import { useTrip } from '@/context/TripContext'
import { useAnnouncements, usePolls } from '@/hooks/useSocial'
import { ErrorState, Skeleton, cx } from '@/components/ui'
import FeedTab from '@/components/social/FeedTab'
import PollsTab from '@/components/social/Polls'
import AnnouncementsTab from '@/components/social/Announcements'
import { pollClosed } from '@/lib/social'

export default function Feed() {
  const { trip } = useTrip()
  const tab = useParams()['*'] ?? ''
  const tripId = trip!.id
  const ann = useAnnouncements(tripId)
  const polls = usePolls(tripId)
  const unread = ann.data ? ann.data.items.filter((a) => !ann.data!.mine.has(a.id)).length : 0
  const openPolls = polls.data ? polls.data.polls.filter((p) => !pollClosed(p)).length : 0
  const tabs = [{ to: '/feed', key: '', label: 'Feed', n: 0 }, { to: '/feed/polls', key: 'polls', label: 'Polls', n: openPolls }, { to: '/feed/announcements', key: 'announcements', label: 'Announcements', n: unread }]

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="font-display text-[1.75rem] sm:text-[2rem] font-semibold tracking-tight text-navy-800">Feed</h1>
      <nav className="flex gap-1.5 glass rounded-2xl p-1.5" aria-label="Feed sections">
        {tabs.map((t) => (
          <Link key={t.key} to={t.to} aria-current={tab === t.key ? 'page' : undefined}
            className={cx('flex-1 text-center rounded-xl min-h-[44px] grid place-items-center font-semibold text-sm sm:text-base', tab === t.key ? 'bg-gradient-to-b from-navy-600 to-navy-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_6px_14px_-6px_rgba(11,31,58,.65)]' : 'text-navy-600 hover:bg-sand-100')}>
            <span className="inline-flex items-center gap-1.5">{t.label}{t.n > 0 && <span className={cx('min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold grid place-items-center', t.key === 'announcements' ? 'bg-ember-500 text-white' : 'bg-jungle-100 text-jungle-800')}>{t.n}</span>}</span>
          </Link>
        ))}
      </nav>
      {tab === '' && <FeedTab tripId={tripId} />}
      {tab === 'polls' && (polls.error ? <ErrorState message={polls.error} onRetry={polls.reload} /> : !polls.data ? <Skeleton className="h-40" /> : <PollsTab data={polls.data} reload={polls.reload} />)}
      {tab === 'announcements' && (ann.error ? <ErrorState message={ann.error} onRetry={ann.reload} /> : !ann.data ? <Skeleton className="h-40" /> : <AnnouncementsTab data={ann.data} reload={ann.reload} />)}
    </div>
  )
}
