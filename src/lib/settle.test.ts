import { describe, it, expect } from 'vitest'
import {
  toMinor, fromMinor, convertMinor, splitEqual, splitWeighted,
  computeLedger, computeBalances, suggestSettlements,
  type LedgerExpense, type LedgerSettlement, type Transfer,
} from './settle'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const randInt = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const sumVals = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
function shuffle<T>(r: () => number, xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Applies transfers and checks validity; returns the resulting balances. */
function applyTransfers(balances: Record<string, number>, transfers: Transfer[]): Record<string, number> {
  const b = { ...balances }
  const pairs = new Set<string>()
  for (const t of transfers) {
    expect(Number.isInteger(t.amount)).toBe(true)
    expect(t.amount).toBeGreaterThan(0)
    expect(t.from).not.toBe(t.to)
    expect(pairs.has(`${t.to}->${t.from}`)).toBe(false)
    pairs.add(`${t.from}->${t.to}`)
    b[t.from] = (b[t.from] ?? 0) + t.amount
    b[t.to] = (b[t.to] ?? 0) - t.amount
  }
  return b
}
const allZero = (b: Record<string, number>) => Object.values(b).every((v) => v === 0)

/** Independent oracle: k - max zero-sum partition, by recursive subset enumeration. */
function bruteMinTransfers(values: number[]): number {
  const vals = values.filter((v) => v !== 0)
  const memo = new Map<string, number>()
  const maxGroups = (rest: number[]): number => {
    if (rest.length === 0) return 0
    const key = [...rest].sort((a, b) => a - b).join(',')
    const hit = memo.get(key)
    if (hit !== undefined) return hit
    const [first, ...others] = rest
    let best = -Infinity
    const n = others.length
    for (let m = 0; m < 1 << n; m++) {
      let s = first
      const remaining: number[] = []
      for (let i = 0; i < n; i++) {
        if (m & (1 << i)) s += others[i]
        else remaining.push(others[i])
      }
      if (s === 0) best = Math.max(best, 1 + maxGroups(remaining))
    }
    memo.set(key, best)
    return best
  }
  return vals.length - maxGroups(vals)
}

describe('toMinor / fromMinor / convertMinor', () => {
  it('converts decimals robustly', () => {
    expect(toMinor(0.1 + 0.2)).toBe(30)
    expect(toMinor(1.005)).toBe(101)
    expect(toMinor(2499.995)).toBe(250000)
    expect(toMinor(-2499.995)).toBe(-250000)
    expect(toMinor(-1.005)).toBe(-101)
    expect(toMinor(0.30000000001)).toBe(30)
    expect(toMinor(12.34 - 1e-9)).toBe(1234)
    expect(toMinor(0)).toBe(0)
    expect(Object.is(toMinor(-0.004), 0)).toBe(true)
    expect(toMinor(1234567.89)).toBe(123456789)
    expect(() => toMinor(NaN)).toThrow()
    expect(() => toMinor(Infinity)).toThrow()
  })
  it('fromMinor gives 2dp decimals', () => {
    expect(fromMinor(3334)).toBe(33.34)
    expect(fromMinor(-5)).toBe(-0.05)
    expect(fromMinor(0)).toBe(0)
    expect(() => fromMinor(1.5)).toThrow()
  })
  it('convertMinor rounds half away from zero', () => {
    expect(convertMinor(10000, 2.5)).toBe(25000)
    expect(convertMinor(101, 2.5)).toBe(253) // 252.5
    expect(convertMinor(-101, 2.5)).toBe(-253)
    expect(convertMinor(3, 0.5)).toBe(2)
    expect(convertMinor(1, 0.5)).toBe(1)
    expect(convertMinor(-1, 0.5)).toBe(-1)
    expect(convertMinor(100, 1)).toBe(100)
    expect(convertMinor(1005, 0.1)).toBe(101) // 100.49999999999999 snapped to 100.5
    expect(() => convertMinor(1.5, 1)).toThrow()
    expect(() => convertMinor(100, 0)).toThrow()
    expect(() => convertMinor(100, NaN)).toThrow()
  })
  it('round-trips over random cents', () => {
    const r = mulberry32(1)
    for (let i = 0; i < 1000; i++) {
      const m = randInt(r, -1e8, 1e8)
      expect(toMinor(fromMinor(m))).toBe(m)
    }
  })
})

describe('splitEqual', () => {
  it('gives remainder to lowest ids', () => {
    expect(splitEqual(10000, ['c', 'a', 'b'])).toEqual({ a: 3334, b: 3333, c: 3333 })
    expect(splitEqual(10001, ['u3', 'u1', 'u2'])).toEqual({ u1: 3334, u2: 3334, u3: 3333 })
    expect(splitEqual(0, ['x'])).toEqual({ x: 0 })
  })
  it('is input-order independent and always exact', () => {
    const r = mulberry32(2)
    for (let i = 0; i < 300; i++) {
      const ids = Array.from({ length: randInt(r, 1, 7) }, (_, j) => `user${j}`)
      const total = randInt(r, 0, 1e7)
      const a = splitEqual(total, ids)
      const b = splitEqual(total, shuffle(r, ids))
      expect(a).toEqual(b)
      expect(sumVals(a)).toBe(total)
      const vs = Object.values(a)
      expect(Math.max(...vs) - Math.min(...vs)).toBeLessThanOrEqual(1)
    }
  })
  it('throws on bad input', () => {
    expect(() => splitEqual(100, [])).toThrow()
    expect(() => splitEqual(100, ['a', 'a'])).toThrow()
    expect(() => splitEqual(-1, ['a'])).toThrow()
    expect(() => splitEqual(1.5, ['a'])).toThrow()
  })
})

describe('splitWeighted', () => {
  it('handles percentage splits', () => {
    expect(splitWeighted(10000, { a: 33.333, b: 33.333, c: 33.334 })).toEqual({ a: 3333, b: 3333, c: 3334 })
    expect(splitWeighted(10000, { a: 50, b: 25, c: 25 })).toEqual({ a: 5000, b: 2500, c: 2500 })
    expect(splitWeighted(100, { a: 33.33, b: 33.33, c: 33.34 })).toEqual({ a: 33, b: 33, c: 34 })
  })
  it('gives zero-weight users nothing', () => {
    expect(splitWeighted(1001, { a: 0, b: 1, c: 1, d: 0 })).toEqual({ a: 0, b: 501, c: 500, d: 0 })
  })
  it('breaks ties by id ascending, independent of key order', () => {
    expect(splitWeighted(100, { z: 1, y: 1, x: 1 })).toEqual({ x: 34, y: 33, z: 33 })
    expect(splitWeighted(101, { y: 1, z: 1, x: 1 })).toEqual({ x: 34, y: 34, z: 33 })
  })
  it('converts original-ccy shares to base exactly', () => {
    // 100 THB at 2.5 => 250.00 base; shares 33.33/33.33/33.34 THB
    expect(splitWeighted(25000, { c: 3333, d: 3333, e: 3334 })).toEqual({ c: 8333, d: 8332, e: 8335 })
  })
  it('sums exactly over 500 random cases and is deterministic', () => {
    const r = mulberry32(3)
    for (let i = 0; i < 500; i++) {
      const n = randInt(r, 1, 8)
      const w: Record<string, number> = {}
      for (let j = 0; j < n; j++) w[`u${j}`] = r() < 0.2 ? 0 : r() < 0.5 ? randInt(r, 0, 100000) : Math.round(r() * 100000) / 1000
      if (sumVals(w) === 0) w.u0 = 1
      const total = randInt(r, 0, 5e7)
      const out = splitWeighted(total, w)
      expect(sumVals(out)).toBe(total)
      for (const [id, v] of Object.entries(out)) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        if (w[id] === 0) expect(v).toBe(0)
      }
      const reordered = Object.fromEntries(shuffle(r, Object.entries(w)))
      expect(splitWeighted(total, reordered)).toEqual(out)
    }
  })
  it('throws on bad input', () => {
    expect(() => splitWeighted(100, { a: 0, b: 0 })).toThrow()
    expect(() => splitWeighted(100, {})).toThrow()
    expect(() => splitWeighted(100, { a: -1, b: 2 })).toThrow()
    expect(() => splitWeighted(100, { a: NaN })).toThrow()
    expect(() => splitWeighted(-100, { a: 1 })).toThrow()
  })
})

const USERS = ['a', 'b', 'c', 'd', 'e']
const exp = (payer_id: string, amount: number, amount_base: number, splits: Array<[string, number]>, extra: Partial<LedgerExpense> = {}): LedgerExpense => ({
  payer_id, amount, amount_base, is_personal: false, deleted_at: null,
  splits: splits.map(([user_id, share_amount]) => ({ user_id, share_amount })), ...extra,
})
const settle = (from_user: string, to_user: string, amount: number, fx_rate_to_base: number, deleted_at: string | null = null): LedgerSettlement =>
  ({ from_user, to_user, amount, fx_rate_to_base, deleted_at })

describe('computeLedger / computeBalances', () => {
  // Base = INR; THB rate 2.5
  const expenses: LedgerExpense[] = [
    exp('a', 1000, 2500, USERS.map((u) => [u, 200])), // 1000 THB equal among 5
    exp('b', 100, 100, [['a', 33.33], ['b', 33.33], ['c', 33.34]]), // 100 INR
    exp('d', 100, 250, [['c', 33.33], ['d', 33.33], ['e', 33.34]]), // 100 THB
    exp('e', 500, 500, [['e', 500]], { is_personal: true }),
    exp('a', 999, 999, USERS.map((u) => [u, 199.8]), { deleted_at: '2026-01-01T00:00:00Z' }),
  ]
  const settlements: LedgerSettlement[] = [
    settle('e', 'a', 400, 2.5), // 1000.00 INR
    settle('b', 'a', 150, 1),
    settle('c', 'a', 9999, 1, '2026-01-02T00:00:00Z'),
  ]

  it('matches a hand-computed scenario', () => {
    const l = computeLedger(expenses, settlements, USERS)
    expect(l).toEqual({
      a: { paid: 250000, owed: 53333, sent: 0, received: 115000, net: 81667 },
      b: { paid: 10000, owed: 53333, sent: 15000, received: 0, net: -28333 },
      c: { paid: 0, owed: 61667, sent: 0, received: 0, net: -61667 },
      d: { paid: 25000, owed: 58332, sent: 0, received: 0, net: -33332 },
      e: { paid: 0, owed: 58335, sent: 100000, received: 0, net: 41665 },
    })
    expect(computeBalances(expenses, settlements, USERS)).toEqual({ a: 81667, b: -28333, c: -61667, d: -33332, e: 41665 })
  })

  it('has rows for all userIds and includes unknown users', () => {
    const l = computeLedger([], [settle('zed', 'a', 10, 1)], ['a', 'b'])
    expect(Object.keys(l).sort()).toEqual(['a', 'b', 'zed'])
    expect(l.b).toEqual({ paid: 0, owed: 0, sent: 0, received: 0, net: 0 })
    expect(l.zed.net).toBe(1000)
    expect(l.a.net).toBe(-1000)
    const l2 = computeLedger([exp('ghost', 10, 10, [['a', 10]])], [], ['a'])
    expect(l2.ghost.paid).toBe(1000)
    expect(l2.a.owed).toBe(1000)
  })

  it('throws when an expense has all-zero shares', () => {
    expect(() => computeLedger([exp('a', 10, 10, [['a', 0], ['b', 0]])], [], USERS)).toThrow(/zero/)
    expect(() => computeLedger([exp('a', 10, 10, [])], [], USERS)).toThrow()
    // ...but a personal/deleted one is skipped before validation
    expect(() => computeLedger([exp('a', 10, 10, [], { is_personal: true })], [], USERS)).not.toThrow()
  })

  it('sum(net) === 0 over 300 random ledgers', () => {
    const r = mulberry32(4)
    for (let i = 0; i < 300; i++) {
      const es: LedgerExpense[] = []
      for (let j = randInt(r, 0, 15); j > 0; j--) {
        const thb = r() < 0.5
        const rate = thb ? Math.round((2 + r()) * 10000) / 10000 : 1
        const amountMinor = randInt(r, 1, 5000000)
        const amount = amountMinor / 100
        const amount_base = toMinor(amount * rate) / 100
        const members = shuffle(r, USERS).slice(0, randInt(r, 1, 5))
        const parts = splitEqual(amountMinor, members)
        es.push(exp(USERS[randInt(r, 0, 4)], amount, amount_base, Object.entries(parts).map(([u, m]) => [u, m / 100]), {
          is_personal: r() < 0.1, deleted_at: r() < 0.1 ? 'x' : null,
        }))
      }
      const ss: LedgerSettlement[] = []
      for (let j = randInt(r, 0, 5); j > 0; j--) {
        ss.push(settle(USERS[randInt(r, 0, 4)], USERS[randInt(r, 0, 4)], randInt(r, 1, 1000000) / 100, r() < 0.5 ? 2.5 : 1, r() < 0.1 ? 'x' : null))
      }
      const l = computeLedger(es, ss, USERS)
      let total = 0
      for (const row of Object.values(l)) {
        for (const v of Object.values(row)) expect(Number.isInteger(v)).toBe(true)
        total += row.net
      }
      expect(total).toBe(0)
      expect(Object.keys(l).sort()).toEqual(USERS)
      const transfers = suggestSettlements(computeBalances(es, ss, USERS))
      expect(allZero(applyTransfers(computeBalances(es, ss, USERS), transfers))).toBe(true)
    }
  })
})

describe('suggestSettlements', () => {
  it('handles classic cases', () => {
    expect(suggestSettlements({ a: -500, b: 500 })).toEqual([{ from: 'a', to: 'b', amount: 500 }])
    // chain A->B 10, B->C 10 collapses to A->C
    expect(suggestSettlements({ a: -1000, b: 0, c: 1000 })).toEqual([{ from: 'a', to: 'c', amount: 1000 }])
    const bal = { d1: -300, d2: -200, d3: -100, c1: 400, c2: 200 }
    const t = suggestSettlements(bal)
    expect(t.length).toBe(bruteMinTransfers(Object.values(bal)))
    expect(allZero(applyTransfers(bal, t))).toBe(true)
  })

  it('finds the minimum where naive greedy does not', () => {
    // greedy largest-largest gives 4 transfers here; optimum {a,e} + {b,c,d} = 3
    const bal = { a: 4, b: 3, c: 3, d: -6, e: -4 }
    const t = suggestSettlements(bal)
    expect(t.length).toBe(3)
    expect(t).toContainEqual({ from: 'e', to: 'a', amount: 4 })
    expect(allZero(applyTransfers(bal, t))).toBe(true)

    expect(suggestSettlements({ a: 5, b: 5, c: -5, d: -5 }).length).toBe(2)
    const two = { a: 3, b: -3, c: 7, d: -7 }
    expect(suggestSettlements(two)).toEqual([{ from: 'd', to: 'c', amount: 7 }, { from: 'b', to: 'a', amount: 3 }])

    const mixed = { a: 10, b: -4, c: -6, d: 8, e: -8, f: 1, g: 2, h: -3 }
    const tm = suggestSettlements(mixed)
    expect(tm.length).toBe(8 - 3)
    expect(tm.length).toBe(bruteMinTransfers(Object.values(mixed)))
    expect(allZero(applyTransfers(mixed, tm))).toBe(true)
  })

  it('matches a brute-force oracle on 300 random sets', () => {
    const r = mulberry32(5)
    for (let i = 0; i < 300; i++) {
      const n = randInt(r, 2, 8)
      const small = r() < 0.5 // small values make zero-sum subgroups common
      const vals = Array.from({ length: n - 1 }, () => (r() < 0.1 ? 0 : randInt(r, small ? -6 : -100000, small ? 6 : 100000)))
      vals.push(-vals.reduce((a, b) => a + b, 0))
      const bal: Record<string, number> = {}
      vals.forEach((v, j) => { bal[`p${j}`] = v })
      const t = suggestSettlements(bal)
      expect(t.length).toBe(bruteMinTransfers(vals))
      expect(allZero(applyTransfers(bal, t))).toBe(true)
      const sorted = [...t].sort((x, y) => y.amount - x.amount || (x.from < y.from ? -1 : x.from > y.from ? 1 : 0) || (x.to < y.to ? -1 : x.to > y.to ? 1 : 0))
      expect(t).toEqual(sorted)
    }
  })

  it('is deterministic under shuffled key order', () => {
    const r = mulberry32(6)
    for (let i = 0; i < 100; i++) {
      const n = randInt(r, 2, 10)
      const vals = Array.from({ length: n - 1 }, () => randInt(r, -20, 20))
      vals.push(-vals.reduce((a, b) => a + b, 0))
      const entries = vals.map((v, j): [string, number] => [`u${String.fromCharCode(97 + j)}`, v])
      const base = suggestSettlements(Object.fromEntries(entries))
      for (let s = 0; s < 3; s++) expect(suggestSettlements(Object.fromEntries(shuffle(r, entries)))).toEqual(base)
    }
  })

  it('handles empty, all-zero and invalid input', () => {
    expect(suggestSettlements({})).toEqual([])
    expect(suggestSettlements({ a: 0, b: 0 })).toEqual([])
    expect(() => suggestSettlements({ a: 1, b: -2 })).toThrow()
    expect(() => suggestSettlements({ a: 0.5, b: -0.5 })).toThrow()
    expect(() => suggestSettlements({ a: NaN, b: 0 })).toThrow()
  })

  it('k > 16 greedy fallback still settles to exactly 0', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 20; i++) {
      const n = randInt(r, 17, 40)
      const vals = Array.from({ length: n - 1 }, () => randInt(r, -1000000, 1000000) || 1)
      vals.push(-vals.reduce((a, b) => a + b, 0))
      const bal: Record<string, number> = {}
      vals.forEach((v, j) => { bal[`p${String(j).padStart(2, '0')}`] = v })
      const k = vals.filter((v) => v !== 0).length
      const t = suggestSettlements(bal)
      expect(t.length).toBeLessThanOrEqual(k - 1)
      expect(allZero(applyTransfers(bal, t))).toBe(true)
    }
  })

  it('k = 16 uses the exact DP within reasonable time', () => {
    const bal: Record<string, number> = {}
    for (let j = 0; j < 8; j++) { bal[`c${j}`] = j + 1; bal[`d${j}`] = -(j + 1) }
    const t = suggestSettlements(bal)
    expect(t.length).toBe(8)
    expect(allZero(applyTransfers(bal, t))).toBe(true)
  })
})
