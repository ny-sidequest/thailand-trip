import { describe, it, expect } from 'vitest'
import { defaultRate, formatMoney, parseAmount } from './money'

describe('money helpers', () => {
  it('formats with symbols and grouping', () => {
    expect(formatMoney(1234.5, 'INR')).toBe('₹1,234.50'); expect(formatMoney(1234.5, 'THB')).toBe('฿1,234.50')
    expect(formatMoney(-5, 'INR')).toBe('−₹5.00'); expect(formatMoney(1234567.8, 'INR')).toBe('₹12,34,567.80')
  })
  it('parses user-typed amounts strictly', () => {
    expect(parseAmount('1,250.50')).toBe(1250.5); expect(parseAmount('99')).toBe(99)
    expect(Number.isNaN(parseAmount('10.999'))).toBe(true); expect(Number.isNaN(parseAmount('abc'))).toBe(true)
    expect(Number.isNaN(parseAmount('-5'))).toBe(true); expect(Number.isNaN(parseAmount(''))).toBe(true)
  })
  it('default rate is 1 for the base currency and the trip default otherwise', () => {
    expect(defaultRate('INR', 'INR', 2.5)).toBe(1); expect(defaultRate('THB', 'INR', 2.5)).toBe(2.5)
    expect(defaultRate('INR', 'THB', 2.5)).toBe(0.4)
  })
})
