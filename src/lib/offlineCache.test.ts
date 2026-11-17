import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearAllCaches, readCache, writeCache } from './offlineCache'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k), get length() { return store.size }, key: (i: number) => [...store.keys()][i] ?? null,
  })
  vi.spyOn(Object, 'keys').mockImplementation(((o: object) => (o === (globalThis as { localStorage?: object }).localStorage ? [...store.keys()] : Reflect.ownKeys(o).filter((k) => typeof k === 'string'))) as typeof Object.keys)
})

describe('offline cache', () => {
  it('round-trips per user and trip', () => {
    writeCache('u1', 't1', 'itinerary', { a: 1 })
    expect(readCache<{ a: number }>('u1', 't1', 'itinerary')?.data).toEqual({ a: 1 })
    expect(readCache('u2', 't1', 'itinerary')).toBeNull(); expect(readCache('u1', 't2', 'itinerary')).toBeNull()
  })
  it('clears every cached copy (used on sign-out) but leaves unrelated keys', () => {
    writeCache('u1', 't1', 'itinerary', { a: 1 }); writeCache('u2', 't1', 'itinerary', { b: 2 }); store.set('other', 'x')
    clearAllCaches()
    expect(readCache('u1', 't1', 'itinerary')).toBeNull(); expect(readCache('u2', 't1', 'itinerary')).toBeNull(); expect(store.get('other')).toBe('x')
  })
  it('returns null for corrupt data', () => { store.set('tripHQ.cache.u1.t1.itinerary', '{not json'); expect(readCache('u1', 't1', 'itinerary')).toBeNull() })
})
