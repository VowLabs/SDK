import { describe, it, expect } from 'vitest'
import { AVAILABLE_BANKING_SERVICES, Banking } from '../lib/banking/index'
import { Provider as CheckbookProvider } from '../lib/banking/checkbook'

describe('Banking banking SDK', () => {
  it('exposes the supported banking services', () => {
    expect(AVAILABLE_BANKING_SERVICES).toEqual(['checkbook', 'usio', 'bridge', 'unit', 'swipelux'])
  })

  it('checkbook provider throws when CHKBK_URL is missing', () => {
    const origUrl = process.env.CHKBK_URL
    const origPub = process.env.CHKBK_PUBLIC
    const origSec = process.env.CHKBK_SECRET

    delete process.env.CHKBK_URL
    process.env.CHKBK_PUBLIC = 'pub'
    process.env.CHKBK_SECRET = 'sec'

    expect(() => new CheckbookProvider()).toThrow('No CHECKBOOK in env')

    process.env.CHKBK_URL = origUrl
    process.env.CHKBK_PUBLIC = origPub
    process.env.CHKBK_SECRET = origSec
  })

  it('checkbook provider throws when credentials are missing', () => {
    const origUrl = process.env.CHKBK_URL
    const origPub = process.env.CHKBK_PUBLIC
    const origSec = process.env.CHKBK_SECRET

    process.env.CHKBK_URL = 'http://example'
    delete process.env.CHKBK_PUBLIC
    delete process.env.CHKBK_SECRET

    expect(() => new CheckbookProvider()).toThrow('No CHECKBOOK credentials in env')

    process.env.CHKBK_URL = origUrl
    process.env.CHKBK_PUBLIC = origPub
    process.env.CHKBK_SECRET = origSec
  })

  it('Banking.create("checkbook") loads the checkbook provider', async () => {
    const origUrl = process.env.CHKBK_URL
    const origPub = process.env.CHKBK_PUBLIC
    const origSec = process.env.CHKBK_SECRET

    process.env.CHKBK_URL = 'http://example'
    process.env.CHKBK_PUBLIC = 'pub'
    process.env.CHKBK_SECRET = 'sec'

    const banking = await Banking.create('checkbook')

    expect(banking.provider).toBeInstanceOf(CheckbookProvider)

    process.env.CHKBK_URL = origUrl
    process.env.CHKBK_PUBLIC = origPub
    process.env.CHKBK_SECRET = origSec
  })
})
