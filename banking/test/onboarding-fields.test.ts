import { describe, expect, it } from 'vitest'
import { getBankAccountOpeningFields } from '../sdk/onboarding-fields.js'

describe('bank-account opening field schemas', () => {
  it('returns the Unit business fields without exposing mutable schema state', () => {
    const fields = getBankAccountOpeningFields('unit')
    expect(fields.find(field => field.name === 'businessTaxId')?.providerName).toBe('ein')
    expect(fields.find(field => field.name === 'businessTaxId')?.description).toMatch(/numbers only/i)
    const originalLabel = fields[0].label
    fields[0].label = 'Changed'
    expect(getBankAccountOpeningFields('unit')[0].label).toBe(originalLabel)
  })

  it('describes the fields exposed by the other supported banking adapters', () => {
    expect(getBankAccountOpeningFields('checkbook').find(field => field.name === 'businessTaxId')?.description).toMatch(/tax identification/i)
    expect(getBankAccountOpeningFields('usio')[0].description).toMatch(/USIO user/i)
    expect(getBankAccountOpeningFields('bridge', { accountType: 'individual' })[0].description).toMatch(/individual customer/i)
    expect(() => getBankAccountOpeningFields('bridge')).toThrow(/bridge.*business/i)
  })
})
