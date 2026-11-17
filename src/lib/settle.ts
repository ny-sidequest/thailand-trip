/**
 * Exact group-expense settlement math.
 *
 * All money is handled internally as integer minor units (1/100 of the
 * currency). Balances are computed in the trip's BASE currency. No floats are
 * ever accumulated: every decimal input is converted once with `toMinor` and
 * every split is apportioned so that the parts sum exactly to the whole.
 */

export interface LedgerSplit { user_id: string; share_amount: number } // decimal, ORIGINAL currency of the expense
export interface LedgerExpense {
  payer_id: string
  amount: number /* original ccy, decimal */
  amount_base: number /* base ccy, decimal */
  is_personal: boolean
  deleted_at: string | null
  splits: LedgerSplit[]
}
export interface LedgerSettlement {
  from_user: string
  to_user: string
  amount: number /* original ccy, decimal */
  fx_rate_to_base: number /* base per 1 unit of original; 1 if already base */
  deleted_at: string | null
}
export interface LedgerRow { paid: number; owed: number; sent: number; received: number; net: number } // ALL integer minor units, base ccy
export interface Transfer { from: string; to: string; amount: number } // integer minor units, base ccy, amount > 0

/** Plain code-unit string comparison (locale independent, deterministic). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Round half away from zero, normalising -0 to 0. */
function roundHalfAway(x: number): number {
  const r = Math.sign(x) * Math.round(Math.abs(x))
  return r === 0 ? 0 : r
}

/**
 * Snap a float to 12 significant digits to remove binary representation noise
 * (e.g. 1.005 * 100 = 100.49999999999999 -> 100.5) before rounding.
 */
function snap(x: number): number {
  return Number(x.toPrecision(12))
}

function assertSafeInt(n: number, what: string): void {
  if (!Number.isSafeInteger(n)) throw new Error(`${what} must be a safe integer, got ${n}`)
}

/** Decimal -> integer minor units (half away from zero, robust to float noise). */
export function toMinor(n: number): number {
  if (!Number.isFinite(n)) throw new Error(`toMinor: amount must be finite, got ${n}`)
  return roundHalfAway(snap(n * 100))
}

/** Integer minor units -> decimal with 2dp. */
export function fromMinor(m: number): number {
  assertSafeInt(m, 'fromMinor: minor amount')
  const r = m / 100
  return r === 0 ? 0 : r
}

/** Convert an integer minor amount by an FX rate, rounding half away from zero. */
export function convertMinor(minor: number, rate: number): number {
  assertSafeInt(minor, 'convertMinor: minor amount')
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`convertMinor: rate must be a positive finite number, got ${rate}`)
  return roundHalfAway(snap(minor * rate))
}

/**
 * Split `totalMinor` as evenly as possible. Remainder units go to the users that
 * sort first by id, independent of input order. Sums exactly to `totalMinor`.
 */
export function splitEqual(totalMinor: number, userIds: string[]): Record<string, number> {
  assertSafeInt(totalMinor, 'splitEqual: total')
  if (totalMinor < 0) throw new Error(`splitEqual: total must be non-negative, got ${totalMinor}`)
  if (userIds.length === 0) throw new Error('splitEqual: user list is empty')
  const sorted = [...userIds].sort(cmp)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) throw new Error(`splitEqual: duplicate user id "${sorted[i]}"`)
  }
  const n = sorted.length
  const base = Math.floor(totalMinor / n)
  const rem = totalMinor - base * n
  const out: Record<string, number> = {}
  sorted.forEach((id, i) => { out[id] = base + (i < rem ? 1 : 0) })
  return out
}

/** Weights are scaled to exact integers (BigInt) so apportionment is exact. */
const WEIGHT_SCALE = 1_000_000

function weightToBig(w: number): bigint {
  if (Number.isInteger(w)) return BigInt(w) * BigInt(WEIGHT_SCALE)
  return BigInt(Math.round(snap(w * WEIGHT_SCALE)))
}

/**
 * Largest-remainder (Hamilton) apportionment of `totalMinor` proportional to
 * non-negative weights. Ties broken by user id ascending. Sums exactly.
 *
 * Non-integer weights are quantised to 1e-6 (so a positive weight below 5e-7
 * behaves as 0). Integer weights are used exactly.
 */
export function splitWeighted(totalMinor: number, weights: Record<string, number>): Record<string, number> {
  assertSafeInt(totalMinor, 'splitWeighted: total')
  if (totalMinor < 0) throw new Error(`splitWeighted: total must be non-negative, got ${totalMinor}`)
  const ids = Object.keys(weights).sort(cmp)
  if (ids.length === 0) throw new Error('splitWeighted: no weights given')
  const big: bigint[] = ids.map((id) => {
    const w = weights[id]
    if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) {
      throw new Error(`splitWeighted: weight for "${id}" must be a non-negative finite number, got ${w}`)
    }
    return weightToBig(w)
  })
  const W = big.reduce((a, b) => a + b, 0n)
  if (W === 0n) throw new Error('splitWeighted: all weights are zero')
  const T = BigInt(totalMinor)
  const floors: bigint[] = []
  const rems: bigint[] = []
  let assigned = 0n
  for (const w of big) {
    const p = T * w
    floors.push(p / W)
    rems.push(p % W)
    assigned += p / W
  }
  let leftover = Number(T - assigned) // < ids.length
  const order = ids.map((_, i) => i).sort((i, j) => {
    if (rems[i] !== rems[j]) return rems[i] > rems[j] ? -1 : 1
    return cmp(ids[i], ids[j])
  })
  const out: Record<string, number> = {}
  ids.forEach((id, i) => { out[id] = Number(floors[i]) })
  for (const i of order) {
    if (leftover <= 0) break
    out[ids[i]] += 1
    leftover--
  }
  return out
}

/** Per-user ledger in base-currency minor units. */
export function computeLedger(
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[],
  userIds: string[],
): Record<string, LedgerRow> {
  const rows: Record<string, LedgerRow> = {}
  const row = (id: string): LedgerRow => {
    if (!Object.prototype.hasOwnProperty.call(rows, id)) rows[id] = { paid: 0, owed: 0, sent: 0, received: 0, net: 0 }
    return rows[id]
  }
  for (const id of userIds) row(id)

  for (const e of expenses) {
    if (e.is_personal || e.deleted_at != null) continue
    const base = toMinor(e.amount_base)
    const w: Record<string, number> = {}
    for (const s of e.splits) {
      const m = toMinor(s.share_amount)
      if (m < 0) throw new Error(`computeLedger: negative share ${s.share_amount} for user "${s.user_id}"`)
      w[s.user_id] = (w[s.user_id] ?? 0) + m
    }
    if (Object.values(w).every((v) => v === 0)) {
      throw new Error(`computeLedger: expense paid by "${e.payer_id}" (amount ${e.amount}) has no splits or all split shares are zero`)
    }
    // Negative amount_base (refund) is apportioned on its magnitude then negated.
    const parts = splitWeighted(Math.abs(base), w)
    const sign = base < 0 ? -1 : 1
    row(e.payer_id).paid += base
    for (const [uid, part] of Object.entries(parts)) row(uid).owed += sign * part
  }

  for (const s of settlements) {
    if (s.deleted_at != null) continue
    const base = convertMinor(toMinor(s.amount), s.fx_rate_to_base)
    row(s.from_user).sent += base
    row(s.to_user).received += base
  }

  let total = 0
  for (const r of Object.values(rows)) {
    r.net = r.paid - r.owed + r.sent - r.received
    total += r.net
  }
  if (total !== 0) throw new Error(`computeLedger: invariant violated, sum of net balances is ${total}`)
  return rows
}

/** Net balance per user (minor units, base ccy). Positive = group owes the user. */
export function computeBalances(
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[],
  userIds: string[],
): Record<string, number> {
  const ledger = computeLedger(expenses, settlements, userIds)
  const out: Record<string, number> = {}
  for (const [id, r] of Object.entries(ledger)) out[id] = r.net
  return out
}

/**
 * Greedy settlement of a zero-sum set: repeatedly match the largest creditor
 * with the largest debtor (ties by id). Each step zeroes at least one party, so
 * a group of size n uses at most n-1 transfers; nobody ever changes sign, so no
 * self or reverse transfers occur.
 */
function greedySettle(entries: Array<[string, number]>, out: Transfer[]): void {
  const cred = entries.filter(([, b]) => b > 0).map(([id, b]) => ({ id, b }))
  const debt = entries.filter(([, b]) => b < 0).map(([id, b]) => ({ id, b: -b }))
  const byAmt = (x: { id: string; b: number }, y: { id: string; b: number }) => y.b - x.b || cmp(x.id, y.id)
  while (cred.length > 0 && debt.length > 0) {
    cred.sort(byAmt)
    debt.sort(byAmt)
    const c = cred[0]
    const d = debt[0]
    const amt = Math.min(c.b, d.b)
    out.push({ from: d.id, to: c.id, amount: amt })
    c.b -= amt
    d.b -= amt
    if (c.b === 0) cred.shift()
    if (d.b === 0) debt.shift()
  }
  if (cred.length > 0 || debt.length > 0) throw new Error('suggestSettlements: group does not sum to zero')
}

/** Maximum users for the exact subset DP (2^16 states). */
const DP_LIMIT = 16

/**
 * Minimum-transfer settlement plan.
 *
 * With k non-zero balances the minimum number of transfers is
 * k - (max number of disjoint zero-sum groups partitioning them). For k <= 16
 * this is solved exactly with a bitmask DP; each group is then settled greedily
 * with size-1 transfers. For k > 16 it falls back to plain greedy over everyone
 * (always correct and at most k-1 transfers, but not guaranteed minimal).
 */
export function suggestSettlements(balances: Record<string, number>): Transfer[] {
  let sum = 0
  for (const [id, b] of Object.entries(balances)) {
    assertSafeInt(b, `suggestSettlements: balance for "${id}"`)
    sum += b
  }
  if (sum !== 0) throw new Error(`suggestSettlements: balances must sum to 0, got ${sum}`)

  const ids = Object.keys(balances).filter((id) => balances[id] !== 0).sort(cmp)
  const k = ids.length
  const out: Transfer[] = []
  if (k === 0) return out

  if (k > DP_LIMIT) {
    greedySettle(ids.map((id) => [id, balances[id]]), out)
  } else {
    const vals = ids.map((id) => balances[id])
    const full = (1 << k) - 1
    const sums = new Float64Array(full + 1)
    const dp = new Int8Array(full + 1)
    for (let mask = 1; mask <= full; mask++) {
      const low = mask & -mask
      sums[mask] = sums[mask ^ low] + vals[31 - Math.clz32(low)]
      let best = 0
      for (let i = 0; i < k; i++) {
        const bit = 1 << i
        if (mask & bit && dp[mask ^ bit] > best) best = dp[mask ^ bit]
      }
      dp[mask] = best + (sums[mask] === 0 ? 1 : 0)
    }
    // Reconstruct: walk down from full, each zero-sum mask on the chain closes a group.
    const groups: number[] = []
    let mask = full
    let lastZero = full
    while (mask !== 0) {
      const target = dp[mask] - (sums[mask] === 0 ? 1 : 0)
      let next = -1
      for (let i = 0; i < k; i++) {
        const bit = 1 << i
        if (mask & bit && dp[mask ^ bit] === target) { next = mask ^ bit; break }
      }
      mask = next
      if (sums[mask] === 0) {
        groups.push(lastZero ^ mask)
        lastZero = mask
      }
    }
    for (const g of groups) {
      const members: Array<[string, number]> = []
      for (let i = 0; i < k; i++) if (g & (1 << i)) members.push([ids[i], vals[i]])
      greedySettle(members, out)
    }
  }

  out.sort((a, b) => b.amount - a.amount || cmp(a.from, b.from) || cmp(a.to, b.to))
  return out
}
