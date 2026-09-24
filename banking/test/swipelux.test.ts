import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Banking, SwipeLuxProvider, SwipeLuxError } from '../sdk/banking.js'
import { getBankAccountOpeningFields, listBankAccountOpeningPartners } from '../sdk/onboarding-fields.js'

const request = vi.spyOn(axios, 'request')
const options = { idempotencyKey: 'persisted-operation-1' }
let provider: SwipeLuxProvider

beforeEach(() => {
  vi.stubEnv('SWIPELUX_API_KEY', 'test-secret')
  vi.stubEnv('SWIPELUX_API_URL', 'https://platform.swipelux.com')
  provider = new SwipeLuxProvider({ customerId: 'cus_123' })
  request.mockResolvedValue({ status: 200, data: { data: { id: 'cus_123' } } })
})
afterEach(() => { vi.unstubAllEnvs(); request.mockReset() })

describe('SwipeLux provider', () => {
  it('is selectable through the public SDK and fails immediately on missing configuration', async () => {
    expect((await Banking.create('swipelux')).provider).toBeInstanceOf(SwipeLuxProvider)
    vi.stubEnv('SWIPELUX_API_KEY', '')
    await expect(Banking.create('swipelux')).rejects.toThrow('.swipelux.config-no-api-key')
    expect(() => new Banking('swipelux')).toThrow('.swipelux.config-no-api-key')
  })

  it.each(['http://example.com', 'https://user:pass@example.com', 'https://example.com/v3', 'https://example.com?key=1'])(
    'rejects unsafe or non-origin API URL %s', apiUrl => {
      expect(() => new SwipeLuxProvider({ apiUrl })).toThrow('.swipelux.config-invalid-api-url')
    })

  it('maps individual profiles and reuses the same creation key across retries', async () => {
    const user = { id: 'local-1', name: 'Amina Diallo', email: 'amina@example.com', dob: '1990-01-02',
      address: { street: '123 Main St', city: 'Boston', state: 'MA', zip: '02101', country: 'US' } }
    expect(await provider.newUser(user)).toBe('cus_123')
    await provider.newUser(user)
    expect(request.mock.calls[0][0]).toMatchObject({ method: 'POST', url: 'https://platform.swipelux.com/v3/customers',
      headers: { 'X-API-Key': 'test-secret' }, maxRedirects: 0,
      data: { type: 'individual', externalId: 'local-1', individual: { firstName: 'Amina', lastName: 'Diallo',
        birthDate: '1990-01-02', residentialAddress: { postalCode: '02101' } } } })
    expect(request.mock.calls[0][0].headers?.['Idempotency-Key']).toBe(request.mock.calls[1][0].headers?.['Idempotency-Key'])
    expect(provider.userId).toBe('cus_123')
  })

  it('maps a business without treating its contact as an individual', async () => {
    await provider.newUser({ id: 'company-1', business_name: 'Acme', email: 'ops@example.com', ein: '12-3456789' }, options)
    expect(request.mock.calls[0][0].data).toMatchObject({ type: 'business', business: {
      legalName: 'Acme', email: 'ops@example.com', taxIdentifiers: [{ type: 'ein', country: 'US', value: '12-3456789' }]
    } })
    expect(request.mock.calls[0][0].data).not.toHaveProperty('individual')
  })

  it('reads, edits, and deletes the selected customer using v3 semantics', async () => {
    await provider.getUser()
    await provider.editUser({ dob: '1990-01-02' }, options)
    expect(request.mock.calls[1][0]).toMatchObject({ method: 'PATCH', data: { individual: { birthDate: '1990-01-02' } } })
    request.mockResolvedValueOnce({ status: 204 })
    expect(await provider.delUser('cus_123', options)).toEqual({ success: true })
    expect(provider.userId).toBeUndefined()
    await expect(provider.getUser()).rejects.toThrow('.swipelux.user-no-id')
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('does not silently ignore per-user credentials', async () => {
    await expect(provider.getUser({ key: 'other-user', secret: 'secret' })).rejects.toThrow('per-user-auth-not-supported')
    expect(request).not.toHaveBeenCalled()
  })

  it('preserves bank identifiers, decimal balances, and page cursors', async () => {
    const account = { id: 'acc_1', status: 'ready', details: { routingNumber: '021000021', accountNumber: '00012345678901234567' },
      balances: [{ currency: 'USDC', available: '123456789012345.123456', pending: '0' }] }
    request.mockResolvedValueOnce({ status: 201, data: { data: account } })
    expect(await provider.createAccount({ origin: 'external', type: 'bank', country: 'US', currency: 'USD', methods: ['ach'],
      details: { ...account.details, bankName: 'Example', accountHolderName: 'Amina Diallo', accountType: 'checking' } }, options)).toEqual(account)
    const page = { data: [account], nextCursor: 'next', hasMore: true }
    request.mockResolvedValueOnce({ status: 200, data: page })
    expect(await provider.listAccounts({ cursor: 'previous', limit: 10 })).toEqual(page)
    expect(request.mock.calls[1][0].params).toEqual({ cursor: 'previous', limit: 10 })
  })

  it('keeps quote creation separate from transfer execution and preserves retry keys', async () => {
    const quote = { id: 'quo_1', status: 'active', in: { amount: '1.234567', currency: 'USDC' } }
    request.mockResolvedValueOnce({ status: 201, data: { data: quote } })
    expect(await provider.createQuote({ capabilityId: 'stablecoin_transfers', destinationId: 'acc_2',
      in: { amount: '1.234567', currency: 'USDC', accountId: 'acc_1' }, out: { currency: 'USDC' } }, options)).toEqual(quote)
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][0].data).toMatchObject({ customerId: 'cus_123' })
    const transfer = { id: 'trf_1', state: 'pending', openTaskIds: [] }
    request.mockResolvedValue({ status: 201, data: { data: transfer } })
    expect(await provider.createTransfer({ quoteId: 'quo_1' }, options)).toEqual(transfer)
    await provider.createTransfer({ quoteId: 'quo_1' }, options)
    expect(request.mock.calls[1][0]).toMatchObject({ url: 'https://platform.swipelux.com/v3/transfers',
      data: { quoteId: 'quo_1' }, headers: { 'Idempotency-Key': options.idempotencyKey } })
    expect(request.mock.calls[1][0]).toEqual(request.mock.calls[2][0])
  })

  it('retains API problems and retry keys without leaking request credentials', async () => {
    const problem = { code: 'quote_already_executed', transferId: 'trf_existing', correlationId: 'req_123' }
    request.mockRejectedValueOnce({ isAxiosError: true, response: { data: problem }, config: { secret: 'test-secret' } })
    const error = await provider.createTransfer({ quoteId: 'quo_1' }, options).catch(error => error)
    expect(error).toBeInstanceOf(SwipeLuxError)
    expect(error).toMatchObject({ message: '.swipelux.transfer-create', cause: problem, idempotencyKey: options.idempotencyKey })
    expect(JSON.stringify(error)).not.toContain('test-secret')
  })

  it('rejects malformed responses and missing write keys', async () => {
    request.mockResolvedValueOnce({ status: 200, data: {} })
    await expect(provider.getUser()).rejects.toMatchObject({ message: '.swipelux.user-get', cause: { message: '.swipelux.invalid-response' } })
    await expect(provider.createTransfer({ quoteId: 'quo_1' }, { idempotencyKey: '' })).rejects.toThrow('idempotency-key-invalid')
    await expect(provider.createTransfer({ quoteId: 'quo_1' }, undefined!)).rejects.toThrow('idempotency-key-required')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('reads provider state and safely encodes resource identifiers', async () => {
    await provider.getAccount('acc_1')
    await provider.getQuote('quo_1')
    await provider.getTransfer('trf_1')
    await provider.getTransferInstructions('trf_1')
    await provider.getAccount('acc_1/other?query=1')
    expect(request.mock.calls.map(([config]) => config.url)).toEqual([
      'https://platform.swipelux.com/v3/customers/cus_123/accounts/acc_1',
      'https://platform.swipelux.com/v3/quotes/quo_1',
      'https://platform.swipelux.com/v3/transfers/trf_1',
      'https://platform.swipelux.com/v3/transfers/trf_1/instructions',
      'https://platform.swipelux.com/v3/customers/cus_123/accounts/acc_1%2Fother%3Fquery%3D1'
    ])
    expect(() => provider.getAccount('..')).toThrow('account-no-id')
  })

  it('uses scoped capability and task endpoints', async () => {
    await provider.listCapabilities()
    await provider.getSupportedCapabilities()
    await provider.requestCapability('ach_pooled', options)
    await provider.getTask('tsk_123')
    await provider.submitTask('tsk_123', { revision: 1, answers: [] }, options)
    expect(request.mock.calls.map(([config]) => config.url)).toEqual([
      'https://platform.swipelux.com/v3/customers/cus_123/capabilities',
      'https://platform.swipelux.com/v3/customers/cus_123/capabilities/supported',
      'https://platform.swipelux.com/v3/customers/cus_123/capabilities/ach_pooled',
      'https://platform.swipelux.com/v3/customers/cus_123/tasks/tsk_123',
      'https://platform.swipelux.com/v3/customers/cus_123/tasks/tsk_123/submissions'
    ])
  })

  it('rejects incompatible legacy operations without making API requests', async () => {
    const operations = [provider.getEscrowAcct(), provider.addEscrowAcct(), provider.getExitAcct(),
      provider.addExitAcct({ type: 'CHECKING', routing: 123, account: 456 }),
      provider.addPaypal({ id: 'x' }, 'user'), provider.addVenmo({ id: 'x' }, 'user'),
      provider.createCheque({ name: 'x', amount: 1, account: 'a', recipient: 'b' }), provider.depositCheque('x', 'a')]
    const results = await Promise.allSettled(operations)
    for (const result of results) {
      expect(result.status).toBe('rejected')
      if (result.status === 'rejected') expect(result.reason.message).toMatch(/^\.swipelux\..*-not-supported$/)
    }
    expect(request).not.toHaveBeenCalled()
  })

  it('registers initial onboarding fields for both customer types', () => {
    expect(listBankAccountOpeningPartners()).toContain('swipelux')
    expect(getBankAccountOpeningFields('swipelux')[0]).toMatchObject({ providerName: 'business_name', required: true })
    expect(getBankAccountOpeningFields('swipelux', { accountType: 'individual' })[0].providerName).toBe('name')
  })
})
