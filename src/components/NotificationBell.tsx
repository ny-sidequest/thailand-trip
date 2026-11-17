import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotifications } from '@/context/NotificationsContext'

export default function NotificationBell({ className }: { className?: string }) {
  const { unread } = useNotifications()
  return (
    <Link to="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className={`relative inline-grid h-11 w-11 place-items-center rounded-full hover:bg-white/10 ${className ?? ''}`}>
      <Bell className="h-5 w-5" />
      {unread > 0 && <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-ember-500 text-white text-xs font-bold grid place-items-center">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  )
}
