export default function SetupNotice() {
  return (
    <div className="min-h-screen grid place-items-center p-6 bg-white/[.07]">
      <div className="max-w-md rounded-3xl glass-strong p-6">
        <h1 className="font-display text-2xl font-medium text-ink-50">Supabase isn't configured</h1>
        <p className="mt-2 text-ink-200">Copy <code>.env.example</code> to <code>.env</code> and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart. See README → Setup.</p>
      </div>
    </div>
  )
}
