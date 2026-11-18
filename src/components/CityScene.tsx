import { useId } from 'react'

export type SceneKind = 'bangkok' | 'phuket' | 'krabi' | 'generic'
export function sceneFor(city: string): SceneKind {
  const c = city.toLowerCase()
  if (c.includes('bangkok')) return 'bangkok'
  if (c.includes('phuket') || c.includes('patong') || c.includes('kata') || c.includes('karon')) return 'phuket'
  if (c.includes('krabi') || c.includes('phi phi') || c.includes('railay') || c.includes('ao nang')) return 'krabi'
  return 'generic'
}

/** Hand-drawn vector destination art (no photos needed, no licensing). Decorative: hidden from assistive tech. */
export default function CityScene({ city, className }: { city: string; className?: string }) {
  const kind = sceneFor(city)
  const id = useId().replace(/:/g, '')
  const g = (n: string) => `url(#${id}-${n})`
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          {kind === 'bangkok' && <><stop offset="0" stopColor="#1a2860" /><stop offset=".55" stopColor="#b8506e" /><stop offset="1" stopColor="#f59a5b" /></>}
          {kind === 'phuket' && <><stop offset="0" stopColor="#0f3f6e" /><stop offset=".5" stopColor="#2f9c9a" /><stop offset="1" stopColor="#ffc785" /></>}
          {kind === 'krabi' && <><stop offset="0" stopColor="#173a63" /><stop offset=".55" stopColor="#3a8f93" /><stop offset="1" stopColor="#f6d6a2" /></>}
          {kind === 'generic' && <><stop offset="0" stopColor="#14284a" /><stop offset="1" stopColor="#2f9c9a" /></>}
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff3c9" /><stop offset=".35" stopColor="#ffd27a" stopOpacity=".9" /><stop offset="1" stopColor="#ff9d4d" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f7f86" /><stop offset="1" stopColor="#0b2f4a" /></linearGradient>
        <linearGradient id={`${id}-mist`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#ffe9c9" stopOpacity=".55" /></linearGradient>
      </defs>
      <rect width="400" height="220" fill={g('sky')} />

      {kind === 'bangkok' && (<>
        <circle cx="300" cy="150" r="70" fill={g('sun')} />
        <g fill="#2b2f6b" opacity=".55"><rect x="10" y="132" width="26" height="88" /><rect x="40" y="112" width="20" height="108" /><rect x="64" y="140" width="30" height="80" /><rect x="98" y="124" width="22" height="96" /><rect x="340" y="120" width="24" height="100" /><rect x="368" y="138" width="32" height="82" /></g>
        <g fill="#16224f" opacity=".85"><rect x="0" y="150" width="34" height="70" /><rect x="120" y="156" width="28" height="64" /><rect x="152" y="140" width="22" height="80" /><rect x="178" y="162" width="36" height="58" /><rect x="326" y="152" width="30" height="68" />
          {/* Wat Arun style prang */}
          <path d="M236 220V160h10v-20h8v-26h6V92h6V72l5-14 5 14v20h6v22h6v26h8v20h10v60z" />
          <path d="M214 220v-44h8v-16h6v-18l4-12 4 12v18h6v16h8v44z" opacity=".9" /><path d="M300 220v-38h8v-14h5v-16l3-11 3 11v16h5v14h8v38z" opacity=".9" /></g>
        <g fill="#ffdca0" opacity=".9"><circle cx="30" cy="170" r="1.4" /><circle cx="52" cy="150" r="1.4" /><circle cx="80" cy="176" r="1.4" /><circle cx="108" cy="150" r="1.4" /><circle cx="160" cy="170" r="1.4" /><circle cx="352" cy="146" r="1.4" /></g>
        <rect y="196" width="400" height="24" fill="#0d1a3f" /><g stroke="#f59a5b" strokeOpacity=".45" strokeWidth="1.5"><path d="M0 204h140M180 204h90M300 204h100M40 212h120M200 212h160" /></g>
      </>)}

      {kind === 'phuket' && (<>
        <circle cx="270" cy="128" r="64" fill={g('sun')} /><circle cx="270" cy="128" r="22" fill="#fff0bf" />
        <rect y="128" width="400" height="92" fill={g('sea')} />
        <g stroke="#ffe3a6" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round"><path d="M230 138h80M244 148h52M254 158h32" /></g>
        <g stroke="#7fd0c4" strokeOpacity=".4" strokeWidth="1.5" fill="none"><path d="M0 160q25-6 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0" /><path d="M0 178q25-6 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0" /></g>
        <path d="M0 196q60-14 130-8t150-6 120 10v28H0z" fill="#f0cf9c" /><path d="M0 206q80-10 160-4t240 0v18H0z" fill="#e2b97c" />
        {/* longtail boat */}
        <g fill="#0b1f3a"><path d="M300 144h60l-8 10h-46z" /><rect x="324" y="130" width="3" height="14" /><path d="M360 140l26-6v3l-24 8z" /></g>
        {/* palm */}
        <g fill="#0b2a2e"><path d="M70 220c4-40 6-70 4-96l5-1c3 28 2 58-2 97z" /><path d="M76 122c-26-18-50-12-66 4 22-8 40-4 66 4zM76 122c20-24 46-24 66-10-24-4-42 2-66 10zM76 122c-8-26-4-46 8-60-4 24 2 40 4 60zM76 122c-30-6-52 6-62 24 20-12 40-14 62-24zM76 122c26 0 48 14 56 34-18-16-36-22-56-34z" /></g>
      </>)}

      {kind === 'krabi' && (<>
        <circle cx="130" cy="120" r="60" fill={g('sun')} />
        <rect y="150" width="400" height="70" fill={g('sea')} />
        <g fill="#1d4b5b" opacity=".6"><path d="M200 150c2-40 8-78 22-92 12 12 18 52 20 92z" /><path d="M300 150c0-30 6-60 18-74 14 10 22 46 24 74z" /></g>
        <g fill="#0f3441"><path d="M20 150c-2-34 4-70 20-90 10-8 16 4 20 14 6 22 6 48 4 76z" /><path d="M250 150c2-44 10-84 26-98 14 8 22 40 24 98z" /><path d="M340 150c0-24 6-46 18-56 12 8 22 30 26 56z" /></g>
        <rect y="100" width="400" height="60" fill={g('mist')} />
        <g stroke="#9fe0d0" strokeOpacity=".4" strokeWidth="1.5" fill="none"><path d="M0 172q25-6 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0" /><path d="M0 192q25-6 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0" /></g>
        <g fill="#0b1f3a"><path d="M118 178h54l-7 9h-40z" /><rect x="144" y="166" width="3" height="12" /></g>
      </>)}

      {kind === 'generic' && (<>
        <circle cx="300" cy="120" r="60" fill={g('sun')} />
        <path d="M0 170c60-40 110-50 170-24s120 22 230-30v104H0z" fill="#0f3a4a" opacity=".85" /><path d="M0 196c80-24 140-20 220-6s130 4 180-12v42H0z" fill="#0b2a3a" />
      </>)}
    </svg>
  )
}
