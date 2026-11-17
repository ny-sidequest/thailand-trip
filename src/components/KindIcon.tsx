import { Bed, Bus, Coffee, Compass, Plane, Sparkles, Utensils, type LucideIcon } from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  activity: Compass, food: Utensils, transport: Bus, stay: Bed, flight: Plane, option: Sparkles, free: Coffee,
}
export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const I = MAP[kind] ?? Compass
  return <I className={className ?? 'h-5 w-5'} />
}
