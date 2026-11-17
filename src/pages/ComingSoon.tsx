import type { ReactNode } from 'react'
import { Card } from '@/components/ui'

/** Honest placeholder for sections scheduled in later phases (see PROJECT_STATUS.md). */
export default function ComingSoon({ title, phase, icon }: { title: string; phase: number; icon: ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-navy-800 mb-4">{title}</h1>
      <Card className="p-8 text-center text-navy-500">
        <div className="mx-auto mb-3 flex justify-center text-navy-300">{icon}</div>
        <p className="font-semibold text-navy-700">Being built in Phase {phase}</p>
        <p className="mt-1">This section isn't available yet. Everything already in the database is safe and shared.</p>
      </Card>
    </div>
  )
}
