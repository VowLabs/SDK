import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock axios so the USIOProvider uses predictable responses
vi.mock('axios')
import axios from 'axios'

import { Provider as USIOProvider } from '../lib/banking/usio'

describe('USIOProvider', () => {
  const origApi = process.env.USIO_API
  const origKey = process.env.USIO_KEY
  const origSecret = process.env.USIO_SECRET

  beforeEach(() => {
    process.env.USIO_API = 'https://api.usio.test'
    process.env.USIO_KEY = 'k'
    process.env.USIO_SECRET = 's'
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env.USIO_API = origApi
    process.env.USIO_KEY = origKey
    process.env.USIO_SECRET = origSecret
  })

  it('getUser returns user on success', async () => {
    const mocked = axios as any
    mocked.get.mockResolvedValue({ data: { user: { id: 'u1', name: 'Alice' } } })
    const p = new USIOProvider()
    const u = await p.getUser()
    expect(u).toEqual({ id: 'u1', name: 'Alice' })
    expect(mocked.get).toHaveBeenCalled()
  })

  it('newUser posts and returns id', async () => {
    const mocked = axios as any
    mocked.post.mockResolvedValue({ data: { id: 'new-user-id' } })
    const p = new USIOProvider()
    const id = await p.newUser({ id: 'uid', name: 'Bob' })
    expect(id).toBe('new-user-id')
    expect(mocked.post).toHaveBeenCalled()
  })

  it('getEscrowAcct returns first wallet', async () => {
    const mocked = axios as any
    mocked.get.mockResolvedValue({ data: { wallets: [{ id: 'w1', balance: 42 }] } })
    const p = new USIOProvider()
    const w = await p.getEscrowAcct()
    expect(w).toEqual({ id: 'w1', balance: 42 })
  })

  it('createCheque and depositCheque work', async () => {
    const mocked = axios as any
    mocked.post.mockImplementation((url: string) => {
      if (url.endsWith('/check/digital')) return Promise.resolve({ data: { id: 'chk1', amount: 10 } })
      if (url.includes('/check/deposit/')) return Promise.resolve({ data: { id: 'chk1', status: 'PAID' } })
      return Promise.resolve({ data: {} })
    })
    const p = new USIOProvider()
    const chk = await p.createCheque({ name: 'C', amount: 10, account: 'a', recipient: 'r' })
    expect(chk).toEqual({ id: 'chk1', amount: 10 })
    const dep = await p.depositCheque('chk1', 'acct')
    expect(dep).toEqual({ id: 'chk1', status: 'PAID' })
  })

  it('maps errors to checkbook codes', async () => {
    const mocked = axios as any
    mocked.get.mockRejectedValue({ response: { data: { error: 'Bad' } } })
    const p = new USIOProvider()
    await expect(p.getUser()).rejects.toThrow('.checkbook.user-get')
  })
})
