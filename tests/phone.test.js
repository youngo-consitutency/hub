import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatPhoneWhileTyping,
  getCountryOptions,
  normalizePhone,
} from '../src/lib/phone.js'

describe('phone formatting', () => {
  it('keeps the international prefix when the field has no digits', () => {
    assert.equal(formatPhoneWhileTyping('', 'KE'), '+ ')
    assert.equal(formatPhoneWhileTyping('+', 'KE'), '+ ')
    assert.equal(normalizePhone('+', 'KE'), '')
  })

  it('formats a Kenyan national number while it is typed', () => {
    assert.equal(formatPhoneWhileTyping('0712345678', 'KE'), '0712 345678')
  })

  it('formats an international number independently of the selected country', () => {
    assert.equal(
      formatPhoneWhileTyping('+442079460018', 'KE'),
      '+ 44 20 7946 0018',
    )
  })

  it('infers the region from an international calling code', () => {
    assert.equal(
      formatPhoneWhileTyping('+254712345678', 'GB'),
      '+ 254 712 345678',
    )
  })

  it('normalizes a valid national number to E.164 for storage', () => {
    assert.equal(normalizePhone('0712 345678', 'KE'), '+254712345678')
  })

  it('provides searchable country names for residence fields', () => {
    const kenya = getCountryOptions().find((option) => option.value === 'Kenya')
    assert.deepEqual(kenya, { value: 'Kenya', label: 'Kenya' })
  })
})
